import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.models import CreditWalletModel, CreditTransactionModel

DEFAULT_STARTING_CREDITS = 240

async def get_or_create_wallet(user_id: uuid.UUID, db: AsyncSession) -> CreditWalletModel:
    """
    Retrieves the CreditWalletModel for the given user_id.
    If no wallet row exists, creates one with 240 starting credits and records an initial_grant transaction.
    """
    user_uuid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    now = datetime.now(timezone.utc)

    res = await db.execute(
        select(CreditWalletModel).where(CreditWalletModel.user_id == user_uuid)
    )
    wallet = res.scalars().first()

    if not wallet:
        wallet = CreditWalletModel(
            user_id=user_uuid,
            balance=DEFAULT_STARTING_CREDITS,
            updated_at=now,
        )
        db.add(wallet)
        tx_init = CreditTransactionModel(
            id=uuid.uuid4(),
            user_id=user_uuid,
            amount=DEFAULT_STARTING_CREDITS,
            reason="initial_grant",
            razorpay_payment_id=None,
            created_at=now,
        )
        db.add(tx_init)
        await db.commit()
        # Refresh to ensure state is clean
        res_fresh = await db.execute(
            select(CreditWalletModel).where(CreditWalletModel.user_id == user_uuid)
        )
        wallet = res_fresh.scalars().first()

    return wallet
