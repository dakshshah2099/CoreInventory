from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from backend.db.database import get_db
from backend.models.models import Product, StockLevel, Location, Warehouse, User
from backend.routers.auth import get_current_user
from backend.schemas.products import (
    ProductCreate, ProductUpdate, ProductResponse, 
    ProductListResponse, SingleProductResponse, ProductStockResponse
)

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("", response_model=ProductListResponse)
def get_products(
    low_stock: bool = Query(False),
    out_of_stock: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(
        Product, 
        func.coalesce(func.sum(StockLevel.quantity), 0).label("on_hand")
    ).outerjoin(StockLevel, Product.id == StockLevel.product_id).group_by(Product.id)
    
    results = query.all()
    
    products_with_stock = []
    for product, on_hand in results:
        p_dict = {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "category": product.category,
            "unit_of_measure": product.unit_of_measure,
            "reorder_level": product.reorder_level,
            "created_at": product.created_at,
            "on_hand": int(on_hand)
        }
        if low_stock:
            if 0 < p_dict["on_hand"] < 100:
                products_with_stock.append(p_dict)
        elif out_of_stock:
            if p_dict["on_hand"] == 0:
                products_with_stock.append(p_dict)
        else:
            products_with_stock.append(p_dict)
            
    return {"success": True, "data": products_with_stock, "message": "Products retrieved"}

@router.post("", response_model=SingleProductResponse)
def create_product(
    product: ProductCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create products")

    db_product = Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    p_dict = {
        "id": db_product.id,
        "name": db_product.name,
        "sku": db_product.sku,
        "category": db_product.category,
        "unit_of_measure": db_product.unit_of_measure,
        "reorder_level": db_product.reorder_level,
        "created_at": db_product.created_at,
        "on_hand": 0
    }
    
    return {"success": True, "data": p_dict, "message": "Product created"}

@router.put("/{product_id}", response_model=SingleProductResponse)
def update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can update products")

    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    update_data = product_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    
    on_hand = db.query(func.coalesce(func.sum(StockLevel.quantity), 0)).filter(StockLevel.product_id == product_id).scalar()
    
    p_dict = {
        "id": db_product.id,
        "name": db_product.name,
        "sku": db_product.sku,
        "category": db_product.category,
        "unit_of_measure": db_product.unit_of_measure,
        "reorder_level": db_product.reorder_level,
        "created_at": db_product.created_at,
        "on_hand": int(on_hand)
    }
    
    return {"success": True, "data": p_dict, "message": "Product updated"}

@router.get("/{product_id}/stock", response_model=ProductStockResponse)
def get_product_stock(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(StockLevel, Location, Warehouse)\
        .join(Location, StockLevel.location_id == Location.id)\
        .join(Warehouse, Location.warehouse_id == Warehouse.id)\
        .filter(StockLevel.product_id == product_id)
        
    results = query.all()
    
    stock_breakdown = []
    for stock_level, location, warehouse in results:
        stock_breakdown.append({
            "location_id": location.id,
            "location_name": location.name,
            "warehouse_name": warehouse.name,
            "quantity": stock_level.quantity
        })
        
    return {"success": True, "data": stock_breakdown, "message": "Product stock retrieved"}
