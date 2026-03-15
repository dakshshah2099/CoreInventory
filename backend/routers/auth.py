from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import uuid
import random
from jose import JWTError, jwt
from passlib.context import CryptContext

from backend.db.database import get_db
from backend.models.models import User, OTPStore
from backend.schemas.auth import (
    SignupRequest, SignupInitRequest, LoginRequest, ForgotPasswordRequest, 
    VerifyOTPRequest, ResetPasswordRequest, BaseResponse
)
from backend.utils.email import send_otp_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super_secret_for_development_only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise JWTError()
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

@router.post("/signup-init", response_model=BaseResponse)
def signup_init(request: SignupInitRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == request.email).first()
    if db_user:
        return BaseResponse(success=False, message="Email already registered")
        
    otp = str(random.randint(100000, 999999))
    session_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    otp_record = OTPStore(
        mobile=request.email, # Reusing mobile field for email
        otp=otp,
        session_id=session_id,
        created_at=datetime.utcnow(),
        expires_at=expires_at
    )
    db.add(otp_record)
    db.commit()
    
    send_otp_email(request.email, otp, "Account Verification")
    
    return BaseResponse(
        success=True,
        data={"session_id": session_id},
        message="OTP sent to email"
    )

@router.post("/signup", response_model=BaseResponse)
def signup(request: SignupRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == request.email).first()
    if db_user:
        return BaseResponse(success=False, message="Email already registered")
        
    otp_record = db.query(OTPStore).filter(
        OTPStore.session_id == request.session_id,
        OTPStore.mobile == request.email
    ).first()
    
    if not otp_record or otp_record.expires_at < datetime.utcnow():
        return BaseResponse(success=False, message="OTP expired or invalid")
        
    if otp_record.otp != request.otp:
        return BaseResponse(success=False, message="Incorrect OTP")
    
    hashed_password = pwd_context.hash(request.password)
    new_user = User(
        name=request.name,
        email=request.email,
        password_hash=hashed_password,
        role=request.role
    )
    db.add(new_user)
    db.delete(otp_record)
    db.commit()
    db.refresh(new_user)
    
    return BaseResponse(
        success=True, 
        data={
            "user": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email,
                "role": new_user.role,
                "is_super_manager": new_user.is_super_manager,
                "is_approved": new_user.is_approved
            }
        },
        message="User created successfully. Pending manager approval."
    )

@router.post("/login", response_model=BaseResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not pwd_context.verify(request.password, user.password_hash):
        return BaseResponse(success=False, message="Invalid credentials")
        
    if not user.is_approved:
        return BaseResponse(success=False, message="Your account is pending manager approval.")
        
    access_token = create_access_token(data={"sub": str(user.id)})
    return BaseResponse(
        success=True,
        data={
            "token": access_token,
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "is_super_manager": user.is_super_manager,
                "is_approved": user.is_approved
            }
        },
        message="Login successful"
    )

@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        return JSONResponse(
            status_code=200,
            content={"success": True, "data": {"session_id": ""}, "message": "If an account exists, an OTP has been sent."}
        )

    otp = str(random.randint(100000, 999999))
    session_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    otp_record = OTPStore(
        mobile=request.email, # Reusing mobile for email
        otp=otp,
        session_id=session_id,
        created_at=datetime.utcnow(),
        expires_at=expires_at
    )
    db.add(otp_record)
    db.commit()
    
    send_otp_email(request.email, otp, "Password Reset")
    
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "data": {"session_id": session_id},
            "message": "OTP sent to email"
        }
    )

@router.post("/verify-otp")
def verify_otp(request: VerifyOTPRequest, db: Session = Depends(get_db)):
    otp_record = db.query(OTPStore).filter(OTPStore.session_id == request.session_id).first()
    
    if not otp_record or otp_record.expires_at < datetime.utcnow():
        return JSONResponse(status_code=400, content={"success": False, "data": {}, "message": "OTP expired or invalid"})
        
    if otp_record.otp != request.otp:
        return JSONResponse(status_code=400, content={"success": False, "data": {}, "message": "Incorrect OTP"})
        
    # Generate reset token with identifier (using mobile field since it's all we have for identity map here)
    reset_token = create_access_token(
        data={"sub": otp_record.mobile, "purpose": "reset"}, 
        expires_delta=timedelta(minutes=15)
    )
    
    # Store mobile before deleting record
    db.delete(otp_record)
    db.commit()
    
    return JSONResponse(
        status_code=200,
        content={"success": True, "data": {"reset_token": reset_token}, "message": "OTP verified"}
    )

@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(request.reset_token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "reset":
            return JSONResponse(status_code=400, content={"success": False, "data": {}, "message": "Invalid token purpose"})
        identifier = payload.get("sub")
    except JWTError:
        return JSONResponse(status_code=400, content={"success": False, "data": {}, "message": "Invalid or expired token"})
        
    # Now identifier securely holds the requested email
    user = db.query(User).filter(User.email == identifier).first()
    if not user:
        return JSONResponse(status_code=400, content={"success": False, "data": {}, "message": "User not found."})

    user.password_hash = pwd_context.hash(request.new_password)
    db.commit()
    
    return JSONResponse(
        status_code=200,
        content={"success": True, "data": {}, "message": "Password updated"}
    )
