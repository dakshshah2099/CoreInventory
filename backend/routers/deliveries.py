from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from typing import Optional
from datetime import date
from collections import defaultdict

from backend.db.database import get_db
from backend.models.models import Delivery, DeliveryLine, Product, StockLevel, StockMove, StatusEnum, User, MoveTypeEnum, OperationLog, ActionEnum, Warehouse, Location
from backend.routers.auth import get_current_user
from backend.schemas.deliveries import DeliveryCreate, DeliveryUpdate, DeliveryListResponse, SingleDeliveryResponse

router = APIRouter(prefix="/api/deliveries", tags=["deliveries"])

@router.get("", response_model=DeliveryListResponse)
def get_deliveries(
    status: Optional[StatusEnum] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        Delivery,
        func.count(DeliveryLine.id).label("line_count"),
        Warehouse.name.label("warehouse_name")
    ).outerjoin(DeliveryLine, Delivery.id == DeliveryLine.delivery_id)\
     .outerjoin(Warehouse, Delivery.warehouse_id == Warehouse.id)

    if status:
        query = query.filter(Delivery.status == status)
    if date_from:
        query = query.filter(func.date(Delivery.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(Delivery.created_at) <= date_to)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Delivery.reference.ilike(search_filter),
                Delivery.customer.ilike(search_filter)
            )
        )

    query = query.group_by(Delivery.id).order_by(desc(Delivery.created_at))
    results = query.all()

    deliveries = []
    for delivery, line_count, loc_name in results:
        d_dict = {
            "id": delivery.id,
            "reference": delivery.reference,
            "customer": delivery.customer,
            "scheduled_date": delivery.scheduled_date,
            "status": delivery.status,
            "warehouse_id": delivery.warehouse_id,
            "warehouse_name": loc_name,
            "created_at": delivery.created_at,
            "line_count": line_count,
            "lines": []
        }
        deliveries.append(d_dict)

    return {"success": True, "data": deliveries, "message": "Deliveries retrieved"}

@router.post("", response_model=SingleDeliveryResponse)
def create_delivery(
    delivery: DeliveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create deliveries")

    # Auto-generate reference if none provided
    ref = delivery.reference
    if not ref:
        count = db.query(Delivery).count() + 1
        ref = f"WH/OUT/{count:05d}"
        
    # Verify Warehouse
    wh = db.query(Warehouse).filter(Warehouse.id == delivery.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=400, detail="Invalid origin warehouse selected")

    db_delivery = Delivery(
        reference=ref,
        customer=delivery.customer,
        scheduled_date=delivery.scheduled_date,
        warehouse_id=delivery.warehouse_id,
        status=StatusEnum.draft
    )
    db.add(db_delivery)
    db.flush()

    for line in delivery.lines:
        db_line = DeliveryLine(
            delivery_id=db_delivery.id,
            product_id=line.product_id,
            location_id=line.location_id,
            quantity=line.quantity
        )
        db.add(db_line)
        
    db.add(OperationLog(
        operation_type=MoveTypeEnum.delivery,
        operation_id=db_delivery.id,
        action=ActionEnum.created,
        user_id=current_user.id
    ))

    db.commit()
    return get_delivery_by_id(db_delivery.id, db)

@router.get("/{delivery_id}", response_model=SingleDeliveryResponse)
def get_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_delivery_by_id(delivery_id, db)

@router.put("/{delivery_id}", response_model=SingleDeliveryResponse)
def update_delivery(
    delivery_id: int,
    update_data: DeliveryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can update deliveries")

    db_delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
        
    if db_delivery.status != StatusEnum.draft:
        raise HTTPException(status_code=400, detail="Only draft deliveries can be modified")

    if update_data.customer is not None:
        db_delivery.customer = update_data.customer
    if update_data.reference is not None:
        db_delivery.reference = update_data.reference
    if update_data.scheduled_date is not None:
        db_delivery.scheduled_date = update_data.scheduled_date
    if update_data.warehouse_id is not None:
        # Verify Warehouse
        wh = db.query(Warehouse).filter(Warehouse.id == update_data.warehouse_id).first()
        if not wh:
            raise HTTPException(status_code=400, detail="Invalid origin warehouse selected")
        db_delivery.warehouse_id = update_data.warehouse_id
    if update_data.status is not None:
        db_delivery.status = update_data.status
        
    if update_data.lines is not None:
        db.query(DeliveryLine).filter(DeliveryLine.delivery_id == delivery_id).delete()
        for line in update_data.lines:
            db_line = DeliveryLine(
                delivery_id=delivery_id,
                product_id=line.product_id,
                location_id=line.location_id,
                quantity=line.quantity
            )
            db.add(db_line)

    db.commit()
    return get_delivery_by_id(delivery_id, db)

@router.put("/{delivery_id}/validate", response_model=SingleDeliveryResponse)
def validate_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        db_delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
        if not db_delivery:
            raise HTTPException(status_code=404, detail="Delivery not found")
            
        if db_delivery.status == StatusEnum.done:
            raise HTTPException(status_code=400, detail="Delivery is already validated")
            
        lines = db.query(DeliveryLine, Product.name.label("product_name"))\
            .join(Product, DeliveryLine.product_id == Product.id)\
            .filter(DeliveryLine.delivery_id == delivery_id).all()
            
        if not lines:
            raise HTTPException(status_code=400, detail="Cannot validate empty delivery")
        
        # Pre-aggregate required quantities
        product_quantities = {}
        for line, _ in lines:
            key = (line.product_id, line.location_id)
            product_quantities[key] = product_quantities.get(key, 0) + line.quantity

        for (product_id, location_id), quantity_to_pull in product_quantities.items():
            if not location_id:
                raise HTTPException(status_code=400, detail="Line missing origin location")
                
            stock = db.query(StockLevel)\
                .filter(StockLevel.product_id == product_id, StockLevel.location_id == location_id).first()
                
            qty_available = stock.quantity if stock else 0    
            if quantity_to_pull > qty_available:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product id {product_id} in selected location")

            if stock and stock.quantity > 0:
                pull_amt = min(stock.quantity, quantity_to_pull)
                stock.quantity -= pull_amt
                quantity_to_pull -= pull_amt
                
                # Insert Stock Move
                move = StockMove(
                    product_id=product_id,
                    from_location_id=location_id,
                    quantity=pull_amt,
                    move_type=MoveTypeEnum.delivery,
                    reference_id=delivery_id
                )
                db.add(move)
                
            if quantity_to_pull > 0:
                 raise HTTPException(status_code=400, detail=f"Stock condition changed during validation for DB ID {product_id}")
                 
        db_delivery.status = StatusEnum.done
        
        db.add(OperationLog(
            operation_type=MoveTypeEnum.delivery,
            operation_id=delivery_id,
            action=ActionEnum.validated,
            user_id=current_user.id
        ))
        
        db.commit()
        
        return get_delivery_by_id(delivery_id, db)
        
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{delivery_id}/cancel", response_model=SingleDeliveryResponse)
def cancel_delivery(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can cancel deliveries")

    db_delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not db_delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
        
    if db_delivery.status == StatusEnum.done:
        raise HTTPException(status_code=400, detail="Cannot cancel a delivery that is already done.")
    
    if db_delivery.status == StatusEnum.cancelled:
        raise HTTPException(status_code=400, detail="Delivery is already cancelled.")

    db_delivery.status = StatusEnum.cancelled
    
    db.add(OperationLog(
        operation_type=MoveTypeEnum.delivery,
        operation_id=delivery_id,
        action=ActionEnum.cancelled,
        user_id=current_user.id
    ))
    
    db.commit()
    
    return get_delivery_by_id(delivery_id, db)

def get_delivery_by_id(delivery_id: int, db: Session):
    delivery = db.query(Delivery, Warehouse.name.label("warehouse_name"))\
        .outerjoin(Warehouse, Delivery.warehouse_id == Warehouse.id)\
        .filter(Delivery.id == delivery_id).first()
        
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
        
    db_delivery = delivery.Delivery
    wh_name = delivery.warehouse_name
        
    lines = db.query(DeliveryLine, Product.name.label("product_name"), Location.name.label("location_name"))\
        .join(Product, DeliveryLine.product_id == Product.id)\
        .outerjoin(Location, DeliveryLine.location_id == Location.id)\
        .filter(DeliveryLine.delivery_id == delivery_id).all()
        
    d_dict = {
        "id": db_delivery.id,
        "reference": db_delivery.reference,
        "customer": db_delivery.customer,
        "scheduled_date": db_delivery.scheduled_date,
        "status": db_delivery.status,
        "warehouse_id": db_delivery.warehouse_id,
        "warehouse_name": wh_name,
        "created_at": db_delivery.created_at,
        "lines": [
            {
                "id": l[0].id,
                "delivery_id": l[0].delivery_id,
                "product_id": l[0].product_id,
                "location_id": l[0].location_id,
                "quantity": l[0].quantity,
                "product_name": l[1],
                "location_name": l[2]
            } for l in lines
        ]
    }
    return {"success": True, "data": d_dict, "message": "Delivery retrieved"}
