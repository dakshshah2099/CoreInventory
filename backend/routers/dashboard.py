from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from backend.db.database import get_db
from backend.models.models import Product, StockLevel, Receipt, Delivery, StatusEnum, User
from backend.routers.auth import get_current_user
from backend.schemas.dashboard import DashboardStatsResponse

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_products = db.query(Product).count()
    
    # Calculate stock aggregates
    products_stock = db.query(
        Product.id,
        Product.reorder_level,
        func.coalesce(func.sum(StockLevel.quantity), 0).label("total_quantity")
    ).outerjoin(StockLevel, Product.id == StockLevel.product_id).group_by(Product.id).all()
    
    low_stock = sum(1 for p in products_stock if p.reorder_level > 0 and 0 < p.total_quantity <= p.reorder_level)
    out_of_stock = sum(1 for p in products_stock if p.total_quantity == 0)
    
    # Build the low stock product details list
    low_stock_products_list = []
    for ps in products_stock:
        if ps.reorder_level > 0 and 0 < ps.total_quantity <= ps.reorder_level:
            prod = db.query(Product).filter(Product.id == ps.id).first()
            if prod:
                low_stock_products_list.append({
                    "id": prod.id,
                    "name": prod.name,
                    "sku": prod.sku,
                    "on_hand": ps.total_quantity,
                    "reorder_level": ps.reorder_level
                })
    
    pending_statuses = [StatusEnum.draft, StatusEnum.waiting, StatusEnum.ready]
    
    pending_receipts = db.query(Receipt).filter(Receipt.status.in_(pending_statuses)).count()
    pending_deliveries = db.query(Delivery).filter(Delivery.status.in_(pending_statuses)).count()
    
    today = date.today()
    
    late_receipts = db.query(Receipt).filter(Receipt.status.in_(pending_statuses), Receipt.scheduled_date < today).count()
    operating_receipts = db.query(Receipt).filter(Receipt.status == StatusEnum.ready).count()
    waiting_receipts = db.query(Receipt).filter(Receipt.status == StatusEnum.waiting).count()
    
    late_deliveries = db.query(Delivery).filter(Delivery.status.in_(pending_statuses), Delivery.scheduled_date < today).count()
    operating_deliveries = db.query(Delivery).filter(Delivery.status == StatusEnum.ready).count()
    waiting_deliveries = db.query(Delivery).filter(Delivery.status == StatusEnum.waiting).count()
    
    stats_data = {
        "total_products": total_products,
        "low_stock_count": low_stock,
        "out_of_stock_count": out_of_stock,
        "pending_receipts": pending_receipts,
        "pending_deliveries": pending_deliveries,
        "late_receipts": late_receipts,
        "operating_receipts": operating_receipts,
        "waiting_receipts": waiting_receipts,
        "late_deliveries": late_deliveries,
        "operating_deliveries": operating_deliveries,
        "waiting_deliveries": waiting_deliveries,
        "low_stock_products": low_stock_products_list
    }
    
    return {"success": True, "data": stats_data, "message": "Dashboard stats retrieved"}
