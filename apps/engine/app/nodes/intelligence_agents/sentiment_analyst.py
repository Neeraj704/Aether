from typing import Any, Dict, Optional
from ..base import NodeContext
from .base import LlmAgentNode

class SentimentAnalystNode(LlmAgentNode):
    component_id = "sentiment-agent"
    default_provider_id = "anthropic"
    default_model_id = "claude-sonnet"
    default_system_prompt = (
        "You are a disciplined sentiment analyst. Given aggregated social and news sentiment signal, "
        "form a directional view, weighing signal strength against potential noise or manipulation in social sentiment data."
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

        sentiment_score = float(news_feed.get("sentimentScore", 0.0))
        bullish_threshold = float(cfg.get("bullishThreshold", 0.3))
        bearish_threshold = float(cfg.get("bearishThreshold", -0.3))
        conf_threshold = float(cfg.get("confidenceThreshold", 0.65))

        direction = "flat"
        confidence = 0.50
        rationale = f"Neutral: Sentiment score ({sentiment_score:+.2f}) is within normal band [{bearish_threshold:+.2f}, {bullish_threshold:+.2f}]."
        applied_rule = "Neutral Sentiment Filter"

        if sentiment_score > bullish_threshold:
            direction = "long"
            calculated_conf = min(0.90, max(conf_threshold, 0.55 + abs(sentiment_score) * 0.5))
            confidence = round(calculated_conf, 2)
            rationale = (
                f"Bullish narrative tone detected: Sentiment score ({sentiment_score:+.2f}) > {bullish_threshold:+.2f} threshold."
            )
            applied_rule = f"Sentiment_Bullish_Threshold (> {bullish_threshold:+.2f})"

        elif sentiment_score < bearish_threshold:
            direction = "short"
            calculated_conf = min(0.90, max(conf_threshold, 0.55 + abs(sentiment_score) * 0.5))
            confidence = round(calculated_conf, 2)
            rationale = (
                f"Bearish narrative tone detected: Sentiment score ({sentiment_score:+.2f}) < {bearish_threshold:+.2f} threshold."
            )
            applied_rule = f"Sentiment_Bearish_Threshold (< {bearish_threshold:+.2f})"

        return {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "applied_rule": applied_rule,
            "input_features": {
                "sentiment_score": round(sentiment_score, 2),
            },
            "confidence_formula": "min(0.90, max(threshold, 0.55 + abs(sentiment_score) * 0.5))",
        }

    def build_feature_summary(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        news_feed = self.find_upstream(ctx, "NewsFeed") or {}
        sentiment_score = float(news_feed.get("sentimentScore", 0.0))

        return {
            "sentiment_score": round(sentiment_score, 2),
            "close": current_close,
        }
