import asyncio
import os
import uuid
import hmac
import hashlib
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from dotenv import load_dotenv

load_dotenv("apps/engine/.env")

from apps.engine.app.main import app
from apps.engine.app.config import settings
from apps.engine.app.db.session import AsyncSessionLocal
from apps.engine.app.db.models import (
    SubscriptionModel,
    CreditWalletModel,
    CreditTransactionModel,
    PaymentModel,
    BotModel,
    LiveSessionModel,
)
from sqlalchemy import update
from apps.engine.app.deps import get_current_user_id

# Fetch real user ID from database
async def get_test_user_id():
    async with AsyncSessionLocal() as session:
        from sqlalchemy import text
        res = await session.execute(text("SELECT id FROM auth.users LIMIT 1"))
        row = res.first()
        return str(row[0]) if row else "c6749d64-a72c-4c2c-9a7e-d98ae016a88f"

@pytest.mark.asyncio
async def test_billing_lifecycle():
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)
    app.dependency_overrides[get_current_user_id] = lambda: test_user_id

    # Reset user to free tier and 240 starting credits for clean test cycle
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(SubscriptionModel)
            .where(SubscriptionModel.user_id == user_uuid)
            .values(plan="free", status="active", current_period_end=None)
        )
        await session.execute(
            update(CreditWalletModel)
            .where(CreditWalletModel.user_id == user_uuid)
            .values(balance=240)
        )
        await session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Initial GET /billing/state
        res = await client.get("/billing/state")
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["plan"] == "free"
        assert data["status"] == "active"
        assert data["creditBalance"] == 240
        print("✓ Initial billing state verified:", data["plan"], data["creditBalance"])

        # 2. POST /billing/checkout (Subscription)
        res = await client.post("/billing/checkout", json={
            "kind": "subscription",
            "plan": "pro",
            "cycle": "monthly",
        })
        assert res.status_code == 200, res.text
        chk = res.json()
        assert chk["amount"] == 199900  # 1999 INR in paise
        assert chk["amountInr"] == 1999
        order_id = chk["orderId"]
        print("✓ Created subscription checkout order:", order_id, chk["amountInr"])

        # 3. POST /billing/verify (Subscription Payment)
        pay_id = f"pay_test_{uuid.uuid4().hex[:12]}"
        # Generate valid HMAC signature
        msg = f"{order_id}|{pay_id}".encode("utf-8")
        sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()

        res = await client.post("/billing/verify", json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": pay_id,
            "razorpay_signature": sig,
        })
        assert res.status_code == 200, res.text
        verify_data = res.json()
        assert verify_data["success"] is True
        assert verify_data["plan"] == "pro"
        assert verify_data["status"] == "active"
        print("✓ Verified subscription payment, new plan:", verify_data["plan"])

        # 4. POST /billing/checkout (Credit Topup)
        res = await client.post("/billing/checkout", json={
            "kind": "credit_topup",
            "creditAmount": 500,
        })
        assert res.status_code == 200, res.text
        topup_chk = res.json()
        assert topup_chk["amountInr"] == 499  # Standard bundle price for 500cr
        assert topup_chk["amount"] == 49900
        topup_order_id = topup_chk["orderId"]
        print("✓ Created credit topup checkout order:", topup_order_id, topup_chk["amountInr"])

        # 5. POST /billing/verify (Credit Topup Payment)
        topup_pay_id = f"pay_test_{uuid.uuid4().hex[:12]}"
        topup_msg = f"{topup_order_id}|{topup_pay_id}".encode("utf-8")
        topup_sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), topup_msg, hashlib.sha256).hexdigest()

        res = await client.post("/billing/verify", json={
            "razorpay_order_id": topup_order_id,
            "razorpay_payment_id": topup_pay_id,
            "razorpay_signature": topup_sig,
        })
        assert res.status_code == 200, res.text
        topup_verify = res.json()
        assert topup_verify["creditBalance"] >= 500  # verified credit topup added
        print("✓ Verified credit topup, new credit balance:", topup_verify["creditBalance"])

        # 6. Test Webhook Handler
        webhook_order_id = f"order_hook_{uuid.uuid4().hex[:12]}"
        # Pre-seed payment record
        async with AsyncSessionLocal() as session:
            hook_payment = PaymentModel(
                id=uuid.uuid4(),
                user_id=uuid.UUID(test_user_id),
                razorpay_order_id=webhook_order_id,
                amount=99,
                currency="INR",
                kind="credit_topup",
                status="created",
                created_at=datetime.now(timezone.utc),
            )
            session.add(hook_payment)
            await session.commit()

        webhook_pay_id = f"pay_hook_{uuid.uuid4().hex[:12]}"
        webhook_payload = {
            "event": "payment.captured",
            "payload": {
                "payment": {
                    "entity": {
                        "id": webhook_pay_id,
                        "order_id": webhook_order_id,
                        "amount": 9900,
                    }
                }
            }
        }
        raw_body = json_bytes = json_str = None
        import json
        raw_body = json.dumps(webhook_payload).encode("utf-8")
        hook_sig = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

        res = await client.post(
            "/billing/webhook",
            content=raw_body,
            headers={"X-Razorpay-Signature": hook_sig, "Content-Type": "application/json"}
        )
        assert res.status_code == 200, res.text
        print("✓ Webhook processed payment.captured successfully!")

        # 7. Final GET /billing/state
        res = await client.get("/billing/state")
        assert res.status_code == 200
        final_state = res.json()
        assert final_state["plan"] == "pro"
        assert final_state["creditBalance"] == 840  # 740 + 100 from webhook
        assert len(final_state["payments"]) >= 3
        assert len(final_state["transactions"]) >= 3
        print("✓ Final billing state fully verified! Balance:", final_state["creditBalance"], "Plan:", final_state["plan"])

if __name__ == "__main__":
    asyncio.run(test_billing_lifecycle())
