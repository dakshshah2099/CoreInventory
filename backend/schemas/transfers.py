from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime
from backend.models.models import StatusEnum

class InternalTransferLineBase(BaseModel):
    product_id: int
    source_location_id: int
    destination_location_id: int
    quantity: int

class InternalTransferLineCreate(InternalTransferLineBase):
    pass

class InternalTransferLineResponse(InternalTransferLineBase):
    id: int
    internal_transfer_id: int
    
    class Config:
        from_attributes = True

class InternalTransferBase(BaseModel):
    reference: Optional[str] = None
    scheduled_date: Optional[date] = None
    status: Optional[StatusEnum] = StatusEnum.draft
    source_warehouse_id: int
    destination_warehouse_id: int

class InternalTransferCreate(InternalTransferBase):
    lines: List[InternalTransferLineCreate]

class InternalTransferUpdate(BaseModel):
    reference: Optional[str] = None
    scheduled_date: Optional[date] = None
    status: Optional[StatusEnum] = None
    source_warehouse_id: Optional[int] = None
    destination_warehouse_id: Optional[int] = None
    lines: Optional[List[InternalTransferLineCreate]] = None

class InternalTransferResponse(InternalTransferBase):
    id: int
    created_at: datetime
    lines: List[InternalTransferLineResponse] = []
    
    # Helper properties for UI
    source_warehouse_name: Optional[str] = None
    destination_warehouse_name: Optional[str] = None
    line_count: Optional[int] = 0
    
    class Config:
        from_attributes = True
