from sqlalchemy import Column, Integer, Float, String, ForeignKey, DateTime, JSON, func, Date
from sqlalchemy.orm import relationship
from app.database.session import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    first_name = Column(String(100), nullable=True)
    mobile_number = Column(String(20), nullable=True)

    delivery_date = Column(Date, nullable=True)

    address = Column(JSON, nullable=False)
    items = Column(JSON, nullable=False)

    total_amount = Column(Float, nullable=False)

    # ✅ FIXED
    order_status = Column(String(20), default="pending", index=True)

    # ✅ REQUIRED FOR RAZORPAY
    razorpay_order_id = Column(String(50), unique=True, index=True)
    razorpay_payment_id = Column(String(50), nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="orders")
