from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_db
from backend.models.models import User, RoleEnum, StockLevel, StockMove, MoveTypeEnum, Product, Location
from backend.routers.auth import get_current_user
from backend.routers.logs import log_operation

router = APIRouter(prefix="/api/adjustments", tags=["adjustments"])

class AdjustmentRequest(BaseModel):
    product_id: int
    location_id: int
    new_quantity: int
    reason: Optional[str] = None

class AdjustmentResponse(BaseModel):
    success: bool
    message: str
    previous_quantity: int
    new_quantity: int

@router.post("", response_model=AdjustmentResponse)
def create_adjustment(
    req: AdjustmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only managers can adjust stock
    if current_user.role != RoleEnum.manager:
        raise HTTPException(status_code=403, detail="Only managers can perform stock adjustments.")

    if req.new_quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative.")

    # Validate product and location exist
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    location = db.query(Location).filter(Location.id == req.location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found.")

    # Get or create stock level
    stock = db.query(StockLevel).filter(
        StockLevel.product_id == req.product_id,
        StockLevel.location_id == req.location_id
    ).first()

    previous_quantity = 0
    if stock:
        previous_quantity = stock.quantity
        stock.quantity = req.new_quantity
    else:
        stock = StockLevel(
            product_id=req.product_id,
            location_id=req.location_id,
            quantity=req.new_quantity
        )
        db.add(stock)

    # Calculate the delta for the move record
    delta = req.new_quantity - previous_quantity

    # Create a stock move record for audit
    if delta != 0:
        move = StockMove(
            product_id=req.product_id,
            from_location_id=req.location_id if delta < 0 else None,
            to_location_id=req.location_id if delta > 0 else None,
            quantity=abs(delta),
            move_type=MoveTypeEnum.adjustment,
            reference_id=None
        )
        db.add(move)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    # Log the operation
    log_operation(db, "adjustment", stock.id, "validated", current_user.id)

    return AdjustmentResponse(
        success=True,
        message=f"Stock adjusted from {previous_quantity} to {req.new_quantity} ({'+' if delta >= 0 else ''}{delta})",
        previous_quantity=previous_quantity,
        new_quantity=req.new_quantity
    )

@router.get("/stock")
def get_stock_at_location(
    product_id: int,
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current stock level for a product at a specific location."""
    if current_user.role != RoleEnum.manager:
        raise HTTPException(status_code=403, detail="Only managers can view stock adjustments.")

    stock = db.query(StockLevel).filter(
        StockLevel.product_id == product_id,
        StockLevel.location_id == location_id
    ).first()

    return {
        "success": True,
        "quantity": stock.quantity if stock else 0
    }
