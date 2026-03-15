from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Enum, Date, Index, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.db.database import Base
import enum

class RoleEnum(str, enum.Enum):
    manager = "manager"
    staff = "staff"

class StatusEnum(str, enum.Enum):
    draft = "draft"
    waiting = "waiting"
    ready = "ready"
    done = "done"
    cancelled = "cancelled"

class MoveTypeEnum(str, enum.Enum):
    receipt = "receipt"
    delivery = "delivery"
    transfer = "transfer"
    adjustment = "adjustment"

class ActionEnum(str, enum.Enum):
    created = "created"
    validated = "validated"
    cancelled = "cancelled"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100))
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.staff)
    is_super_manager = Column(Boolean, default=False)
    is_approved = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    short_code = Column(String(20), unique=True)
    address = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Location(Base):
    __tablename__ = "locations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    short_code = Column(String(20))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"))

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    sku = Column(String(100), unique=True, nullable=False)
    category = Column(String(100))
    unit_of_measure = Column(String(50))
    reorder_level = Column(Integer, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())

class StockLevel(Base):
    __tablename__ = "stock_levels"
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), index=True)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"))
    quantity = Column(Integer, default=0)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    __table_args__ = (UniqueConstraint('product_id', 'location_id', name='uix_product_location'),)

class Receipt(Base):
    __tablename__ = "receipts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    reference = Column(String(100))
    supplier = Column(String(150))
    scheduled_date = Column(Date)
    status = Column(Enum(StatusEnum), default=StatusEnum.draft, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)

class ReceiptLine(Base):
    __tablename__ = "receipt_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id"))
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    quantity = Column(Integer, nullable=False)

class Delivery(Base):
    __tablename__ = "deliveries"
    id = Column(Integer, primary_key=True, autoincrement=True)
    reference = Column(String(100))
    customer = Column(String(150))
    scheduled_date = Column(Date)
    status = Column(Enum(StatusEnum), default=StatusEnum.draft, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)

class DeliveryLine(Base):
    __tablename__ = "delivery_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    delivery_id = Column(Integer, ForeignKey("deliveries.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id"))
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    quantity = Column(Integer, nullable=False)

class InternalTransfer(Base):
    __tablename__ = "internal_transfers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    reference = Column(String(100))
    source_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    destination_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    scheduled_date = Column(Date)
    status = Column(Enum(StatusEnum), default=StatusEnum.draft, index=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)

class InternalTransferLine(Base):
    __tablename__ = "internal_transfer_lines"
    id = Column(Integer, primary_key=True, autoincrement=True)
    internal_transfer_id = Column(Integer, ForeignKey("internal_transfers.id", ondelete="CASCADE"))
    product_id = Column(Integer, ForeignKey("products.id"))
    source_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    destination_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    quantity = Column(Integer, nullable=False)

class StockMove(Base):
    __tablename__ = "stock_moves"
    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("products.id"), index=True)
    from_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    to_location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    move_type = Column(Enum(MoveTypeEnum))
    reference_id = Column(Integer, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)

class OTPStore(Base):
    __tablename__ = "otp_store"
    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String(150), index=True)
    otp = Column(String(10))
    session_id = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.now())
    expires_at = Column(TIMESTAMP)

class OperationLog(Base):
    __tablename__ = "operation_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    operation_type = Column(Enum(MoveTypeEnum), nullable=False) # receipt or delivery
    operation_id = Column(Integer, nullable=False)
    action = Column(Enum(ActionEnum), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(TIMESTAMP, server_default=func.now(), index=True)
    
    # Optional relationship shortcut to fetch user name
    user = relationship("User")
