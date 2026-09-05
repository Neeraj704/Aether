from typing import Any, Dict, Optional
from ..base import NodeContext
from .base import LlmAgentNode

class ContrarianAgentNode(LlmAgentNode):
    """
    Contrarian Analyst Node (Layer III: Intelligence Agents).
    Evaluates an upstream Signal for crowded overextension.
    Fades excessive conviction (confidence >= fadeThreshold) and defers to incoming view otherwise.
    """
    component_id = "contrarian-agent"
    default_provider_id = "anthropic"
    default_model_id = "claude-haiku"
    default_system_prompt = (
        "You are a contrarian analyst. Your job is to identify when another agent's "
        "conviction may be overextended — excessive confidence is often a late-stage "
        "signal, not a strong one. You do not automatically oppose every signal; you "
        "only push back when the incoming conviction looks crowded or overconfident. "
        "Absent that condition, defer to the incoming view rather than manufacturing "
        "disagreement for its own sake."
    )

    def compute_deterministic_baseline(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        signal = self.find_upstream(ctx, "Signal")

        if not signal:
            return {
                "direction": "flat",
                "confidence": 0.0,
                "rationale": "No upstream directional signal to evaluate",
                "applied_rule": "Default Flat (No Data)",
                "reasoning": "Missing upstream Signal input to contest or evaluate.",
                "no_data": True,
            }

        incoming_direction = str(signal.get("direction", "flat")).lower()
        incoming_conf = float(signal.get("confidence", 0.50))
        fade_threshold = float(cfg.get("fadeThreshold", 0.85))

        # Case 1: Overextended extreme conviction -> Fade the crowd
        if incoming_conf >= fade_threshold and incoming_direction in ("long", "short"):
            direction = "short" if incoming_direction == "long" else "long"
            calculated_conf = min(0.70, 0.40 + (incoming_conf - fade_threshold) * 2.0)
            confidence = round(max(0.40, calculated_conf), 2)
            applied_rule = f"Contrarian_Fade_Overextended_Conviction (>= {fade_threshold:.2f})"
            rationale = (
                f"Fading crowded conviction: Incoming {incoming_direction.upper()} signal shows extreme confidence "
                f"({incoming_conf:.0%}), indicating high vulnerability to positioning squeeze/exhaustion."
            )
        # Case 2: Balanced / moderate / flat signal -> Defer to incoming consensus
        else:
            direction = incoming_direction
            if direction in ("long", "short"):
                confidence = round(max(0.35, incoming_conf * 0.80), 2)
            else:
                confidence = 0.50
            applied_rule = "Contrarian_Defers_No_Crowding_Detected"
            rationale = (
                f"No crowding detected: Incoming {incoming_direction.upper()} signal confidence "
                f"({incoming_conf:.0%}) is below {fade_threshold:.2f} fade threshold. Deferring to consensus view."
            )

        return {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "applied_rule": applied_rule,
            "input_features": {
                "incoming_direction": incoming_direction,
                "incoming_confidence": incoming_conf,
                "incoming_rationale": signal.get("rationale", ""),
                "fade_threshold": fade_threshold,
            },
        }

    def build_feature_summary(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        signal = self.find_upstream(ctx, "Signal") or {}
        return {
            "incoming_direction": signal.get("direction", "flat"),
            "incoming_confidence": float(signal.get("confidence", 0.50)),
            "incoming_rationale": signal.get("rationale", ""),
            "close": current_close,
        }
