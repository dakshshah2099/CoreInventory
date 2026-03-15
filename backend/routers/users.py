from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.db.database import get_db
from backend.models.models import User, RoleEnum
from backend.routers.auth import get_current_user
from backend.schemas.users import UserListResponse, SingleUserResponse
from backend.schemas.auth import BaseResponse

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/pending", response_model=UserListResponse)
def get_pending_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != RoleEnum.manager:
        raise HTTPException(status_code=403, detail="Only managers can view pending accounts.")
        
    query = db.query(User).filter(User.is_approved == False)
    
    if current_user.is_super_manager:
        # Super manager sees everyone pending
        users = query.all()
    else:
        # Regular manager sees only pending staff
        users = query.filter(User.role == RoleEnum.staff).all()
        
    return {"success": True, "data": users, "message": "Pending users retrieved"}

@router.put("/{user_id}/approve", response_model=SingleUserResponse)
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != RoleEnum.manager:
        raise HTTPException(status_code=403, detail="Only managers can approve accounts.")
        
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.is_approved:
        raise HTTPException(status_code=400, detail="User is already approved")
        
    # Check approval matrix matrix
    if target_user.role == RoleEnum.manager and not current_user.is_super_manager:
        raise HTTPException(status_code=403, detail="Only Super Managers can approve Manager accounts.")
        
    target_user.is_approved = True
    db.commit()
    db.refresh(target_user)
    
    return {"success": True, "data": target_user, "message": "User approved successfully"}

@router.delete("/{user_id}/reject", response_model=BaseResponse)
def reject_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != RoleEnum.manager:
        raise HTTPException(status_code=403, detail="Only managers can reject accounts.")
        
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if target_user.is_approved:
        raise HTTPException(status_code=400, detail="Cannot reject an already approved user")
        
    # Check approval matrix
    if target_user.role == RoleEnum.manager and not current_user.is_super_manager:
        raise HTTPException(status_code=403, detail="Only Super Managers can reject Manager accounts.")
        
    db.delete(target_user)
    db.commit()
    
    return BaseResponse(success=True, message="User registration rejected and deleted.")
