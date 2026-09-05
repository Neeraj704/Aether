from typing import Any, Dict, Optional
from ..base import NodeContext
from .base import LlmAgentNode

class TechnicalAnalystNode(LlmAgentNode):
    component_id = "technical-agent"
    default_provider_id = "groq"
    default_model_id = "groq/compound"
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

        style = str(cfg.get("style", "Trend following")).strip()
        oversold = float(cfg.get("rsiOversold", cfg.get("oversold", 30)))
        overbought = float(cfg.get("rsiOverbought", cfg.get("overbought", 70)))
        conf_threshold = float(cfg.get("confidenceThreshold", 0.65))

        direction = "flat"
        confidence = 0.50
        rationale = f"Neutral: RSI ({rsi:.1f}) is within balanced range [{oversold:.0f}, {overbought:.0f}]."
        applied_rule = "Neutral Market Filter"

        # 1. Mean Reversion Style
        if style.lower() == "mean reversion":
            if rsi < oversold:
                direction = "long"
                calculated_conf = 0.70 + (oversold - rsi) * 0.01
                confidence = min(0.95, max(conf_threshold, round(calculated_conf, 2)))
                rationale = f"Oversold bounce detected: RSI ({rsi:.1f}) < {oversold:.0f} threshold."
                applied_rule = f"RSI_Oversold_Bounce (< {oversold:.0f})"
            elif rsi > overbought:
                direction = "short"
                calculated_conf = 0.70 + (rsi - overbought) * 0.01
                confidence = min(0.95, max(conf_threshold, round(calculated_conf, 2)))
                rationale = f"Overbought reversal detected: RSI ({rsi:.1f}) > {overbought:.0f} threshold."
                applied_rule = f"RSI_Overbought_Reversal (> {overbought:.0f})"

        # 2. Breakout Style
        elif style.lower() == "breakout":
            if rsi > 58 and ema_fast > ema_slow and macd > macd_signal:
                direction = "long"
                calculated_conf = 0.72 + (rsi - 58) * 0.01
                confidence = min(0.95, max(conf_threshold, round(calculated_conf, 2)))
                rationale = f"Breakout momentum confirmed: RSI ({rsi:.1f}) with EMA fast ({ema_fast:.2f}) > slow ({ema_slow:.2f}) and positive MACD."
                applied_rule = "Breakout_Expansion_Long"
            elif rsi < 42 and ema_fast < ema_slow and macd < macd_signal:
                direction = "short"
                calculated_conf = 0.72 + (42 - rsi) * 0.01
                confidence = min(0.95, max(conf_threshold, round(calculated_conf, 2)))
                rationale = f"Breakout breakdown confirmed: RSI ({rsi:.1f}) with EMA fast ({ema_fast:.2f}) < slow ({ema_slow:.2f}) and negative MACD."
                applied_rule = "Breakout_Expansion_Short"

        # 3. Trend Following Style (Default)
            # 1. Bullish regime: Fast EMA > Slow EMA (Strict Longs Only)
            if ema_fast > ema_slow * 1.002:
                if 42 <= rsi <= 65 and current_close >= ema_fast * 0.995 and macd > macd_signal:
                    direction = "long"
                    calculated_conf = 0.76 + min(0.16, (rsi - 42) * 0.008)
                    confidence = min(0.92, max(conf_threshold, round(calculated_conf, 2)))
                    rationale = (
                        f"Bullish trend continuation: Fast EMA ({ema_fast:.2f}) > Slow EMA ({ema_slow:.2f}) "
                        f"with pullback bounce at RSI ({rsi:.1f}) and positive MACD momentum."
                    )
                    applied_rule = "Trend_Following_Bullish_EMA_MACD_Alignment"
                else:
                    direction = "flat"
                    confidence = 0.50
                    rationale = f"Bullish regime: Waiting for optimal pullback entry (RSI currently {rsi:.1f})."
                    applied_rule = "Bullish_Regime_Waiting_For_Pullback"

            # 2. Bearish regime: Fast EMA < Slow EMA (Strict Shorts Only)
            elif ema_fast < ema_slow * 0.998:
                if 35 <= rsi <= 58 and current_close <= ema_fast * 1.005 and macd < macd_signal:
                    direction = "short"
                    calculated_conf = 0.76 + min(0.16, (58 - rsi) * 0.008)
                    confidence = min(0.92, max(conf_threshold, round(calculated_conf, 2)))
                    rationale = (
                        f"Bearish trend continuation: Fast EMA ({ema_fast:.2f}) < Slow EMA ({ema_slow:.2f}) "
                        f"with relief rally rejection at RSI ({rsi:.1f}) and negative MACD momentum."
                    )
                    applied_rule = "Trend_Following_Bearish_EMA_MACD_Alignment"
                else:
                    direction = "flat"
                    confidence = 0.50
                    rationale = f"Bearish regime: Waiting for optimal relief rally entry (RSI currently {rsi:.1f})."
                    applied_rule = "Bearish_Regime_Waiting_For_Relief"
            else:
                direction = "flat"
                confidence = 0.50
                rationale = "Neutral regime: Fast/slow moving averages converging (no trend edge)."
                applied_rule = "Neutral_Regime_Filter"

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
