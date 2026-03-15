from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from typing import Optional
from datetime import date

from backend.db.database import get_db
from backend.models.models import Receipt, ReceiptLine, Product, StockLevel, StockMove, StatusEnum, User, MoveTypeEnum, Warehouse, OperationLog, ActionEnum, Location
from backend.routers.auth import get_current_user
from backend.schemas.receipts import ReceiptCreate, ReceiptUpdate, ReceiptListResponse, SingleReceiptResponse

router = APIRouter(prefix="/api/receipts", tags=["receipts"])

@router.get("", response_model=ReceiptListResponse)
def get_receipts(
    status: Optional[StatusEnum] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        Receipt,
        func.count(ReceiptLine.id).label("line_count"),
        Warehouse.name.label("warehouse_name")
    ).outerjoin(ReceiptLine, Receipt.id == ReceiptLine.receipt_id)\
     .outerjoin(Warehouse, Receipt.warehouse_id == Warehouse.id)

    if status:
        query = query.filter(Receipt.status == status)
    if date_from:
        query = query.filter(func.date(Receipt.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(Receipt.created_at) <= date_to)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Receipt.reference.ilike(search_filter),
                Receipt.supplier.ilike(search_filter)
            )
        )

    query = query.group_by(Receipt.id).order_by(desc(Receipt.created_at))
    results = query.all()

    receipts = []
    for receipt, line_count, loc_name in results:
        r_dict = {
            "id": receipt.id,
            "reference": receipt.reference,
            "supplier": receipt.supplier,
            "scheduled_date": receipt.scheduled_date,
            "status": receipt.status,
            "warehouse_id": receipt.warehouse_id,
            "warehouse_name": loc_name,
            "created_at": receipt.created_at,
            "line_count": line_count,
            "lines": []
        }
        receipts.append(r_dict)

    return {"success": True, "data": receipts, "message": "Receipts retrieved"}

@router.post("", response_model=SingleReceiptResponse)
def create_receipt(
    receipt: ReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create receipts")

    # Auto-generate reference if none provided
    ref = receipt.reference
    if not ref:
        count = db.query(Receipt).count() + 1
        ref = f"WH/IN/{count:05d}"
        
    # Verify Warehouse
    wh = db.query(Warehouse).filter(Warehouse.id == receipt.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=400, detail="Invalid target warehouse selected")

    db_receipt = Receipt(
        reference=ref,
        supplier=receipt.supplier,
        scheduled_date=receipt.scheduled_date,
        warehouse_id=receipt.warehouse_id,
        status=StatusEnum.draft
    )
    db.add(db_receipt)
    db.flush()

    for line in receipt.lines:
        db_line = ReceiptLine(
            receipt_id=db_receipt.id,
            product_id=line.product_id,
            location_id=line.location_id,
            quantity=line.quantity
        )
        db.add(db_line)

    db.add(OperationLog(
        operation_type=MoveTypeEnum.receipt,
        operation_id=db_receipt.id,
        action=ActionEnum.created,
        user_id=current_user.id
    ))

    db.commit()
    return get_receipt_by_id(db_receipt.id, db)

@router.get("/{receipt_id}", response_model=SingleReceiptResponse)
def get_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_receipt_by_id(receipt_id, db)

@router.put("/{receipt_id}", response_model=SingleReceiptResponse)
def update_receipt(
    receipt_id: int,
    update_data: ReceiptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can update receipts")

    db_receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not db_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    if db_receipt.status != StatusEnum.draft:
        raise HTTPException(status_code=400, detail="Only draft receipts can be modified")

    if update_data.supplier is not None:
        db_receipt.supplier = update_data.supplier
    if update_data.reference is not None:
        db_receipt.reference = update_data.reference
    if update_data.scheduled_date is not None:
        db_receipt.scheduled_date = update_data.scheduled_date
    if update_data.warehouse_id is not None:
        # Verify Warehouse
        wh = db.query(Warehouse).filter(Warehouse.id == update_data.warehouse_id).first()
        if not wh:
            raise HTTPException(status_code=400, detail="Invalid target warehouse selected")
        db_receipt.warehouse_id = update_data.warehouse_id
    if update_data.status is not None:
        db_receipt.status = update_data.status
        
    if update_data.lines is not None:
        db.query(ReceiptLine).filter(ReceiptLine.receipt_id == receipt_id).delete()
        for line in update_data.lines:
            db_line = ReceiptLine(
                receipt_id=receipt_id,
                product_id=line.product_id,
                location_id=line.location_id,
                quantity=line.quantity
            )
            db.add(db_line)

    db.commit()
    return get_receipt_by_id(receipt_id, db)

@router.put("/{receipt_id}/validate", response_model=SingleReceiptResponse)
def validate_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        db_receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
        if not db_receipt:
            raise HTTPException(status_code=404, detail="Receipt not found")
        
        if db_receipt.status == StatusEnum.done:
            raise HTTPException(status_code=400, detail="Receipt is already done")
            
        lines = db.query(ReceiptLine).filter(ReceiptLine.receipt_id == receipt_id).all()
        if not lines:
            raise HTTPException(status_code=400, detail="Cannot validate empty receipt")
            
        # Pre-aggregate quantities to avoid IntegrityError on duplicate lines
        product_quantities = {}
        for line in lines:
            key = (line.product_id, line.location_id)
            product_quantities[key] = product_quantities.get(key, 0) + line.quantity

        for (product_id, location_id), total_qty in product_quantities.items():
            if not location_id:
                raise HTTPException(status_code=400, detail="Line missing target location")
                
            # Upsert Stock Level
            stock = db.query(StockLevel).filter(
                StockLevel.product_id == product_id,
                StockLevel.location_id == location_id
            ).first()
            
            if stock:
                stock.quantity += total_qty
            else:
                stock = StockLevel(
                    product_id=product_id,
                    location_id=location_id,
                    quantity=total_qty
                )
                db.add(stock)
                
            # Insert Stock Move
            move = StockMove(
                product_id=product_id,
                to_location_id=location_id,
                quantity=total_qty,
                move_type=MoveTypeEnum.receipt,
                reference_id=receipt_id
            )
            db.add(move)
            
        db_receipt.status = StatusEnum.done
        
        db.add(OperationLog(
            operation_type=MoveTypeEnum.receipt,
            operation_id=receipt_id,
            action=ActionEnum.validated,
            user_id=current_user.id
        ))
        
        db.commit()
        return get_receipt_by_id(receipt_id, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{receipt_id}/cancel", response_model=SingleReceiptResponse)
def cancel_receipt(
    receipt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can cancel receipts")

    db_receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not db_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    if db_receipt.status == StatusEnum.done:
        raise HTTPException(status_code=400, detail="Cannot cancel a receipt that is already done.")
    
    if db_receipt.status == StatusEnum.cancelled:
        raise HTTPException(status_code=400, detail="Receipt is already cancelled.")

    db_receipt.status = StatusEnum.cancelled
    
    db.add(OperationLog(
        operation_type=MoveTypeEnum.receipt,
        operation_id=receipt_id,
        action=ActionEnum.cancelled,
        user_id=current_user.id
    ))
    
    db.commit()
    
    return get_receipt_by_id(receipt_id, db)

def get_receipt_by_id(receipt_id: int, db: Session):
    receipt = db.query(Receipt, Warehouse.name.label("warehouse_name"))\
        .outerjoin(Warehouse, Receipt.warehouse_id == Warehouse.id)\
        .filter(Receipt.id == receipt_id).first()
        
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
        
    db_receipt = receipt.Receipt
    wh_name = receipt.warehouse_name
        
    lines = db.query(ReceiptLine, Product.name.label("product_name"), Location.name.label("location_name"))\
        .join(Product, ReceiptLine.product_id == Product.id)\
        .outerjoin(Location, ReceiptLine.location_id == Location.id)\
        .filter(ReceiptLine.receipt_id == receipt_id).all()
        
    r_dict = {
        "id": db_receipt.id,
        "reference": db_receipt.reference,
        "supplier": db_receipt.supplier,
        "scheduled_date": db_receipt.scheduled_date,
        "status": db_receipt.status,
        "warehouse_id": db_receipt.warehouse_id,
        "warehouse_name": wh_name,
        "created_at": db_receipt.created_at,
        "lines": [
            {
                "id": l[0].id,
                "receipt_id": l[0].receipt_id,
                "product_id": l[0].product_id,
                "location_id": l[0].location_id,
                "quantity": l[0].quantity,
                "product_name": l[1],
                "location_name": l[2]
            } for l in lines
        ]
    }
    return {"success": True, "data": r_dict, "message": "Receipt retrieved"}
