from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List

from backend.db.database import get_db
from backend.models.models import OperationLog, User
from backend.routers.auth import get_current_user
from backend.schemas.logs import LogListResponse, LogResponse

router = APIRouter(prefix="/api/logs", tags=["logs"])

@router.get("", response_model=LogListResponse)
def get_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch logs joined with the User table to easily extract the user's name
    logs = db.query(OperationLog, User.name.label("user_name"))\
        .join(User, OperationLog.user_id == User.id)\
        .order_by(desc(OperationLog.timestamp))\
        .limit(100)\
        .all()
        
    log_responses = []
    for log, uname in logs:
        log_responses.append({
            "id": log.id,
            "operation_type": log.operation_type,
            "operation_id": log.operation_id,
            "action": log.action,
            "user_name": uname,
            "timestamp": log.timestamp
        })
        
    return {"success": True, "data": log_responses, "message": "Logs retrieved successfully"}

def log_operation(db: Session, operation_type: str, operation_id: int, action: str, user_id: int):
    try:
        new_log = OperationLog(
            operation_type=operation_type,
            operation_id=operation_id,
            action=action,
            user_id=user_id
        )
        db.add(new_log)
        db.commit()
    except Exception as e:
        print(f"Failed to log operation: {e}")
        db.rollback()
