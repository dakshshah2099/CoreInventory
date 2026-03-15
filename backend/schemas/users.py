from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from backend.models.models import RoleEnum
from backend.schemas.auth import BaseResponse

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: RoleEnum
    is_super_manager: bool
    is_approved: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserListResponse(BaseResponse):
    data: List[UserResponse]

class SingleUserResponse(BaseResponse):
    data: UserResponse
