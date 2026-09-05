from typing import Any, Dict, Optional
from ..base import NodeContext
from .base import LlmAgentNode

class FlowAnalystNode(LlmAgentNode):
    """
    Flow Analyst Node (Layer III: Intelligence Agents).
    Analyzes bid/ask order book depth volume imbalance to detect institutional pressure.
    Scales confidence according to data quality (real Level 2 order book vs OHLCV proxy).
    """
    component_id = "flow-agent"
    default_provider_id = "groq"
    default_model_id = "groq/compound-mini"
    default_system_prompt = (
        "You are an order-flow analyst. Given bid/ask volume imbalance data, form a "
        "directional view based on where real buying or selling pressure is concentrated. "
        "Weight your conviction by the data's quality — a real order-book reading deserves "
        "more confidence than a proxy estimate derived from candle shape alone."
    )

    def find_orderbook_data(self, ctx: NodeContext) -> Optional[dict]:
        """Finds upstream MarketData output specifically containing imbalancePct."""
        for out in ctx.upstream_outputs.values():
            if isinstance(out, dict) and out.get("type") == "MarketData" and "imbalancePct" in out:
                return out
        return None

    def compute_deterministic_baseline(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        book_data = self.find_orderbook_data(ctx)

        if not book_data:
            return {
                "direction": "flat",
                "confidence": 0.0,
                "rationale": "No upstream order book depth or imbalance data available",
                "applied_rule": "Default Flat (No Data)",
                "reasoning": "Missing OrderbookDepth input from data collection layer.",
                "no_data": True,
            }

        imbalance_pct = float(book_data.get("imbalancePct", 0.0))
        data_quality = str(book_data.get("dataQuality", "proxy_from_ohlcv"))
        threshold = float(cfg.get("imbalanceThreshold", 0.25))
        conf_threshold = float(cfg.get("confidenceThreshold", 0.65))

        direction = "flat"
        confidence = 0.50
        rationale = f"Neutral order flow: Imbalance ({imbalance_pct:+.2%}) within balanced band [{-threshold:+.2%}, {threshold:+.2%}]."
        applied_rule = "Neutral Flow Imbalance Band"

        if imbalance_pct > threshold:
            direction = "long"
            raw_conf = 0.55 + abs(imbalance_pct) * 0.4
            if data_quality == "proxy_from_ohlcv":
                # Proxy mode confidence is strictly capped lower
                confidence = round(min(0.65, max(0.50, raw_conf)), 2)
                applied_rule = f"Flow_Imbalance_Bullish_ProxyEstimate (> {threshold:+.2f})"
                rationale = (
                    f"Bullish flow proxy detected: Estimated buy volume pressure ({imbalance_pct:+.2%}) "
                    f"exceeds {threshold:+.2f} threshold (confidence capped at {confidence:.0%} due to proxy data quality)."
                )
            else:
                confidence = round(min(0.92, max(conf_threshold, raw_conf)), 2)
                applied_rule = f"Flow_Imbalance_Bullish_RealOrderbook (> {threshold:+.2f})"
                rationale = (
                    f"Heavy bid liquidity concentration: Live orderbook bid volume exceeds asks by {imbalance_pct:+.2%}."
                )

        elif imbalance_pct < -threshold:
            direction = "short"
            raw_conf = 0.55 + abs(imbalance_pct) * 0.4
            if data_quality == "proxy_from_ohlcv":
                confidence = round(min(0.65, max(0.50, raw_conf)), 2)
                applied_rule = f"Flow_Imbalance_Bearish_ProxyEstimate (< {-threshold:+.2f})"
                rationale = (
                    f"Bearish flow proxy detected: Estimated sell volume pressure ({imbalance_pct:+.2%}) "
                    f"exceeds {-threshold:+.2f} threshold (confidence capped at {confidence:.0%} due to proxy data quality)."
                )
            else:
                confidence = round(min(0.92, max(conf_threshold, raw_conf)), 2)
                applied_rule = f"Flow_Imbalance_Bearish_RealOrderbook (< {-threshold:+.2f})"
                rationale = (
                    f"Heavy ask liquidity resistance: Live orderbook ask volume exceeds bids by {abs(imbalance_pct):.2%}."
                )

        return {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "applied_rule": applied_rule,
            "input_features": {
                "imbalance_pct": round(imbalance_pct, 4),
                "bid_volume": float(book_data.get("bidVolume", 0.0)),
                "ask_volume": float(book_data.get("askVolume", 0.0)),
                "data_quality": data_quality,
            },
        }

    def build_feature_summary(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        book_data = self.find_orderbook_data(ctx) or {}
        return {
            "imbalance_pct": float(book_data.get("imbalancePct", 0.0)),
            "bid_volume": float(book_data.get("bidVolume", 0.0)),
            "ask_volume": float(book_data.get("askVolume", 0.0)),
            "data_quality": str(book_data.get("dataQuality", "proxy_from_ohlcv")),
            "close": current_close,
        }
