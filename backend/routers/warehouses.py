from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.db.database import get_db
from backend.models.models import Warehouse, Location, User
from backend.routers.auth import get_current_user
from backend.schemas.warehouses import (
    WarehouseCreate, WarehouseUpdate, LocationCreate,
    WarehouseListResponse, SingleWarehouseResponse,
    LocationListResponse, SingleLocationResponse
)

# Combine both prefixes in this file
warehouse_router = APIRouter(prefix="/api/warehouses", tags=["warehouses"])
location_router = APIRouter(prefix="/api/locations", tags=["locations"])

@warehouse_router.get("", response_model=WarehouseListResponse)
def get_warehouses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    warehouses = db.query(Warehouse).all()
    locations = db.query(Location).all()
    
    loc_map = {}
    for loc in locations:
        if loc.warehouse_id not in loc_map:
            loc_map[loc.warehouse_id] = []
        loc_map[loc.warehouse_id].append({
            "id": loc.id,
            "name": loc.name,
            "short_code": loc.short_code,
            "warehouse_id": loc.warehouse_id
        })
        
    results = []
    for wh in warehouses:
        results.append({
            "id": wh.id,
            "name": wh.name,
            "short_code": wh.short_code,
            "address": wh.address,
            "created_at": wh.created_at,
            "locations": loc_map.get(wh.id, [])
        })
        
    return {"success": True, "data": results, "message": "Warehouses retrieved"}

@warehouse_router.post("", response_model=SingleWarehouseResponse)
def create_warehouse(
    warehouse: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create warehouses")

    db_wh = Warehouse(**warehouse.dict())
    db.add(db_wh)
    db.commit()
    db.refresh(db_wh)
    
    wh_dict = {
        "id": db_wh.id,
        "name": db_wh.name,
        "short_code": db_wh.short_code,
        "address": db_wh.address,
        "created_at": db_wh.created_at,
        "locations": []
    }
    
    return {"success": True, "data": wh_dict, "message": "Warehouse created"}

@warehouse_router.put("/{warehouse_id}", response_model=SingleWarehouseResponse)
def update_warehouse(
    warehouse_id: int,
    warehouse_update: WarehouseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can update warehouses")

    db_wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not db_wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
        
    update_data = warehouse_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_wh, key, value)
        
    db.commit()
    db.refresh(db_wh)
    
    locations = db.query(Location).filter(Location.warehouse_id == warehouse_id).all()
    loc_list = [{"id": l.id, "name": l.name, "short_code": l.short_code, "warehouse_id": l.warehouse_id} for l in locations]
    
    wh_dict = {
        "id": db_wh.id,
        "name": db_wh.name,
        "short_code": db_wh.short_code,
        "address": db_wh.address,
        "created_at": db_wh.created_at,
        "locations": loc_list
    }
    
    return {"success": True, "data": wh_dict, "message": "Warehouse updated"}

@warehouse_router.get("/{warehouse_id}/locations", response_model=LocationListResponse)
def get_warehouse_locations(
    warehouse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    locations = db.query(Location).filter(Location.warehouse_id == warehouse_id).all()
    loc_list = [{"id": l.id, "name": l.name, "short_code": l.short_code, "warehouse_id": l.warehouse_id} for l in locations]
    
    return {"success": True, "data": loc_list, "message": "Locations retrieved"}

@location_router.post("", response_model=SingleLocationResponse)
def create_location(
    location: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create locations")

    # Verify warehouse exists
    wh = db.query(Warehouse).filter(Warehouse.id == location.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
        
    db_loc = Location(**location.dict())
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    
    loc_dict = {
        "id": db_loc.id,
        "name": db_loc.name,
        "short_code": db_loc.short_code,
        "warehouse_id": db_loc.warehouse_id
    }
    
    return {"success": True, "data": loc_dict, "message": "Location created"}
