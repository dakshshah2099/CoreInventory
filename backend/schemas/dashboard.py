from pydantic import BaseModel
from typing import List
from backend.schemas.auth import BaseResponse

class LowStockProduct(BaseModel):
    id: int
    name: str
    sku: str
    on_hand: int
    reorder_level: int

class DashboardStats(BaseModel):
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    pending_receipts: int
    pending_deliveries: int
    late_receipts: int
    operating_receipts: int
    waiting_receipts: int
    late_deliveries: int
    operating_deliveries: int
    waiting_deliveries: int
    low_stock_products: List[LowStockProduct] = []

class DashboardStatsResponse(BaseResponse):
    data: DashboardStats
