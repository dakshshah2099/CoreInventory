import os
import sys
from sqlalchemy.orm import Session
from passlib.context import CryptContext

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.db.database import engine, SessionLocal, Base
from backend.models.models import User, RoleEnum

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def reset_db_and_seed():
    print("Dropping all existing tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Recreating all tables with updated schema...")
    Base.metadata.create_all(bind=engine)
    
    print("Seeding Super Manager...")
    db = SessionLocal()
    try:
        # Create super manager
        super_admin = User(
            name="Super Admin",
            email="super@admin.com",
            password_hash=pwd_context.hash("admin123"),
            role=RoleEnum.manager,
            is_super_manager=True,
            is_approved=True 
        )
        db.add(super_admin)
        
        # Create regular manager
        manager = User(
            name="General Manager",
            email="manager@admin.com",
            password_hash=pwd_context.hash("manager123"),
            role=RoleEnum.manager,
            is_super_manager=False,
            is_approved=True 
        )
        db.add(manager)
        
        # Create staff user
        staff = User(
            name="Staff User",
            email="staff@admin.com",
            password_hash=pwd_context.hash("staff123"),
            role=RoleEnum.staff,
            is_super_manager=False,
            is_approved=True 
        )
        db.add(staff)
        
        db.commit()
        print("Successfully seeded users:")
        print("- Super Manager: super@admin.com / admin123")
        print("- Manager: manager@admin.com / manager123")
        print("- Staff: staff@admin.com / staff123")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_db_and_seed()
