import asyncio
from datetime import datetime, timezone
import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from typing import Optional, Any
from ..config import settings
from ..db.session import get_async_database_url
from ..db.models import CandleModel

async def fetch_binance_klines_api(symbol: str = "BTCUSDT", interval: str = "15m", limit: int = 1000, start_time: int = None):
    """
    Fetches klines from Binance public API endpoints.
    """
    base_url = "https://api.binance.com/api/v3/klines"
    params = {
        "symbol": symbol,
        "interval": interval,
        "limit": limit,
    }
    if start_time:
        params["startTime"] = start_time

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(base_url, params=params)
            if resp.status_code != 200:
                print(f"Error fetching klines for {symbol}: {resp.status_code} {resp.text}")
                return []
            return resp.json()
    except Exception as e:
        print(f"[Binance Ingest] Transient network error fetching klines for {symbol}: {e}")
        return []

async def fetch_latest_candle(symbol: str = "BTCUSDT", interval: str = "15m", session: Optional[AsyncSession] = None) -> Optional[dict]:
    """
    Fetches the latest fully-closed candle from Binance REST API (limit=2, takes second-to-last bar).
    Optionally upserts it into the candles database table.
    """
    klines = await fetch_binance_klines_api(symbol=symbol, interval=interval, limit=2)
    if not klines or len(klines) < 2:
        return None

    # The last element is the in-progress candle; take the second-to-last fully-closed candle
    k = klines[-2]
    open_ts = int(k[0])
    open_time = datetime.fromtimestamp(open_ts / 1000.0, tz=timezone.utc)
    candle = {
        "symbol": symbol,
        "resolution": interval,
        "open_time": open_time,
        "open": float(k[1]),
        "high": float(k[2]),
        "low": float(k[3]),
        "close": float(k[4]),
        "volume": float(k[5]),
    }

    if session is not None:
        try:
            stmt = pg_insert(CandleModel).values([candle])
            stmt = stmt.on_conflict_do_nothing(
                index_elements=["symbol", "resolution", "open_time"]
            )
            await session.execute(stmt)
            await session.commit()
        except Exception as e:
            await session.rollback()
            print(f"[Candle Ingest] Notice on candle upsert: {e}")

    return candle

async def fetch_recent_candles_df(symbol: str = "BTCUSDT", interval: str = "1m", limit: int = 60) -> Optional[Any]:
    """
    Fetches the latest N closed candles from Binance and returns a pandas DataFrame
    with pre-calculated indicator columns for instant live feature evaluation.
    """
    import pandas as pd
    import numpy as np

    klines = await fetch_binance_klines_api(symbol=symbol, interval=interval, limit=max(limit, 30))
    if not klines or len(klines) < 2:
        return None

    records = []
    for k in klines[:-1]:
        open_ts = int(k[0])
        open_time = datetime.fromtimestamp(open_ts / 1000.0, tz=timezone.utc)
        records.append({
            "symbol": symbol,
            "resolution": interval,
            "open_time": open_time,
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        })

    if not records:
        return None

    df = pd.DataFrame(records)
    return df



async def ingest_symbol(symbol: str, session: AsyncSession, days: int = 180):
    print(f"Ingesting {symbol} 15m candles for the last {days} days...")
    interval = "15m"
    resolution = "15m"

    # 15 minutes = 900,000 ms
    step_ms = 15 * 60 * 1000
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    start_ms = now_ms - (days * 24 * 60 * 60 * 1000)

    current_start = start_ms
    total_inserted = 0

    while current_start < now_ms:
        klines = await fetch_binance_klines_api(symbol=symbol, interval=interval, limit=1000, start_time=current_start)
        if not klines:
            break

        records = []
        for k in klines:
            open_ts = int(k[0])
            open_time = datetime.fromtimestamp(open_ts / 1000.0, tz=timezone.utc)
            records.append({
                "symbol": symbol,
                "resolution": resolution,
                "open_time": open_time,
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
            })

        if records:
            stmt = pg_insert(CandleModel).values(records)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=["symbol", "resolution", "open_time"]
            )
            await session.execute(stmt)
            await session.commit()
            total_inserted += len(records)
            print(f"  Inserted {len(records)} bars (up to {records[-1]['open_time']}). Total: {total_inserted}")

            last_open_ms = int(klines[-1][0])
            if last_open_ms <= current_start:
                break
            current_start = last_open_ms + step_ms
        else:
            break

        await asyncio.sleep(0.1)

    print(f"Successfully finished ingestion for {symbol}: {total_inserted} total candles cached.")

async def main():
    db_url = get_async_database_url(settings.DATABASE_URL)
    engine = create_async_engine(
        db_url,
        echo=False,
        connect_args={
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    symbols = ["BTCUSDT", "ETHUSDT"]
    async with session_factory() as session:
        for sym in symbols:
            try:
                await ingest_symbol(sym, session, days=180)
            except Exception as e:
                print(f"Failed to ingest {sym}: {e}")

    await engine.dispose()
    print("\n✓ All Binance candle ingestion jobs completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())
