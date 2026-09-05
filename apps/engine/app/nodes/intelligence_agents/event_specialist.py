from typing import Any, Dict, Optional
from ..base import NodeContext
from .base import LlmAgentNode

class EventSpecialistNode(LlmAgentNode):
    component_id = "event-agent"
    default_provider_id = "openai"
    default_model_id = "gpt-5"
    default_system_prompt = (
        "You are an event-driven specialist. Only take a directional view when there is a specific, "
        "strong catalyst (elevated sentiment magnitude or an active event window). Absent a clear "
        "catalyst, remain flat — this agent's edge comes from selectivity, not from having an opinion on every bar."
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
        blackout_active = bool(news_feed.get("blackoutActive", False))

        # 1. Active event blackout window -> flat with high conviction in risk avoidance
        if blackout_active:
            return {
                "direction": "flat",
                "confidence": 0.85,
                "rationale": "Event blackout window active: High conviction in remaining flat to avoid binary event risk.",
                "applied_rule": "Active_Event_Blackout",
                "input_features": {
                    "sentiment_score": round(sentiment_score, 2),
                    "blackout_active": True,
                },
            }

        # 2. Catalyst selectivity: only trade on unusually strong signals
        event_threshold = float(cfg.get("eventThreshold", 0.50))
        conf_threshold = float(cfg.get("confidenceThreshold", 0.70))

        if sentiment_score > event_threshold:
            direction = "long"
            calculated_conf = min(0.95, max(conf_threshold, 0.70 + (sentiment_score - event_threshold) * 0.5))
            confidence = round(calculated_conf, 2)
            rationale = (
                f"Major bullish catalyst detected: Sentiment magnitude ({sentiment_score:+.2f}) "
                f"exceeds event catalyst threshold ({event_threshold:+.2f})."
            )
            applied_rule = f"Event_Bullish_Catalyst (> {event_threshold:+.2f})"

        elif sentiment_score < -event_threshold:
            direction = "short"
            calculated_conf = min(0.95, max(conf_threshold, 0.70 + (abs(sentiment_score) - event_threshold) * 0.5))
            confidence = round(calculated_conf, 2)
            rationale = (
                f"Major bearish catalyst detected: Sentiment magnitude ({sentiment_score:+.2f}) "
                f"exceeds event catalyst threshold ({-event_threshold:+.2f})."
            )
            applied_rule = f"Event_Bearish_Catalyst (< {-event_threshold:+.2f})"

        else:
            direction = "flat"
            confidence = 0.40
            rationale = (
                f"No active catalyst: Sentiment magnitude ({abs(sentiment_score):.2f}) is below "
                f"discrete event threshold ({event_threshold:.2f}). Remaining flat."
            )
            applied_rule = "No_Active_Catalyst"

        return {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "applied_rule": applied_rule,
            "input_features": {
                "sentiment_score": round(sentiment_score, 2),
                "blackout_active": False,
            },
            "confidence_formula": "selective_catalyst(sentiment, event_threshold, conf_threshold)",
        }

    def build_feature_summary(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        news_feed = self.find_upstream(ctx, "NewsFeed") or {}
        sentiment_score = float(news_feed.get("sentimentScore", 0.0))
        blackout_active = bool(news_feed.get("blackoutActive", False))

        return {
            "sentiment_score": round(sentiment_score, 2),
            "blackout_active": blackout_active,
            "close": current_close,
        }
