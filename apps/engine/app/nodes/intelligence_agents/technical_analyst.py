from typing import Any, Dict, Optional
from ..base import NodeContext
from .base import LlmAgentNode

class TechnicalAnalystNode(LlmAgentNode):
    component_id = "technical-agent"
    default_provider_id = "groq"
    default_model_id = "openai/gpt-oss-120b"
    default_system_prompt = (
        "You are a disciplined technical analyst. Given the feature vector, form a directional "
        "view based on price structure, momentum indicators, and volume trends."
    )

    def compute_deterministic_baseline(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        features = self.find_upstream(ctx, "FeatureVector")

        if not features:
            return {
                "direction": "flat",
                "confidence": 0.0,
                "rationale": "No upstream feature vector available",
                "applied_rule": "Default Flat (No Data)",
                "reasoning": "Missing FeatureVector input from technical indicators layer.",
                "no_data": True,
            }

        rsi = float(features.get("rsi", 50.0))
        ema_fast = float(features.get("ema_fast", current_close))
        ema_slow = float(features.get("ema_slow", current_close))
        macd = float(features.get("macd", 0.0))
        macd_signal = float(features.get("macd_signal", 0.0))

        oversold = float(cfg.get("rsiOversold", cfg.get("oversold", 30)))
        overbought = float(cfg.get("rsiOverbought", cfg.get("overbought", 70)))
        conf_threshold = float(cfg.get("confidenceThreshold", 0.65))

        direction = "flat"
        confidence = 0.50
        rationale = f"Neutral: RSI ({rsi:.1f}) is within normal band [{oversold:.0f}, {overbought:.0f}]."
        applied_rule = "Neutral Trend Filter"

        # Check Long Condition: RSI oversold with EMA trend support
        if rsi < oversold and ema_fast >= ema_slow * 0.995:
            direction = "long"
            calculated_conf = 0.70 + (oversold - rsi) * 0.01
            confidence = min(0.95, max(conf_threshold, round(calculated_conf, 2)))
            rationale = (
                f"Oversold bounce detected: RSI ({rsi:.1f}) < {oversold:.0f} threshold. "
                f"Fast EMA ({ema_fast:.2f}) is positioned above slow EMA ({ema_slow:.2f}) with MACD ({macd:.2f})."
            )
            applied_rule = f"RSI_Oversold_Bounce (< {oversold:.0f}) + EMA_Trend_Alignment"

        # Check Short Condition: RSI overbought with EMA downward resistance
        elif rsi > overbought and ema_fast <= ema_slow * 1.005:
            direction = "short"
            calculated_conf = 0.70 + (rsi - overbought) * 0.01
            confidence = min(0.95, max(conf_threshold, round(calculated_conf, 2)))
            rationale = (
                f"Overbought reversal detected: RSI ({rsi:.1f}) > {overbought:.0f} threshold. "
                f"Fast EMA ({ema_fast:.2f}) is positioned below slow EMA ({ema_slow:.2f}) with MACD ({macd:.2f})."
            )
            applied_rule = f"RSI_Overbought_Reversal (> {overbought:.0f}) + EMA_Down_Trend"

        return {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "applied_rule": applied_rule,
            "input_features": {
                "rsi": round(rsi, 2),
                "ema_fast": round(ema_fast, 2),
                "ema_slow": round(ema_slow, 2),
                "macd": round(macd, 2),
                "macd_signal": round(macd_signal, 2),
            },
            "confidence_formula": "min(0.95, max(threshold, 0.70 + (delta_rsi * 0.01)))",
        }

    def build_feature_summary(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        features = self.find_upstream(ctx, "FeatureVector") or {}
        rsi = float(features.get("rsi", 50.0))
        ema_fast = float(features.get("ema_fast", current_close))
        ema_slow = float(features.get("ema_slow", current_close))
        macd = float(features.get("macd", 0.0))
        macd_signal = float(features.get("macd_signal", 0.0))

        return {
            "close": current_close,
            "rsi": round(rsi, 2),
            "ema_fast": round(ema_fast, 2),
            "ema_slow": round(ema_slow, 2),
            "macd": round(macd, 2),
            "macd_signal": round(macd_signal, 2),
        }
