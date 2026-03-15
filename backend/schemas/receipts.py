from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from backend.models.models import StatusEnum
from backend.schemas.auth import BaseResponse

class ReceiptLineBase(BaseModel):
    product_id: int
    quantity: int
    location_id: int

class ReceiptLineCreate(ReceiptLineBase):
    pass

class ReceiptLineResponse(ReceiptLineBase):
    id: int
    receipt_id: int
    product_name: Optional[str] = None
    location_name: Optional[str] = None

    class Config:
        from_attributes = True

class ReceiptBase(BaseModel):
    reference: Optional[str] = None
    supplier: Optional[str] = None
    scheduled_date: Optional[date] = None

class ReceiptCreate(ReceiptBase):
    warehouse_id: int
    lines: List[ReceiptLineCreate]

class ReceiptUpdate(ReceiptBase):
    status: Optional[StatusEnum] = None
    warehouse_id: Optional[int] = None
    lines: Optional[List[ReceiptLineCreate]] = None

class ReceiptResponse(ReceiptBase):
    id: int
    status: StatusEnum
    created_at: datetime
    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    lines: List[ReceiptLineResponse] = []
    line_count: Optional[int] = None

    class Config:
        from_attributes = True

class ReceiptListResponse(BaseResponse):
    data: List[ReceiptResponse]

class SingleReceiptResponse(BaseResponse):
    data: ReceiptResponse
