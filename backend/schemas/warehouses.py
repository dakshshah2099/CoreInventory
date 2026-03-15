from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.schemas.auth import BaseResponse

class LocationBase(BaseModel):
    name: str
    short_code: Optional[str] = None

class LocationCreate(LocationBase):
    warehouse_id: int

class LocationResponse(LocationBase):
    id: int
    warehouse_id: int

    class Config:
        from_attributes = True

class WarehouseBase(BaseModel):
    name: str
    short_code: Optional[str] = None
    address: Optional[str] = None

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    short_code: Optional[str] = None
    address: Optional[str] = None

class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    locations: List[LocationResponse] = []

    class Config:
        from_attributes = True

class WarehouseListResponse(BaseResponse):
    data: List[WarehouseResponse]

class SingleWarehouseResponse(BaseResponse):
    data: WarehouseResponse

class LocationListResponse(BaseResponse):
    data: List[LocationResponse]

class SingleLocationResponse(BaseResponse):
    data: LocationResponse
