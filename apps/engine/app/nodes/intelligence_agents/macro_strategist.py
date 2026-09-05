from typing import Any, Dict, Optional
from ..base import NodeContext
from .base import LlmAgentNode

class MacroStrategistNode(LlmAgentNode):
    component_id = "macro-agent"
    default_provider_id = "google"
    default_model_id = "gemini-pro"
    default_system_prompt = (
        "You are a macro strategist. Weigh aggregate sentiment against market regime and any active "
        "event blackout window to form a cautious directional view — capital preservation during "
        "uncertain macro windows takes precedence over chasing sentiment."
    )

    def compute_deterministic_baseline(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        news_feed = self.find_upstream(ctx, "NewsFeed")

        if not news_feed:
            return {
                "direction": "flat",
                "confidence": 0.0,
                "rationale": "No upstream news feed available",
                "applied_rule": "Default Flat (No Data)",
                "reasoning": "Missing NewsFeed input from data collection layer.",
                "no_data": True,
            }

        features = self.find_upstream(ctx, "FeatureVector")
        sentiment_score = float(news_feed.get("sentimentScore", 0.0))
        blackout_active = bool(news_feed.get("blackoutActive", False))
        regime = str(features.get("regime", "Chop")) if (features and "regime" in features) else None

        # 1. Event blackout override takes strict precedence
        if blackout_active:
            return {
                "direction": "flat",
                "confidence": 0.80,
                "rationale": "Macro event blackout active: Exposure halted to protect against volatile macro headline risk.",
                "applied_rule": "Macro_Event_Blackout_Override",
                "input_features": {
                    "sentiment_score": round(sentiment_score, 2),
                    "blackout_active": True,
                    **({"regime": regime} if regime else {}),
                },
            }

        # 2. Sentiment + Regime weighted logic
        bullish_threshold = float(cfg.get("bullishThreshold", 0.25))
        bearish_threshold = float(cfg.get("bearishThreshold", -0.25))
        conf_threshold = float(cfg.get("confidenceThreshold", 0.60))

        direction = "flat"
        confidence = 0.50
        rationale = f"Neutral macro posture: Sentiment score ({sentiment_score:+.2f}) within balanced band."
        applied_rule = "Neutral Macro Filter"

        if sentiment_score > bullish_threshold:
            direction = "long"
            if regime == "Trend":
                calculated_conf = min(0.92, max(conf_threshold, 0.65 + abs(sentiment_score) * 0.4))
                confidence = round(calculated_conf, 2)
                rationale = f"Macro posture risk-on: Bullish sentiment ({sentiment_score:+.2f}) confirmed by trending regime."
                applied_rule = f"Macro_Risk_On_Trend_Aligned (> {bullish_threshold:+.2f})"
            else:
                calculated_conf = min(0.75, max(conf_threshold, 0.50 + abs(sentiment_score) * 0.3))
                confidence = round(calculated_conf, 2)
                rationale = f"Cautious risk-on: Bullish sentiment ({sentiment_score:+.2f}) present, but regime is choppy/unconfirmed."
                applied_rule = f"Macro_Risk_On_Choppy_Discount (> {bullish_threshold:+.2f})"

        elif sentiment_score < bearish_threshold:
            direction = "short"
            if regime == "Trend":
                calculated_conf = min(0.92, max(conf_threshold, 0.65 + abs(sentiment_score) * 0.4))
                confidence = round(calculated_conf, 2)
                rationale = f"Macro posture risk-off: Bearish sentiment ({sentiment_score:+.2f}) confirmed by trending regime."
                applied_rule = f"Macro_Risk_Off_Trend_Aligned (< {bearish_threshold:+.2f})"
            else:
                calculated_conf = min(0.75, max(conf_threshold, 0.50 + abs(sentiment_score) * 0.3))
                confidence = round(calculated_conf, 2)
                rationale = f"Cautious risk-off: Bearish sentiment ({sentiment_score:+.2f}) present, but regime is choppy/unconfirmed."
                applied_rule = f"Macro_Risk_Off_Choppy_Discount (< {bearish_threshold:+.2f})"

        return {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "applied_rule": applied_rule,
            "input_features": {
                "sentiment_score": round(sentiment_score, 2),
                "blackout_active": False,
                **({"regime": regime} if regime else {}),
            },
            "confidence_formula": "regime_weighted(sentiment, regime, min_gate)",
        }

    def build_feature_summary(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        news_feed = self.find_upstream(ctx, "NewsFeed") or {}
        features = self.find_upstream(ctx, "FeatureVector")
        sentiment_score = float(news_feed.get("sentimentScore", 0.0))
        blackout_active = bool(news_feed.get("blackoutActive", False))

        summary = {
            "sentiment_score": round(sentiment_score, 2),
            "blackout_active": blackout_active,
            "close": current_close,
        }
        if features and "regime" in features:
            summary["regime"] = features["regime"]
        return summary
