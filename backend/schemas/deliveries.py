from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from backend.models.models import StatusEnum
from backend.schemas.auth import BaseResponse

class DeliveryLineBase(BaseModel):
    product_id: int
    quantity: int
    location_id: int

class DeliveryLineCreate(DeliveryLineBase):
    pass

class DeliveryLineResponse(DeliveryLineBase):
    id: int
    delivery_id: int
    product_name: Optional[str] = None
    location_name: Optional[str] = None

    class Config:
        from_attributes = True

class DeliveryBase(BaseModel):
    reference: Optional[str] = None
    customer: Optional[str] = None
    scheduled_date: Optional[date] = None

class DeliveryCreate(DeliveryBase):
    warehouse_id: int
    lines: List[DeliveryLineCreate]

class DeliveryUpdate(DeliveryBase):
    status: Optional[StatusEnum] = None
    warehouse_id: Optional[int] = None
    lines: Optional[List[DeliveryLineCreate]] = None

class DeliveryResponse(DeliveryBase):
    id: int
    status: StatusEnum
    created_at: datetime
    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    lines: List[DeliveryLineResponse] = []
    line_count: Optional[int] = None

    class Config:
        from_attributes = True

class DeliveryListResponse(BaseResponse):
    data: List[DeliveryResponse]

class SingleDeliveryResponse(BaseResponse):
    data: DeliveryResponse
