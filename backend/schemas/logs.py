from pydantic import BaseModel
from datetime import datetime
from typing import List

class LogResponse(BaseModel):
    id: int
    operation_type: str
    operation_id: int
    action: str
    user_name: str
    timestamp: datetime

    class Config:
        orm_mode = True

class LogListResponse(BaseModel):
    success: bool
    data: List[LogResponse]
    message: str
