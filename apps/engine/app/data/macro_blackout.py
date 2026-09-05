from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import MacroEventModel

def _normalize_dt(dt: Any) -> datetime:
    """Ensure datetime is timezone-aware in UTC."""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    if not isinstance(dt, datetime):
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def check_event_blackout(event: Any, ref_utc: datetime) -> Tuple[bool, Optional[str]]:
    """Evaluates whether ref_utc falls within the event's blackout window."""
    if isinstance(event, dict):
        sched = _normalize_dt(event.get("scheduled_at"))
        before_mins = int(event.get("blackout_before_minutes", 60))
        after_mins = int(event.get("blackout_after_minutes", 60))
        label = event.get("label", "Macro Event")
    else:
        sched = _normalize_dt(getattr(event, "scheduled_at"))
        before_mins = int(getattr(event, "blackout_before_minutes", 60))
        after_mins = int(getattr(event, "blackout_after_minutes", 60))
        label = getattr(event, "label", "Macro Event")

    window_start = sched - timedelta(minutes=before_mins)
    window_end = sched + timedelta(minutes=after_mins)

    if window_start <= ref_utc <= window_end:
        return True, f"Active Blackout: {label}"
    return False, None

async def compute_blackout(
    reference_time: datetime,
    db: Optional[AsyncSession] = None,
    macro_events_cache: Optional[List[Any]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Returns (blackout_active, reason).
    Checks if reference_time falls within [scheduled_at - blackout_before, scheduled_at + blackout_after]
    for any configured high-impact macro event.
    
    If macro_events_cache is passed (historical/walk-forward backtest passes), evaluates in-memory.
    If db is provided (live/paper trading modes), queries macro_events table.
    """
    ref_utc = _normalize_dt(reference_time)

    # 1. Fast in-memory cache path (used during historical / walk-forward / monte-carlo backtests)
    if macro_events_cache is not None:
        for event in macro_events_cache:
            active, reason = check_event_blackout(event, ref_utc)
            if active:
                return True, reason
        return False, None

    # 2. Database query path (used during live paper/live execution loops)
    if db is not None:
        try:
            # Query events around the reference window (+/- 24 hours)
            search_start = ref_utc - timedelta(hours=24)
            search_end = ref_utc + timedelta(hours=24)
            
            stmt = select(MacroEventModel).where(
                MacroEventModel.scheduled_at >= search_start,
                MacroEventModel.scheduled_at <= search_end,
            )
            res = await db.execute(stmt)
            events = res.scalars().all()
            for event in events:
                active, reason = check_event_blackout(event, ref_utc)
                if active:
                    return True, reason
        except Exception as e:
            # Fallback defensively so transient DB query glitches log and don't halt execution
            print(f"[Macro Blackout] Error querying macro_events: {e}")
            return False, None

    return False, None
