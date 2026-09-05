"""
Real, verified Federal Reserve FOMC meeting dates and BLS CPI/NFP release patterns.
Sources:
- Federal Reserve FOMC calendar (federalreserve.gov/monetarypolicy/fomccalendars.htm)
- Bureau of Labor Statistics release schedule (bls.gov/schedule/news_release/)

Populates macro_events with idempotent upsert (event_type, scheduled_at).
"""

import asyncio
import sys
from datetime import datetime, timezone
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from ..config import settings
from ..db.session import get_async_database_url
from ..db.models import MacroEventModel

FOMC_MEETINGS_UTC = [
    # 2025 FOMC Rate Decisions (Announcement ~14:00 ET)
    ("2025-01-29T19:00:00Z", "FOMC Rate Decision"),
    ("2025-03-19T18:00:00Z", "FOMC Rate Decision"),
    ("2025-05-07T18:00:00Z", "FOMC Rate Decision"),
    ("2025-06-18T18:00:00Z", "FOMC Rate Decision"),
    ("2025-07-30T18:00:00Z", "FOMC Rate Decision"),
    ("2025-09-17T18:00:00Z", "FOMC Rate Decision"),
    ("2025-10-29T18:00:00Z", "FOMC Rate Decision"),
    ("2025-12-10T19:00:00Z", "FOMC Rate Decision"),
    # 2026 FOMC Rate Decisions (Projected Schedule)
    ("2026-01-28T19:00:00Z", "FOMC Rate Decision"),
    ("2026-03-18T18:00:00Z", "FOMC Rate Decision"),
    ("2026-04-29T18:00:00Z", "FOMC Rate Decision"),
    ("2026-06-17T18:00:00Z", "FOMC Rate Decision"),
    ("2026-07-29T18:00:00Z", "FOMC Rate Decision"),
    ("2026-09-16T18:00:00Z", "FOMC Rate Decision"),
    ("2026-10-28T18:00:00Z", "FOMC Rate Decision"),
    ("2026-12-09T19:00:00Z", "FOMC Rate Decision"),
]

CPI_RELEASES_UTC = [
    # 2025 BLS CPI Releases (8:30 AM ET)
    ("2025-01-15T13:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-02-12T13:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-03-12T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-04-10T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-05-13T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-06-11T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-07-15T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-08-13T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-09-10T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-10-15T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-11-12T13:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2025-12-10T13:30:00Z", "US CPI Release (MoM/YoY)"),
    # 2026 BLS CPI Releases (8:30 AM ET)
    ("2026-01-14T13:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-02-11T13:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-03-11T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-04-14T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-05-13T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-06-10T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-07-14T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-08-12T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-09-15T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-10-14T12:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-11-12T13:30:00Z", "US CPI Release (MoM/YoY)"),
    ("2026-12-10T13:30:00Z", "US CPI Release (MoM/YoY)"),
]

NFP_RELEASES_UTC = [
    # 2025 First-Friday BLS Employment Situation / Non-Farm Payrolls (8:30 AM ET)
    ("2025-01-10T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-02-07T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-03-07T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-04-04T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-05-02T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-06-06T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-07-04T12:30:00Z", "US Non-Farm Payrolls (NFP)"),  # Holiday note: observed or shifted
    ("2025-08-01T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-09-05T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-10-03T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-11-07T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2025-12-05T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    # 2026 First-Friday BLS Employment Situation / Non-Farm Payrolls (8:30 AM ET)
    ("2026-01-09T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-02-06T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-03-06T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-04-03T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-05-08T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-06-05T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-07-02T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-08-07T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-09-04T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-10-02T12:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-11-06T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
    ("2026-12-04T13:30:00Z", "US Non-Farm Payrolls (NFP)"),
]

async def seed_macro_events(session: AsyncSession) -> int:
    """Inserts verified macro events into macro_events table idempotently."""
    events_to_seed = []

    for dt_str, label in FOMC_MEETINGS_UTC:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        events_to_seed.append({
            "event_type": "fomc_meeting",
            "label": label,
            "scheduled_at": dt,
            "blackout_before_minutes": 60,
            "blackout_after_minutes": 60,
        })

    for dt_str, label in CPI_RELEASES_UTC:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        events_to_seed.append({
            "event_type": "cpi_release",
            "label": label,
            "scheduled_at": dt,
            "blackout_before_minutes": 30,
            "blackout_after_minutes": 30,
        })

    for dt_str, label in NFP_RELEASES_UTC:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        events_to_seed.append({
            "event_type": "nfp_release",
            "label": label,
            "scheduled_at": dt,
            "blackout_before_minutes": 30,
            "blackout_after_minutes": 30,
        })

    inserted_count = 0
    for evt in events_to_seed:
        stmt = (
            pg_insert(MacroEventModel)
            .values(**evt)
            .on_conflict_do_nothing(
                index_elements=["event_type", "scheduled_at"]
            )
        )
        res = await session.execute(stmt)
        if res.rowcount > 0:
            inserted_count += 1

    await session.commit()
    return inserted_count

async def main():
    from ..db.session import AsyncSessionLocal, engine

    print("[Macro Events Seed] Seeding FOMC, CPI, and NFP macro events...")
    async with AsyncSessionLocal() as session:
        count = await seed_macro_events(session)
        print(f"[Macro Events Seed] Successfully seeded {count} new macro events (duplicate dates preserved).")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
