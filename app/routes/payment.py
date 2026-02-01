from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Depends,
)
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
import razorpay
import os
import hmac
import hashlib
import json
from fastapi import Query
from sqlalchemy import or_
from sqlalchemy.dialects.postgresql import JSONB
from app.database.session import get_db
from app.models.orders import Order
from app.models.user import User
from app.routes.auth import get_current_user

from dotenv import load_dotenv
load_dotenv()

router = APIRouter()

# --------------------------------------------------
# RAZORPAY CONFIG
# --------------------------------------------------
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
    raise RuntimeError("Razorpay keys not configured")

razorpay_client = razorpay.Client(
    auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
)

# --------------------------------------------------
# CREATE ORDER (JWT REQUIRED)
# --------------------------------------------------
@router.post("/create-order/")
async def create_order(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    amount = data.get("amount")
    items = data.get("items")
    address = data.get("deliveryAddress")
    delivery_date = data.get("deliveryDate")

    if not amount or not items or not address:
        raise HTTPException(status_code=400, detail="Missing order data")

    try:
        # ✅ ALWAYS CREATE A NEW RAZORPAY ORDER
        razorpay_order = razorpay_client.order.create({
            "amount": int(amount * 100),  # paise
            "currency": "INR",
            "payment_capture": 1,
        })

        new_order = Order(
            user_id=current_user.id,
            first_name=current_user.first_name,
            mobile_number=current_user.mobile_number,
            address=address,
            items=items,
            total_amount=amount,
            razorpay_order_id=razorpay_order["id"],
            order_status="pending",
            delivery_date=datetime.strptime(
                delivery_date, "%Y-%m-%d"
            ) if delivery_date else None,
            created_at=datetime.utcnow(),
        )

        db.add(new_order)
        db.commit()
        db.refresh(new_order)

        return {
            "order_id": razorpay_order["id"],
            "key": RAZORPAY_KEY_ID,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# --------------------------------------------------
# VERIFY PAYMENT (JWT REQUIRED)
# --------------------------------------------------
@router.post("/verify-payment/")
async def verify_payment(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await request.json()
    print("VERIFY PAYMENT HIT:", data)

    razorpay_order_id = data.get("order_id")
    razorpay_payment_id = data.get("payment_id")
    razorpay_signature = data.get("signature")

    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        raise HTTPException(status_code=400, detail="Invalid payment data")

    # ✅ VERIFY SIGNATURE
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        })
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # ✅ FETCH ORDER (BOUND TO USER)
    order = db.query(Order).filter(
        Order.razorpay_order_id == razorpay_order_id,
        Order.user_id == current_user.id,
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # ✅ IDEMPOTENT CHECK
    if order.order_status == "placed":
        return {
            "status": "success",
            "order_id": order.id,
        }

    # ✅ UPDATE ORDER
    order.order_status = "placed"
    order.razorpay_payment_id = razorpay_payment_id
    order.updated_at = datetime.utcnow()

    db.commit()

    return {
        "status": "success",
        "order_id": order.id,
    }

@router.post("/api/razorpay/webhook")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")

    if not webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    # Raw body (IMPORTANT)
    body = await request.body()
    received_signature = request.headers.get("X-Razorpay-Signature")

    if not received_signature:
        raise HTTPException(status_code=400, detail="Missing Razorpay signature")

    # ✅ VERIFY SIGNATURE
    expected_signature = hmac.new(
        webhook_secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, received_signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = json.loads(body)
    event = payload.get("event")

    print("🔔 Razorpay Webhook Event:", event)

    # -----------------------------
    # ✅ PAYMENT CAPTURED
    # -----------------------------
    if event == "payment.captured":
        payment = payload["payload"]["payment"]["entity"]

        razorpay_order_id = payment.get("order_id")
        razorpay_payment_id = payment.get("id")

        order = db.query(Order).filter(
            Order.razorpay_order_id == razorpay_order_id
        ).first()

        if order and order.order_status != "placed":
            order.order_status = "placed"
            order.razorpay_payment_id = razorpay_payment_id
            order.updated_at = datetime.utcnow()
            db.commit()

            print("✅ Order marked as PLACED via webhook")

    # -----------------------------
    # ❌ PAYMENT FAILED
    # -----------------------------
    elif event == "payment.failed":
        payment = payload["payload"]["payment"]["entity"]
        razorpay_order_id = payment.get("order_id")

        order = db.query(Order).filter(
            Order.razorpay_order_id == razorpay_order_id
        ).first()

        if order and order.order_status == "pending":
            order.order_status = "failed"
            order.updated_at = datetime.utcnow()
            db.commit()

            print("❌ Order marked as FAILED via webhook")

    return {"status": "ok"}

# --------------------------------------------------
# GET USER ORDERS
# --------------------------------------------------
@router.get("/api/orders")
async def get_orders(
    filter: str | None = Query(default="all"),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Order)
        .filter(Order.user_id == current_user.id)
    )

    # ----------------------------
    # STATUS FILTER
    # ----------------------------
    if status:
        query = query.filter(Order.order_status == status)

    # ----------------------------
    # PRESET FILTERS
    # ----------------------------
    if filter == "current":
        query = query.filter(
            Order.order_status.notin_(
                ["delivered", "completed", "cancelled", "rejected"]
            )
        )

    elif filter == "delivered":
        query = query.filter(
            Order.order_status.in_(["delivered", "completed"])
        )

    elif filter == "cancelled":
        query = query.filter(
            Order.order_status.in_(["cancelled", "rejected"])
        )

    # ----------------------------
    # SEARCH (Order ID or Item Name)
    # ----------------------------
    if search:
        search_value = f"%{search.lower()}%"
        query = query.filter(
            or_(
                Order.razorpay_order_id.ilike(search_value),
                Order.items.cast(JSONB).op("::text").ilike(search_value)
            )
        )

    orders = (
        query
        .order_by(Order.created_at.desc())
        .all()
    )

    return {
        "data": [
            {
                "id": o.id,
                "razorpay_order_id": o.razorpay_order_id,
                "delivery_date": o.delivery_date.isoformat() if o.delivery_date else None,
                "total_amount": float(o.total_amount),
                "order_status": o.order_status,
                "created_at": o.created_at.isoformat(),
                "updated_at": o.updated_at.isoformat() if o.updated_at else None,
                "items": o.items,
                "address": o.address,
                "payment_status": "paid" if o.order_status != "pending" else "pending",
            }
            for o in orders
        ],
        "message": "Orders fetched successfully",
    }


# --------------------------------------------------
# CANCEL ORDER
# --------------------------------------------------
@router.patch("/cancel-order/{order_id}")
async def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id,
    ).first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.order_status not in ["placed", "confirmed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel order in '{order.order_status}' state",
        )

    order.order_status = "cancelled"
    db.commit()

    return {
        "status": "success",
        "message": "Order cancelled successfully",
    }
