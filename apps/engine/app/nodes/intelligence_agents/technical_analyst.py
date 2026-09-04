from typing import Any, Dict, Optional
import json
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
                    "deterministic_baseline": {
                        "direction": "flat",
                        "confidence": 0.0,
                        "rationale": "No upstream feature vector available",
                        "applied_rule": "Default Flat (No Data)",
                    },
                    "llm_status": "skipped_no_features",
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

        # Deterministic baseline recording
        deterministic_baseline = {
            "direction": direction,
            "confidence": confidence,
            "rationale": rationale,
            "applied_rule": applied_rule,
        }

        # Formatted Persona prompt & LLM context
        system_prompt = cfg.get(
            "systemPrompt",
            "You are a disciplined technical analyst. Given the feature vector, form a directional view based on price structure, momentum indicators, and volume trends."
        )
        model_config = cfg.get("model", {
            "providerId": "groq",
            "modelId": "openai/gpt-oss-120b",
            "temperature": 0.4,
            "maxTokens": 1024,
        })
        provider_id = model_config.get("providerId", "groq")

        use_llm = (
            provider_id != "rule-engine"
            and ctx.mode in ("paper", "live")
            and ctx.db is not None
            and ctx.user_id is not None
        )

        llm_audit: Dict[str, Any] = {
            "llm_status": "skipped_mode" if ctx.mode not in ("paper", "live") else ("skipped_rule_engine" if provider_id == "rule-engine" else "skipped_no_context")
        }

        if use_llm:
            model_id = model_config.get("modelId", "")
            use_byok = bool(model_config.get("useByok", False))
            custom_api_key = None
            if use_byok:
                custom_api_key = await resolve_byok_key(ctx.user_id, provider_id, ctx.db)

            cost = get_llm_credit_cost(provider_id, model_id, bool(custom_api_key))
            has_credits = await check_and_debit_credits(ctx.user_id, cost, ctx.db)
            active_node_id = ctx.current_node_id or cfg.get("id", "technical-agent")

            if not has_credits:
                llm_audit = {
                    "llm_status": "skipped_insufficient_credits",
                    "credits_required": cost,
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
                feature_summary = {
                    "close": current_close,
                    "rsi": round(rsi, 2),
                    "ema_fast": round(ema_fast, 2),
                    "ema_slow": round(ema_slow, 2),
                    "macd": round(macd, 2),
                    "macd_signal": round(macd_signal, 2),
                }
                result = await call_llm_for_signal(
                    provider_id=provider_id,
                    model_id=model_id,
                    system_prompt=system_prompt,
                    feature_summary=feature_summary,
                    deterministic_baseline={"direction": direction, "confidence": confidence, "rationale": rationale},
                    temperature=float(model_config.get("temperature", 0.4)),
                    max_tokens=int(model_config.get("maxTokens", 1024)),
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
                    }
                else:
                    llm_audit = {
                        "llm_status": result.raw_status,
                        "llm_error": result.error_message,
                        "credits_charged": actual_credits_charged,
                    }
                    # direction, confidence, rationale remain the deterministic baseline

        sanitized_model_config = redact_model_config(model_config)

        return {
            "type": "Signal",
            "direction": direction,
            "confidence": confidence,
            "price": current_close,
            "rationale": rationale,
            "audit": {
                "system_prompt": system_prompt,
                "model_config": sanitized_model_config,
                "applied_rule": applied_rule,
                "deterministic_baseline": deterministic_baseline,
                "input_features": {
                    "rsi": round(rsi, 2),
                    "ema_fast": round(ema_fast, 2),
                    "ema_slow": round(ema_slow, 2),
                    "macd": round(macd, 2),
                    "macd_signal": round(macd_signal, 2),
                },
                "confidence_formula": "min(0.95, max(threshold, 0.70 + (delta_rsi * 0.01)))",
                **llm_audit,
            }
        }
