from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.models.models import MoveTypeEnum
from backend.schemas.auth import BaseResponse

class StockMoveResponse(BaseModel):
    id: int
    created_at: datetime
    product_name: str
    from_location_name: Optional[str] = None
    to_location_name: Optional[str] = None
    quantity: int
    move_type: MoveTypeEnum
    reference_id: Optional[int] = None

class StockMoveListResponse(BaseResponse):
    data: List[StockMoveResponse]
