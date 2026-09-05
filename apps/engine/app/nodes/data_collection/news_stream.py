from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy import select

from ..base import NodeContext
from ...db.models import NewsItemModel
from ...data.macro_blackout import compute_blackout

def _normalize_dt(dt: Any) -> datetime:
    """Ensure datetime is timezone-aware in UTC."""
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
    if not isinstance(dt, datetime):
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def _extract_base_symbol(raw_symbol: str) -> str:
    """Extracts base coin like 'BTC' from 'BTCUSDT', 'ETH/USD', etc."""
    s = raw_symbol.upper().replace("/", "").replace("-", "").replace("_", "")
    for quote in ("USDT", "USD", "BUSD", "USDC", "FDUSD", "TUSD", "EUR"):
        if s.endswith(quote) and len(s) > len(quote):
            return s[:-len(quote)]
    return s

def _matches_symbol(article_symbols: List[str], target_base: str) -> bool:
    """Checks if article tagged symbols match target asset or general market."""
    if not article_symbols:
        return True  # General market news is relevant
    return target_base in [s.upper() for s in article_symbols]

class NewsStreamNode:
    component_id = "news-stream"

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        cfg = {**self.config, **config}

        # 1. Determine target symbol and base currency
        candle = ctx.candle
        if isinstance(candle, dict):
            raw_symbol = str(candle.get("symbol") or cfg.get("symbol") or "BTCUSDT")
            candle_time = candle.get("open_time")
        else:
            raw_symbol = str(getattr(candle, "symbol", None) or cfg.get("symbol") or "BTCUSDT")
            candle_time = getattr(candle, "open_time", None)

        base_symbol = _extract_base_symbol(raw_symbol)

        # 2. Determine reference time (candle open_time for historical backtests to guarantee zero lookahead bias)
        if ctx.mode in ("paper", "live") and not candle_time:
            ref_time = datetime.now(timezone.utc)
        elif candle_time:
            ref_time = _normalize_dt(candle_time)
        else:
            ref_time = datetime.now(timezone.utc)

        # 3. Lookback window
        lookback_mins = int(cfg.get("lookbackMinutes") or cfg.get("dedupWindow") or 180)
        window_start = ref_time - timedelta(minutes=lookback_mins)
        window_end = ref_time  # Strictly <= ref_time

        matching_articles = []

        # 4. Fetch / filter news items
        # Path A: In-memory cache from backtest runner (fast & DB-free hot loop)
        if ctx.news_items_cache is not None:
            for item in ctx.news_items_cache:
                pub_at = getattr(item, "published_at", None) if not isinstance(item, dict) else item.get("published_at")
                if not pub_at:
                    continue
                pub_utc = _normalize_dt(pub_at)
                if window_start <= pub_utc <= window_end:
                    symbols = getattr(item, "symbols", []) if not isinstance(item, dict) else item.get("symbols", [])
                    if _matches_symbol(symbols, base_symbol):
                        matching_articles.append((item, pub_utc))

        # Path B: Live database query (paper/live trading loop)
        elif ctx.db is not None:
            try:
                stmt = (
                    select(NewsItemModel)
                    .where(
                        NewsItemModel.published_at >= window_start,
                        NewsItemModel.published_at <= window_end,
                    )
                    .order_by(NewsItemModel.published_at.desc())
                    .limit(50)
                )
                res = await ctx.db.execute(stmt)
                db_items = res.scalars().all()
                for item in db_items:
                    pub_utc = _normalize_dt(item.published_at)
                    if _matches_symbol(item.symbols, base_symbol):
                        matching_articles.append((item, pub_utc))
            except Exception as e:
                print(f"[NewsStreamNode] Error querying news_items: {e}")

        # 5. Score aggregation with linear recency weighting
        if not matching_articles:
            sentiment_score = 0.0
        else:
            total_weight = 0.0
            weighted_compound_sum = 0.0
            window_sec = max(1.0, float(lookback_mins * 60))

            for item, pub_utc in matching_articles:
                if isinstance(item, dict):
                    compound = float(item.get("sentiment_compound") or 0.0)
                else:
                    compound = float(getattr(item, "sentiment_compound", 0.0) or 0.0)

                # Linear decay: more recent articles have higher weight (1.0 to 0.2)
                age_sec = max(0.0, (ref_time - pub_utc).total_seconds())
                weight = max(0.2, 1.0 - (age_sec / window_sec) * 0.8)

                weighted_compound_sum += compound * weight
                total_weight += weight

            sentiment_score = (weighted_compound_sum / total_weight) if total_weight > 0 else 0.0
            sentiment_score = max(-1.0, min(1.0, sentiment_score))

        # 6. Real Macro Blackout check
        blackout_active, blackout_reason = await compute_blackout(
            reference_time=ref_time,
            db=ctx.db,
            macro_events_cache=ctx.macro_events_cache,
        )

        return {
            "type": "NewsFeed",
            "symbol": raw_symbol,
            "timestamp": ref_time.isoformat(),
            "sentimentScore": round(sentiment_score, 4),
            "articleCount": len(matching_articles),
            "blackoutActive": blackout_active,
            "blackoutReason": blackout_reason,
        }
