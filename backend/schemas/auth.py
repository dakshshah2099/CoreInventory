from pydantic import BaseModel, EmailStr
from typing import Any, Optional
from backend.models.models import RoleEnum

class BaseResponse(BaseModel):
    success: bool
    data: Any = {}
    message: str

class SignupInitRequest(BaseModel):
    email: EmailStr

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.staff
    session_id: str
    otp: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPRequest(BaseModel):
    session_id: str
    otp: str

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str
