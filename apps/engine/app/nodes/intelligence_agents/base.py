from typing import Any, Dict, Optional
from ..base import NodeContext
from ...llm.gateway import (
    call_llm_for_signal,
    check_and_debit_credits,
    refund_credits,
    log_llm_call,
    LlmSignalResult,
    get_llm_credit_cost,
    redact_model_config,
)
from ...llm.key_vault import resolve_byok_key

class LlmAgentNode:
    """
    Shared execution engine for every LLM-eligible intelligence agent node.
    Subclasses implement exactly two hooks: compute_deterministic_baseline() and
    build_feature_summary(). Everything else — mode gating, BYOK resolution, credit
    debit/refund, gateway dispatch, audit logging, and secret redaction — lives here
    exactly once, so every agent node behaves identically w.r.t. cost, security, and
    fallback behavior by construction, not by convention.
    """

    component_id: str = "llm-agent-base"
    default_provider_id: str = "groq"
    default_model_id: str = "openai/gpt-oss-120b"
    default_system_prompt: str = "You are a disciplined market analyst."

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    def find_upstream(self, ctx: NodeContext, output_type: str) -> Optional[dict]:
        """Helper to find the most recent upstream output matching a given type."""
        for out in reversed(list(ctx.upstream_outputs.values())):
            if isinstance(out, dict) and out.get("type") == output_type:
                return out
        return None

    def compute_deterministic_baseline(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        """
        Must return a dict containing at minimum:
        {
            "direction": "long" | "short" | "flat",
            "confidence": float (0.0 to 1.0),
            "rationale": str,
            "applied_rule": str,
            "no_data": bool (optional, default False),
        }
        Subclasses must override.
        """
        raise NotImplementedError

    def build_feature_summary(self, ctx: NodeContext, cfg: dict, current_close: float) -> Dict[str, Any]:
        """
        Must return the plain-dict feature summary sent to the LLM as market context.
        Subclasses must override.
        """
        raise NotImplementedError

    async def run(self, ctx: NodeContext, config: Dict[str, Any]) -> Dict[str, Any]:
        cfg = {**self.config, **config}
        c = ctx.candle
        current_close = float(c.get("close", 0.0) if isinstance(c, dict) else getattr(c, "close", 0.0))

        deterministic_baseline = self.compute_deterministic_baseline(ctx, cfg, current_close)
        direction = deterministic_baseline["direction"]
        confidence = deterministic_baseline["confidence"]
        rationale = deterministic_baseline["rationale"]
        is_no_data = bool(deterministic_baseline.get("no_data", False) or deterministic_baseline.get("applied_rule") == "Default Flat (No Data)")

        system_prompt = cfg.get("systemPrompt", self.default_system_prompt)
        model_config = cfg.get("model", {
            "providerId": self.default_provider_id,
            "modelId": self.default_model_id,
            "temperature": 0.4,
            "maxTokens": 250,
        })
        provider_id = model_config.get("providerId", self.default_provider_id)

        use_llm = (
            not is_no_data
            and provider_id != "rule-engine"
            and ctx.mode in ("paper", "live")
            and ctx.db is not None
            and ctx.user_id is not None
        )

        if is_no_data:
            llm_audit: Dict[str, Any] = {"llm_status": "skipped_no_features"}
        elif ctx.mode not in ("paper", "live"):
            llm_audit = {"llm_status": "skipped_mode"}
        elif provider_id == "rule-engine":
            llm_audit = {"llm_status": "skipped_rule_engine"}
        else:
            llm_audit = {"llm_status": "skipped_no_context"}

        active_node_id = ctx.current_node_id or cfg.get("id", self.component_id)

        if use_llm:
            model_id = model_config.get("modelId", "")
            use_byok = bool(model_config.get("useByok", False))
            custom_api_key = await resolve_byok_key(ctx.user_id, provider_id, ctx.db) if use_byok else None
            cost = get_llm_credit_cost(provider_id, model_id, bool(custom_api_key))
            has_credits = True if custom_api_key else await check_and_debit_credits(ctx.user_id, cost, ctx.db)

            if custom_api_key:
                if len(custom_api_key) > 8:
                    key_preview = f"{custom_api_key[:6]}...{custom_api_key[-4:]} (len: {len(custom_api_key)}, source: user_vault_byok)"
                else:
                    key_preview = f"{custom_api_key} (source: user_vault_byok)"
            else:
                key_preview = "using server managed key" if not use_byok else "no vaulted key found (fell back to server managed key)"

            if not has_credits:
                llm_audit = {
                    "llm_status": "skipped_insufficient_credits",
                    "credits_required": cost,
                    "byok_key_used": key_preview,
                }
                skipped_result = LlmSignalResult(
                    direction=direction,
                    confidence=confidence,
                    rationale=rationale,
                    raw_status="skipped_insufficient_credits",
                    error_message=f"Insufficient credits (required: {cost})",
                )
                await log_llm_call(
                    ctx=ctx,
                    node_id=active_node_id,
                    component_id=self.component_id,
                    provider=provider_id,
                    model=model_id,
                    result=skipped_result,
                    credits_charged=0,
                )
            else:
                feature_summary = self.build_feature_summary(ctx, cfg, current_close)
                user_max_tokens = int(model_config.get("maxTokens", 1024))
                is_reasoning_model = any(k in model_id.lower() for k in ("compound", "r1", "oss", "reasoning", "deep"))
                api_max_tokens = max(512 if is_reasoning_model else 256, min(8192, max(128, user_max_tokens)))

                result = await call_llm_for_signal(
                    provider_id=provider_id,
                    model_id=model_id,
                    system_prompt=system_prompt,
                    feature_summary=feature_summary,
                    deterministic_baseline={"direction": direction, "confidence": confidence, "rationale": rationale},
                    temperature=float(model_config.get("temperature", 0.4)),
                    max_tokens=api_max_tokens,
                    custom_api_key=custom_api_key,
                )
                actual_credits_charged = cost if result.raw_status == "ok" else 0
                if result.raw_status != "ok" and cost > 0:
                    await refund_credits(ctx.user_id, cost, ctx.db)

                await log_llm_call(
                    ctx=ctx,
                    node_id=active_node_id,
                    component_id=self.component_id,
                    provider=provider_id,
                    model=model_id,
                    result=result,
                    credits_charged=actual_credits_charged,
                )

                if result.raw_status == "ok":
                    direction = result.direction
                    confidence = result.confidence
                    rationale = f"[LLM] {result.rationale}"
                    llm_audit = {
                        "llm_status": "ok",
                        "llm_latency_ms": result.latency_ms,
                        "credits_charged": actual_credits_charged,
                        "prompt_tokens": result.prompt_tokens,
                        "completion_tokens": result.completion_tokens,
                        "byok_key_used": key_preview,
                    }
                else:
                    llm_audit = {
                        "llm_status": result.raw_status,
                        "llm_error": result.error_message,
                        "credits_charged": actual_credits_charged,
                        "byok_key_used": key_preview,
                    }

        sanitized_model_config = redact_model_config(model_config)

        clean_baseline = {
            "direction": deterministic_baseline["direction"],
            "confidence": deterministic_baseline["confidence"],
            "rationale": deterministic_baseline["rationale"],
            "applied_rule": deterministic_baseline.get("applied_rule"),
        }

        audit_dict = {
            "system_prompt": system_prompt,
            "model_config": sanitized_model_config,
            "applied_rule": deterministic_baseline.get("applied_rule"),
            "deterministic_baseline": clean_baseline,
            **llm_audit,
        }

        for extra_key in ("input_features", "confidence_formula", "reasoning"):
            if extra_key in deterministic_baseline:
                audit_dict[extra_key] = deterministic_baseline[extra_key]

        return {
            "type": "Signal",
            "direction": direction,
            "confidence": confidence,
            "price": current_close,
            "rationale": rationale,
            "audit": audit_dict,
        }
