from typing import Any, Dict, Optional
import json
from ..base import NodeContext

class TechnicalAnalystNode:
    component_id = "technical-agent"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Directional signal generation with persona prompt formatting, indicator reasoning,
        and transparent quantitative confidence calculation.
        """
        cfg = {**self.config, **config}
        
        # Upstream FeatureVector
        features = None
        for out in ctx.upstream_outputs.values():
            if isinstance(out, dict) and out.get("type") == "FeatureVector":
                features = out
                break

        c = ctx.candle
        current_close = float(c.get("close", 0.0) if isinstance(c, dict) else getattr(c, "close", 0.0))

        if not features:
            return {
                "type": "Signal",
                "direction": "flat",
                "confidence": 0.0,
                "price": current_close,
                "rationale": "No upstream feature vector available",
                "audit": {
                    "reasoning": "Missing FeatureVector input from technical indicators layer.",
                    "applied_rule": "Default Flat (No Data)",
                    "model": cfg.get("model", {"providerId": "rule-engine", "modelId": "rsi-ema-momentum-v1"}),
                }
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
            # Base 70% confidence + 1% per point RSI is below oversold threshold
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
            # Base 70% confidence + 1% per point RSI is above overbought threshold
            calculated_conf = 0.70 + (rsi - overbought) * 0.01
            confidence = min(0.95, max(conf_threshold, round(calculated_conf, 2)))
            rationale = (
                f"Overbought reversal detected: RSI ({rsi:.1f}) > {overbought:.0f} threshold. "
                f"Fast EMA ({ema_fast:.2f}) is positioned below slow EMA ({ema_slow:.2f}) with MACD ({macd:.2f})."
            )
            applied_rule = f"RSI_Overbought_Reversal (> {overbought:.0f}) + EMA_Down_Trend"

        # Formatted Persona prompt & LLM context
        system_prompt = cfg.get(
            "systemPrompt",
            "You are a disciplined technical analyst. Given the feature vector, form a directional view based on price structure, momentum indicators, and volume trends."
        )
        model_config = cfg.get("model", {
            "providerId": "openai",
            "modelId": "gpt-5-mini",
            "temperature": 0.4,
            "maxTokens": 1024,
        })

        return {
            "type": "Signal",
            "direction": direction,
            "confidence": confidence,
            "price": current_close,
            "rationale": rationale,
            "audit": {
                "system_prompt": system_prompt,
                "model_config": model_config,
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
        }
