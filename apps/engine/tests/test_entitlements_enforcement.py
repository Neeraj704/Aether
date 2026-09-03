import asyncio
import os
import uuid
from datetime import datetime, timezone
import pytest
from httpx import AsyncClient, ASGITransport
from dotenv import load_dotenv

load_dotenv("apps/engine/.env")

from apps.engine.app.main import app
from apps.engine.app.db.session import AsyncSessionLocal
from apps.engine.app.db.models import (
    SubscriptionModel,
    BotModel,
    LiveSessionModel,
)
from apps.engine.app.deps import get_current_user_id
from sqlalchemy import text, select, update

async def get_test_user_id():
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("SELECT id FROM auth.users LIMIT 1"))
        row = res.first()
        return str(row[0]) if row else "c6749d64-a72c-4c2c-9a7e-d98ae016a88f"

@pytest.mark.asyncio
async def test_entitlement_enforcement():
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)
    app.dependency_overrides[get_current_user_id] = lambda: test_user_id

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # ---------------------------------------------------------------------
        # 1. Test Server-side DB trigger: Marketplace Paid Listing on Free plan
        # ---------------------------------------------------------------------
        # Set user's plan in DB to 'free'
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(SubscriptionModel)
                .where(SubscriptionModel.user_id == user_uuid)
                .values(plan="free", status="active")
            )
            await session.commit()

        # Try to directly insert a paid marketplace listing (price = 299)
        async with AsyncSessionLocal() as session:
            rejected = False
            try:
                await session.execute(
                    text("""
                        INSERT INTO public.marketplace_listings 
                        (owner_id, name, tagline, description, price, tier, status)
                        VALUES (:owner_id, 'Sneaky Paid Bot', 'Trying to sell without Pro', 'test', 299, 'starter', 'published')
                    """),
                    {"owner_id": user_uuid}
                )
                await session.commit()
            except Exception as e:
                rejected = True
                print("✓ Server-side PostgreSQL trigger successfully rejected paid listing for Free plan:", str(e))
                await session.rollback()

            assert rejected, "Expected database trigger to reject paid listing from free user!"

        # Now test that Free listing (price = 0) IS allowed for Free user
        async with AsyncSessionLocal() as session:
            listing_id = uuid.uuid4()
            await session.execute(
                text("""
                    INSERT INTO public.marketplace_listings 
                    (id, owner_id, name, tagline, description, price, tier, status)
                    VALUES (:id, :owner_id, 'Legit Free Bot', 'Free for all', 'test', 0, 'free', 'published')
                """),
                {"id": listing_id, "owner_id": user_uuid}
            )
            await session.commit()
            print("✓ Free listing (price=0) accepted for Free user")
            # Cleanup test listing
            await session.execute(text("DELETE FROM public.marketplace_listings WHERE id = :id"), {"id": listing_id})
            await session.commit()

        # ---------------------------------------------------------------------
        # 2. Test Live Trading Limits: Free plan allows 0 live bots
        # ---------------------------------------------------------------------
        # Ensure user has a valid bot in DB
        async with AsyncSessionLocal() as session:
            bot_res = await session.execute(
                select(BotModel).where(BotModel.user_id == user_uuid)
            )
            bot = bot_res.scalars().first()
            if not bot:
                bot = BotModel(
                    id=uuid.uuid4(),
                    user_id=user_uuid,
                    name="Live Test Bot",
                    status="draft",
                    graph={"nodes": [{"id": "n1", "type": "dataSourceNode", "data": {"symbol": "BTCUSDT"}}], "edges": [], "notes": [], "frames": [], "schemaVersion": 2},
                )
                session.add(bot)
                await session.commit()
            bot_id = str(bot.id)

        # Attempt to start live trading on Free plan
        res = await client.post(f"/bots/{bot_id}/live/start", json={"symbol": "BTCUSDT", "capital": 100000})
        assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"
        print("✓ Live start rejected for Free plan:", res.json()["detail"])

        # Upgrade user to 'starter' plan (allows 1 live bot)
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(SubscriptionModel)
                .where(SubscriptionModel.user_id == user_uuid)
                .values(plan="starter", status="active")
            )
            await session.commit()

        # Reset plan back to pro for cleanliness
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(SubscriptionModel)
                .where(SubscriptionModel.user_id == user_uuid)
                .values(plan="pro", status="active")
            )
            await session.commit()
        print("✓ All server-side entitlement checks verified!")

if __name__ == "__main__":
    asyncio.run(test_entitlement_enforcement())
