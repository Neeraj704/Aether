import hmac
import hashlib
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
import razorpay

from ..config import settings
from ..deps import get_current_user_id
from ..db.session import get_db
from ..db.models import (
    SubscriptionModel,
    CreditWalletModel,
    CreditTransactionModel,
    PaymentModel,
)
from ..billing.wallet import get_or_create_wallet

router = APIRouter(prefix="/billing", tags=["Billing"])

# Authoritative Server-side Price Catalog (Never trust client prices)
PLAN_PRICES_INR = {
    "starter": {"monthly": 799, "annual": 7990},
    "pro": {"monthly": 1999, "annual": 19990},
    "elite": {"monthly": 4999, "annual": 49990},
}

CREDIT_BUNDLE_PRICES = {
    100: 99,
    500: 499,
    1000: 999,
}

def calculate_credit_price_inr(credits: int) -> int:
    if credits in CREDIT_BUNDLE_PRICES:
        return CREDIT_BUNDLE_PRICES[credits]
    if credits >= 1000:
        return round(credits * 0.9)
    if credits >= 500:
        return round(credits * 0.95)
    return max(1, round(credits * 1.0))

def get_razorpay_client() -> Optional[razorpay.Client]:
    if settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET:
        try:
            return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        except Exception:
            return None
    return None

def verify_signature_hmac(order_id: str, payment_id: str, signature: str) -> bool:
    msg = f"{order_id}|{payment_id}".encode("utf-8")
    secret = settings.RAZORPAY_KEY_SECRET.encode("utf-8")
    expected = hmac.new(secret, msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

def verify_webhook_hmac(body_bytes: bytes, signature: str) -> bool:
    secret = settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8")
    expected = hmac.new(secret, body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------

class CheckoutRequest(BaseModel):
    kind: str = Field(..., pattern="^(subscription|credit_topup)$")
    plan: Optional[str] = "pro"
    cycle: Optional[str] = "monthly"
    creditAmount: Optional[int] = 500

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

# -----------------------------------------------------------------------------
# 1. POST /billing/checkout
# -----------------------------------------------------------------------------
@router.post("/checkout")
async def create_checkout(
    payload: CheckoutRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id '{user_id}'")

    if payload.kind == "subscription":
        plan = (payload.plan or "pro").lower()
        if plan not in PLAN_PRICES_INR:
            raise HTTPException(status_code=400, detail=f"Unknown plan tier '{plan}'")
        cycle = (payload.cycle or "monthly").lower()
        if cycle not in ("monthly", "annual"):
            cycle = "monthly"
        price_inr = PLAN_PRICES_INR[plan][cycle]
        receipt_desc = f"sub_{plan}_{cycle}_{user_uuid.hex[:8]}"
    else:  # credit_topup
        credits = max(50, payload.creditAmount or 100)
        price_inr = calculate_credit_price_inr(credits)
        receipt_desc = f"topup_{credits}cr_{user_uuid.hex[:8]}"

    amount_paise = int(price_inr * 100)
    rzp_client = get_razorpay_client()
    order_id = None

    if rzp_client:
        try:
            order_data = {
                "amount": amount_paise,
                "currency": "INR",
                "receipt": receipt_desc[:40],
                "notes": {
                    "user_id": str(user_uuid),
                    "kind": payload.kind,
                    "plan": payload.plan if payload.kind == "subscription" else None,
                    "cycle": payload.cycle if payload.kind == "subscription" else None,
                    "credits": payload.creditAmount if payload.kind == "credit_topup" else None,
                },
            }
            rzp_order = rzp_client.order.create(data=order_data)
            order_id = rzp_order.get("id")
        except Exception as e:
            print(f"[Razorpay] Notice creating real order, falling back to deterministic test order: {e}")

    if not order_id:
        # Deterministic test order ID for test/sandbox environments
        order_id = f"order_test_{uuid.uuid4().hex[:16]}"

    # Save payment record
    payment = PaymentModel(
        id=uuid.uuid4(),
        user_id=user_uuid,
        razorpay_order_id=order_id,
        razorpay_payment_id=None,
        razorpay_signature=None,
        amount=price_inr,
        currency="INR",
        kind=payload.kind,
        status="created",
        created_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    await db.commit()

    return {
        "orderId": order_id,
        "amount": amount_paise,
        "amountInr": price_inr,
        "currency": "INR",
        "keyId": settings.RAZORPAY_KEY_ID,
    }

# -----------------------------------------------------------------------------
# 2. POST /billing/verify
# -----------------------------------------------------------------------------
@router.post("/verify")
async def verify_payment(
    payload: VerifyPaymentRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id '{user_id}'")

    # 1. Fetch payment record
    res = await db.execute(
        select(PaymentModel).where(PaymentModel.razorpay_order_id == payload.razorpay_order_id)
    )
    payment = res.scalars().first()

    if not payment:
        raise HTTPException(status_code=404, detail="Order not found")

    if payment.user_id != user_uuid:
        raise HTTPException(status_code=403, detail="Payment order belongs to a different user")

    if payment.status == "paid":
        # Already processed idempotently
        state = await fetch_user_billing_state(user_uuid, db)
        return {"success": True, "message": "Payment already verified", **state}

    # 2. Signature verification
    valid = False
    rzp_client = get_razorpay_client()
    if rzp_client:
        try:
            rzp_client.utility.verify_payment_signature({
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
            })
            valid = True
        except Exception:
            pass

    if not valid:
        # Fallback to direct HMAC validation
        valid = verify_signature_hmac(
            payload.razorpay_order_id,
            payload.razorpay_payment_id,
            payload.razorpay_signature,
        )

    if not valid:
        payment.status = "failed"
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    # 3. Process fulfillment
    await fulfill_payment(payment, payload.razorpay_payment_id, payload.razorpay_signature, db)
    await db.commit()

    state = await fetch_user_billing_state(user_uuid, db)
    return {"success": True, "message": "Payment verified successfully", **state}

# -----------------------------------------------------------------------------
# 3. POST /billing/webhook (Server-to-Server Razorpay Webhook)
# -----------------------------------------------------------------------------
@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None, alias="X-Razorpay-Signature"),
    db: AsyncSession = Depends(get_db),
):
    body_bytes = await request.body()

    if x_razorpay_signature and settings.RAZORPAY_WEBHOOK_SECRET:
        if not verify_webhook_hmac(body_bytes, x_razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event_data = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event = event_data.get("event", "")
    payload_obj = event_data.get("payload", {})

    print(f"[Razorpay Webhook] Received event: {event}")

    if event in ("payment.captured", "order.paid"):
        payment_entity = payload_obj.get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        payment_id = payment_entity.get("id")

        if order_id:
            res = await db.execute(
                select(PaymentModel).where(PaymentModel.razorpay_order_id == order_id)
            )
            payment = res.scalars().first()
            if payment and payment.status != "paid":
                await fulfill_payment(payment, payment_id, x_razorpay_signature or "", db)
                await db.commit()
                print(f"[Razorpay Webhook] Fulfilled order {order_id} via webhook")

    elif event == "subscription.cancelled":
        sub_entity = payload_obj.get("subscription", {}).get("entity", {})
        sub_id = sub_entity.get("id")
        if sub_id:
            res = await db.execute(
                select(SubscriptionModel).where(SubscriptionModel.razorpay_subscription_id == sub_id)
            )
            sub = res.scalars().first()
            if sub:
                sub.status = "cancelled"
                sub.plan = "free"
                sub.updated_at = datetime.now(timezone.utc)
                await db.commit()
                print(f"[Razorpay Webhook] Cancelled subscription {sub_id}")

    return {"status": "ok"}

# -----------------------------------------------------------------------------
# 4. GET /billing/state
# -----------------------------------------------------------------------------
@router.get("/state")
async def get_billing_state(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id '{user_id}'")

    state = await fetch_user_billing_state(user_uuid, db)
    return state

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
async def fulfill_payment(
    payment: PaymentModel,
    payment_id: Optional[str],
    signature: Optional[str],
    db: AsyncSession,
):
    payment.status = "paid"
    payment.razorpay_payment_id = payment_id
    payment.razorpay_signature = signature

    now = datetime.now(timezone.utc)

    if payment.kind == "subscription":
        # Determine plan from amount
        amount_num = float(payment.amount)
        if amount_num in (4999, 49990):
            target_plan = "elite"
            period_end = now + timedelta(days=365 if amount_num == 49990 else 30)
        elif amount_num in (1999, 19990):
            target_plan = "pro"
            period_end = now + timedelta(days=365 if amount_num == 19990 else 30)
        elif amount_num in (799, 7990):
            target_plan = "starter"
            period_end = now + timedelta(days=365 if amount_num == 7990 else 30)
        else:
            target_plan = "pro"
            period_end = now + timedelta(days=30)

        res = await db.execute(
            select(SubscriptionModel).where(SubscriptionModel.user_id == payment.user_id)
        )
        sub = res.scalars().first()
        if sub:
            sub.plan = target_plan
            sub.status = "active"
            sub.current_period_end = period_end
            sub.updated_at = now
        else:
            sub = SubscriptionModel(
                id=uuid.uuid4(),
                user_id=payment.user_id,
                plan=target_plan,
                status="active",
                current_period_end=period_end,
                created_at=now,
                updated_at=now,
            )
            db.add(sub)

    elif payment.kind == "credit_topup":
        # Compute credits from amount
        amount_num = int(payment.amount)
        if amount_num == 99:
            credits = 100
        elif amount_num == 499:
            credits = 500
        elif amount_num == 999:
            credits = 1000
        elif amount_num >= 900:
            credits = round(amount_num / 0.9)
        elif amount_num >= 475:
            credits = round(amount_num / 0.95)
        else:
            credits = amount_num

        # 1. Record transaction
        tx = CreditTransactionModel(
            id=uuid.uuid4(),
            user_id=payment.user_id,
            amount=credits,
            reason="topup",
            razorpay_payment_id=payment_id,
            created_at=now,
        )
        db.add(tx)

        # 2. Update wallet
        res = await db.execute(
            select(CreditWalletModel).where(CreditWalletModel.user_id == payment.user_id)
        )
        wallet = res.scalars().first()
        if wallet:
            wallet.balance = float(wallet.balance) + credits
            wallet.updated_at = now
        else:
            wallet = CreditWalletModel(
                user_id=payment.user_id,
                balance=credits,
                updated_at=now,
            )
            db.add(wallet)

async def fetch_user_billing_state(user_uuid: uuid.UUID, db: AsyncSession) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)

    # 1. Subscriptions
    res_sub = await db.execute(
        select(SubscriptionModel).where(SubscriptionModel.user_id == user_uuid)
    )
    sub = res_sub.scalars().first()
    if not sub:
        sub = SubscriptionModel(
            id=uuid.uuid4(),
            user_id=user_uuid,
            plan="free",
            status="active",
            current_period_end=None,
            created_at=now,
            updated_at=now,
        )
        db.add(sub)
        await db.commit()

    # 2. Wallet
    wallet = await get_or_create_wallet(user_uuid, db)

    # 3. Transactions
    res_tx = await db.execute(
        select(CreditTransactionModel)
        .where(CreditTransactionModel.user_id == user_uuid)
        .order_by(desc(CreditTransactionModel.created_at))
        .limit(20)
    )
    transactions = [
        {
            "id": str(t.id),
            "amount": float(t.amount),
            "reason": t.reason,
            "paymentId": t.razorpay_payment_id,
            "createdAt": t.created_at.isoformat() if t.created_at else None,
        }
        for t in res_tx.scalars().all()
    ]

    # 4. Payments
    res_pay = await db.execute(
        select(PaymentModel)
        .where(PaymentModel.user_id == user_uuid)
        .order_by(desc(PaymentModel.created_at))
        .limit(20)
    )
    payments = [
        {
            "id": str(p.id),
            "orderId": p.razorpay_order_id,
            "paymentId": p.razorpay_payment_id,
            "amount": float(p.amount),
            "currency": p.currency,
            "kind": p.kind,
            "status": p.status,
            "createdAt": p.created_at.isoformat() if p.created_at else None,
        }
        for p in res_pay.scalars().all()
    ]

    return {
        "plan": sub.plan,
        "status": sub.status,
        "currentPeriodEnd": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "creditBalance": float(wallet.balance),
        "transactions": transactions,
        "payments": payments,
    }
