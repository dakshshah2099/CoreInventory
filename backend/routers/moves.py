from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from typing import Optional
from datetime import date
from sqlalchemy.orm import aliased

from backend.db.database import get_db
from backend.models.models import StockMove, Product, Location, User, MoveTypeEnum
from backend.routers.auth import get_current_user
from backend.schemas.moves import StockMoveListResponse

router = APIRouter(prefix="/api/moves", tags=["moves"])

@router.get("", response_model=StockMoveListResponse)
def get_moves(
    move_type: Optional[MoveTypeEnum] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    FromLocation = aliased(Location)
    ToLocation = aliased(Location)
    
    query = db.query(
        StockMove,
        Product.name.label("product_name"),
        FromLocation.name.label("from_location_name"),
        ToLocation.name.label("to_location_name")
    )\
    .join(Product, StockMove.product_id == Product.id)\
    .outerjoin(FromLocation, StockMove.from_location_id == FromLocation.id)\
    .outerjoin(ToLocation, StockMove.to_location_id == ToLocation.id)

    if move_type:
        query = query.filter(StockMove.move_type == move_type)
    if date_from:
        query = query.filter(func.date(StockMove.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(StockMove.created_at) <= date_to)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(Product.name.ilike(search_filter))

    query = query.order_by(desc(StockMove.created_at))
    results = query.all()

    moves = []
    for move, p_name, from_loc, to_loc in results:
        moves.append({
            "id": move.id,
            "created_at": move.created_at,
            "product_name": p_name,
            "from_location_name": from_loc,
            "to_location_name": to_loc,
            "quantity": move.quantity,
            "move_type": move.move_type,
            "reference_id": move.reference_id
        })

    return {"success": True, "data": moves, "message": "Stock moves retrieved"}
