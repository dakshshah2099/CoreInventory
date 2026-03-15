from pydantic import BaseModel, field_validator
import re
from typing import Optional, List
from datetime import datetime
from backend.schemas.auth import BaseResponse

class ProductBase(BaseModel):
    name: str
    sku: str
    category: Optional[str] = None
    unit_of_measure: Optional[str] = None
    reorder_level: int = 0

    @field_validator('sku')
    @classmethod
    def sku_must_be_6_digits(cls, v):
        if not re.fullmatch(r'\d{6}', v):
            raise ValueError('SKU must be exactly 6 digits')
        return v

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: Optional[str] = None
    reorder_level: Optional[int] = None

    @field_validator('sku')
    @classmethod
    def sku_must_be_6_digits(cls, v):
        if v is not None and not re.fullmatch(r'\d{6}', v):
            raise ValueError('SKU must be exactly 6 digits')
        return v

class ProductResponse(ProductBase):
    id: int
    created_at: datetime
    on_hand: int = 0

    class Config:
        from_attributes = True

class StockLocationBreakdown(BaseModel):
    location_id: int
    location_name: str
    warehouse_name: str
    quantity: int

class ProductListResponse(BaseResponse):
    data: List[ProductResponse]

class SingleProductResponse(BaseResponse):
    data: ProductResponse

class ProductStockResponse(BaseResponse):
    data: List[StockLocationBreakdown]
