from typing import Optional

def fill_price(
    signal_price: float,
    side: str,
    candle_high: float,
    candle_low: float,
    order_size: float,
    candle_volume: float,
    slippage_bps_override: Optional[float] = None,
    taker_fee_bps: float = 10.0,
) -> float:
    """
    Computes realistic execution fill price incorporating bid-ask spread proxy,
    volume-scaled market impact slippage, and venue taker commissions.
    """
    spread_proxy = (candle_high - candle_low) / 2.0
    if slippage_bps_override is not None:
        slip = signal_price * (slippage_bps_override / 10_000.0)
    else:
        participation = min(order_size / max(candle_volume, 1e-9), 1.0)
        # scaled slippage: larger relative to candle volume -> worse fill, capped at 50 bps
        slip = signal_price * (min(participation * 50.0, 50.0) / 10_000.0)
    
    fee = signal_price * (taker_fee_bps / 10_000.0)
    direction = 1 if side == "long" else -1
    return signal_price + direction * (spread_proxy + slip + fee)
