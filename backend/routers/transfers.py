from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from backend.db.database import get_db
from backend.models.models import (
    InternalTransfer, InternalTransferLine, StockLevel, StockMove, MoveTypeEnum, ActionEnum, Warehouse, Location
)
from backend.schemas.transfers import (
    InternalTransferCreate, InternalTransferUpdate, InternalTransferResponse
)
from backend.schemas.auth import BaseResponse
from backend.routers.auth import get_current_user
from backend.routers.logs import log_operation

router = APIRouter(prefix="/api/transfers", tags=["transfers"])

@router.get("", response_model=BaseResponse)
def list_transfers(
    skip: int = 0, 
    limit: int = 100, 
    status: str = None, 
    search: str = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(InternalTransfer)
    
    if status:
        query = query.filter(InternalTransfer.status == status)
    if search:
        query = query.filter(InternalTransfer.reference.ilike(f"%{search}%"))
        
    transfers = query.order_by(InternalTransfer.created_at.desc()).offset(skip).limit(limit).all()
    
    results = []
    for t in transfers:
        src_wh = db.query(Warehouse).filter(Warehouse.id == t.source_warehouse_id).first()
        dest_wh = db.query(Warehouse).filter(Warehouse.id == t.destination_warehouse_id).first()
        
        lines_count = db.query(InternalTransferLine).filter(InternalTransferLine.internal_transfer_id == t.id).count()
        
        t_dict = {
            "id": t.id,
            "reference": t.reference,
            "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
            "status": t.status,
            "source_warehouse_id": t.source_warehouse_id,
            "destination_warehouse_id": t.destination_warehouse_id,
            "source_warehouse_name": src_wh.name if src_wh else None,
            "destination_warehouse_name": dest_wh.name if dest_wh else None,
            "line_count": lines_count,
            "created_at": t.created_at.isoformat()
        }
        results.append(t_dict)
        
    return BaseResponse(success=True, data=results, message="Transfers retrieved")

@router.post("", response_model=BaseResponse)
def create_transfer(
    transfer_in: InternalTransferCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create transfers")
        
    new_transfer = InternalTransfer(
        reference=transfer_in.reference,
        scheduled_date=transfer_in.scheduled_date,
        status=transfer_in.status,
        source_warehouse_id=transfer_in.source_warehouse_id,
        destination_warehouse_id=transfer_in.destination_warehouse_id
    )
    db.add(new_transfer)
    db.flush() # get id
    
    if not new_transfer.reference:
        new_transfer.reference = f"INT/{new_transfer.id:05d}"
        
    for line in transfer_in.lines:
        new_line = InternalTransferLine(
            internal_transfer_id=new_transfer.id,
            product_id=line.product_id,
            source_location_id=line.source_location_id,
            destination_location_id=line.destination_location_id,
            quantity=line.quantity
        )
        db.add(new_line)
        
    db.commit()
    db.refresh(new_transfer)
    log_operation(db, MoveTypeEnum.transfer, new_transfer.id, ActionEnum.created, current_user.id)
    
    return BaseResponse(success=True, data={"id": new_transfer.id}, message="Transfer created successfully")

@router.get("/{transfer_id}", response_model=BaseResponse)
def get_transfer_by_id(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    t = db.query(InternalTransfer).filter(InternalTransfer.id == transfer_id).first()
    if not t:
        return BaseResponse(success=False, message="Transfer not found")
        
    src_wh = db.query(Warehouse).filter(Warehouse.id == t.source_warehouse_id).first()
    dest_wh = db.query(Warehouse).filter(Warehouse.id == t.destination_warehouse_id).first()
    
    lines = db.query(InternalTransferLine).filter(InternalTransferLine.internal_transfer_id == t.id).all()
    
    lines_data = []
    for l in lines:
        lines_data.append({
            "id": l.id,
            "product_id": l.product_id,
            "source_location_id": l.source_location_id,
            "destination_location_id": l.destination_location_id,
            "quantity": l.quantity
        })
        
    result = {
        "id": t.id,
        "reference": t.reference,
        "scheduled_date": t.scheduled_date.isoformat() if t.scheduled_date else None,
        "status": t.status,
        "source_warehouse_id": t.source_warehouse_id,
        "destination_warehouse_id": t.destination_warehouse_id,
        "source_warehouse_name": src_wh.name if src_wh else None,
        "destination_warehouse_name": dest_wh.name if dest_wh else None,
        "created_at": t.created_at.isoformat(),
        "lines": lines_data
    }
    
    return BaseResponse(success=True, data=result, message="Transfer details retrieved")

@router.put("/{transfer_id}", response_model=BaseResponse)
def update_transfer(
    transfer_id: int,
    transfer_in: InternalTransferUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can update transfers")
        
    transfer = db.query(InternalTransfer).filter(InternalTransfer.id == transfer_id).first()
    if not transfer:
        return BaseResponse(success=False, message="Transfer not found")
        
    if transfer.status in ["done", "cancelled"]:
        return BaseResponse(success=False, message="Cannot update a processed transfer")
        
    if transfer_in.reference is not None: transfer.reference = transfer_in.reference
    if transfer_in.scheduled_date is not None: transfer.scheduled_date = transfer_in.scheduled_date
    if transfer_in.status is not None: transfer.status = transfer_in.status
    if transfer_in.source_warehouse_id is not None: transfer.source_warehouse_id = transfer_in.source_warehouse_id
    if transfer_in.destination_warehouse_id is not None: transfer.destination_warehouse_id = transfer_in.destination_warehouse_id
    
    if transfer_in.lines is not None:
        db.query(InternalTransferLine).filter(InternalTransferLine.internal_transfer_id == transfer_id).delete()
        for line in transfer_in.lines:
            new_line = InternalTransferLine(
                internal_transfer_id=transfer.id,
                product_id=line.product_id,
                source_location_id=line.source_location_id,
                destination_location_id=line.destination_location_id,
                quantity=line.quantity
            )
            db.add(new_line)
            
    db.commit()
    return BaseResponse(success=True, data={"id": transfer.id}, message="Transfer updated successfully")

@router.put("/{transfer_id}/validate", response_model=BaseResponse)
def validate_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    transfer = db.query(InternalTransfer).filter(InternalTransfer.id == transfer_id).first()
    if not transfer:
        return BaseResponse(success=False, message="Transfer not found")
        
    if transfer.status in ["done", "cancelled"]:
        return BaseResponse(success=False, message=f"Transfer is already {transfer.status}")
        
    lines = db.query(InternalTransferLine).filter(InternalTransferLine.internal_transfer_id == transfer.id).all()
    if not lines:
        return BaseResponse(success=False, message="Cannot validate a transfer with no lines")
        
    # Aggregate net changes per (product, location)
    location_deltas = {} # (product_id, location_id) -> net_change (+ or -)
    for line in lines:
        if not line.source_location_id or not line.destination_location_id:
            return BaseResponse(success=False, message="Source and Destination locations must be set for all lines.")
            
        src_key = (line.product_id, line.source_location_id)
        location_deltas[src_key] = location_deltas.get(src_key, 0) - line.quantity
        
        dest_key = (line.product_id, line.destination_location_id)
        location_deltas[dest_key] = location_deltas.get(dest_key, 0) + line.quantity

    # First, verify we have enough stock in all source locations
    for (prod_id, loc_id), delta in location_deltas.items():
        if delta < 0: # This is a reduction
            stock = db.query(StockLevel).filter(
                StockLevel.product_id == prod_id,
                StockLevel.location_id == loc_id
            ).with_for_update().first()
            
            if not stock or stock.quantity < abs(delta):
                return BaseResponse(success=False, message=f"Insufficient stock for Product ID {prod_id} at Location ID {loc_id}")
                
    # Now that we passed validation, apply the changes
    for (prod_id, loc_id), delta in location_deltas.items():
        stock = db.query(StockLevel).filter(
            StockLevel.product_id == prod_id,
            StockLevel.location_id == loc_id
        ).with_for_update().first()
        
        if stock:
            stock.quantity += delta
        else:
            if delta > 0:
                stock = StockLevel(product_id=prod_id, location_id=loc_id, quantity=delta)
                db.add(stock)

    # Record distinct StockMoves for each line
    for line in lines:
        move = StockMove(
            product_id=line.product_id,
            from_location_id=line.source_location_id,
            to_location_id=line.destination_location_id,
            quantity=line.quantity,
            move_type=MoveTypeEnum.transfer,
            reference_id=transfer.id
        )
        db.add(move)
        
    transfer.status = "done"
    db.commit()
    log_operation(db, MoveTypeEnum.transfer, transfer.id, ActionEnum.validated, current_user.id)
    
    return BaseResponse(success=True, data={"id": transfer.id}, message="Transfer validated successfully")

@router.put("/{transfer_id}/cancel", response_model=BaseResponse)
def cancel_transfer(
    transfer_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can cancel transfers")
        
    transfer = db.query(InternalTransfer).filter(InternalTransfer.id == transfer_id).first()
    if not transfer:
        return BaseResponse(success=False, message="Transfer not found")
        
    if transfer.status in ["done", "cancelled"]:
        return BaseResponse(success=False, message=f"Transfer is already {transfer.status}")
        
    transfer.status = "cancelled"
    db.commit()
    log_operation(db, MoveTypeEnum.transfer, transfer.id, ActionEnum.cancelled, current_user.id)
    
    return BaseResponse(success=True, data={"id": transfer.id}, message="Transfer cancelled")
