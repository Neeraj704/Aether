from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx

def normalize_symbol_for_binance(symbol: str) -> str:
    """Normalizes symbol string to Binance spot format (e.g. BTC/USDT -> BTCUSDT)."""
    return symbol.upper().replace("/", "").replace("-", "").replace("_", "")

async def fetch_orderbook_snapshot(symbol: str = "BTCUSDT", limit: int = 100) -> Optional[Dict[str, Any]]:
    """
    Fetches the current Level 2 order book from Binance's public REST depth endpoint.
    Returns { "bids": [[price, qty], ...], "asks": [[price, qty], ...], "symbol": symbol, "fetched_at": datetime }
    or None on any network/API failure (never raises — callers must treat None as
    'no real snapshot available right now' with a graceful fallback path).
    """
    formatted_symbol = normalize_symbol_for_binance(symbol)
    url = "https://api.binance.com/api/v3/depth"
    params = {
        "symbol": formatted_symbol,
        "limit": min(limit, 500),
    }
    headers = {"User-Agent": "AETHER-Execution-Engine/1.0"}

    try:
        async with httpx.AsyncClient(timeout=5.0, headers=headers) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                print(f"[Orderbook Depth] Notice: Binance returned HTTP {resp.status_code} for {formatted_symbol}")
                return None
            data = resp.json()
            bids = data.get("bids", [])
            asks = data.get("asks", [])
            return {
                "symbol": formatted_symbol,
                "bids": bids,
                "asks": asks,
                "fetched_at": datetime.now(timezone.utc),
            }
    except Exception as e:
        print(f"[Orderbook Depth] Transient error fetching book for {formatted_symbol}: {e}")
        return None

def compute_imbalance(bids: List[Any], asks: List[Any], depth_levels: int = 20) -> Dict[str, float]:
    """
    Sums bid volume and ask volume across the top `depth_levels` on each side.
    Returns:
      bidVolume: float
      askVolume: float
      imbalanceRatio: float (bidVolume / max(askVolume, 1e-9))
      imbalancePct: float (-1.0 to 1.0, where >0 indicates net buying pressure)
    """
    top_bids = bids[:depth_levels] if bids else []
    top_asks = asks[:depth_levels] if asks else []

    bid_vol = 0.0
    for level in top_bids:
        try:
            qty = float(level[1])
            bid_vol += qty
        except (IndexError, ValueError, TypeError):
            continue

    ask_vol = 0.0
    for level in top_asks:
        try:
            qty = float(level[1])
            ask_vol += qty
        except (IndexError, ValueError, TypeError):
            continue

    total_vol = bid_vol + ask_vol
    if total_vol > 0:
        imbalance_pct = (bid_vol - ask_vol) / total_vol
    else:
        imbalance_pct = 0.0

    imbalance_ratio = bid_vol / max(ask_vol, 1e-9)

    return {
        "bidVolume": round(bid_vol, 4),
        "askVolume": round(ask_vol, 4),
        "imbalanceRatio": round(imbalance_ratio, 4),
        "imbalancePct": round(max(-1.0, min(1.0, imbalance_pct)), 4),
    }
