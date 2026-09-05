import asyncio
import json
import re
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db.models import CreditWalletModel, CreditTransactionModel, LlmCallLogModel
from ..nodes.base import NodeContext
from ..billing.wallet import get_or_create_wallet

def redact_model_config(model_config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Defensively strips any raw 'apiKey' material from model config dictionaries.
    Ensures user secrets never leak into audit logs, execution traces, or persisted graphs.
    """
    if not isinstance(model_config, dict):
        return {}
    sanitized = dict(model_config)
    sanitized.pop("apiKey", None)
    return sanitized

# Credit pricing catalog per model (providerId:modelId)
# Mini/Fast tier: 1 credit
# Balanced/General tier: 2 credits
# Frontier/Reasoning tier: 3-4 credits
LLM_CREDIT_COST: Dict[str, int] = {
    # OpenAI
    "openai:gpt-5": 4,
    "openai:gpt-5-mini": 1,
    "openai:gpt-4o": 2,
    # Anthropic
    "anthropic:claude-opus": 4,
    "anthropic:claude-sonnet": 2,
    "anthropic:claude-haiku": 1,
    # Google
    "google:gemini-pro": 3,
    "google:gemini-flash": 1,
    # DeepSeek
    "deepseek:deepseek-v3": 1,
    "deepseek:deepseek-r1": 2,
    # Qwen
    "alibaba:qwen-72b": 2,
    "alibaba:qwen-coder": 1,
    # Groq (Ultra-Fast)
    "groq:openai/gpt-oss-120b": 1,
    "groq:openai/gpt-oss-20b": 1,
    "groq:groq/compound": 1,
    "groq:groq/compound-mini": 1,
    "groq:qwen/qwen3.8-27b": 1,
    "groq:qwen/qwen3.6-27b": 1,
    "groq:llama-3.3-70b-versatile": 1,
    "groq:llama-3.1-8b-instant": 1,
}
DEFAULT_LLM_CREDIT_COST = 2

def get_llm_credit_cost(provider_id: str, model_id: str, has_custom_key: bool = False) -> int:
    """Returns credit cost for a model call. Local (Ollama) and BYOK custom keys are free (0 credits)."""
    if provider_id in ("ollama", "local", "rule-engine") or has_custom_key:
        return 0
    return LLM_CREDIT_COST.get(f"{provider_id}:{model_id}", DEFAULT_LLM_CREDIT_COST)

@dataclass
class LlmSignalResult:
    direction: str            # "long" | "short" | "flat"
    confidence: float         # 0.0–1.0
    rationale: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    latency_ms: int = 0
    raw_status: str = "ok"    # "ok" | "error" | "timeout"
    error_message: Optional[str] = None

def _sanitize_error_message(msg: str) -> str:
    """Strip any accidental API keys or secrets from error messages."""
    for key in (settings.OPENAI_API_KEY, settings.ANTHROPIC_API_KEY, settings.DEEPSEEK_API_KEY, settings.GROQ_API_KEY):
        if key and len(key) > 5:
            msg = msg.replace(key, "[REDACTED_API_KEY]")
    return msg

async def refund_credits(user_id: str, amount: int, db: AsyncSession):
    """Refunds credits back to the user wallet on failed/timed-out LLM calls."""
    if amount <= 0:
        return
    try:
        user_uuid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
    except Exception:
        return
    now = datetime.now(timezone.utc)
    try:
        stmt = (
            update(CreditWalletModel)
            .where(CreditWalletModel.user_id == user_uuid)
            .values(
                balance=CreditWalletModel.balance + amount,
                updated_at=now,
            )
        )
        await db.execute(stmt)
        tx = CreditTransactionModel(
            id=uuid.uuid4(),
            user_id=user_uuid,
            amount=amount,
            reason="llm_call_refund",
            razorpay_payment_id=None,
            created_at=now,
        )
        db.add(tx)
        await db.commit()
    except Exception as e:
        try:
            await db.rollback()
        except Exception:
            pass
        print(f"[LLM Gateway] Error refunding credits: {e}")

async def check_and_debit_credits(user_id: str, cost: int, db: AsyncSession) -> bool:
    """
    Atomically checks if the user has at least `cost` credits and debits them.
    If the wallet row does not exist yet, bootstraps it with 240 starting credits.
    Returns True on successful debit, False if balance is insufficient.
    """
    if cost <= 0:
        return True

    try:
        user_uuid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
    except Exception:
        return False

    now = datetime.now(timezone.utc)

    # 1. Ensure wallet exists (bootstrap with 240 credits if first access)
    await get_or_create_wallet(user_uuid, db)

    # 2. Atomic check-and-debit via single UPDATE WHERE balance >= :cost
    stmt = (
        update(CreditWalletModel)
        .where(
            CreditWalletModel.user_id == user_uuid,
            CreditWalletModel.balance >= cost,
        )
        .values(
            balance=CreditWalletModel.balance - cost,
            updated_at=now,
        )
        .returning(CreditWalletModel.balance)
    )
    result = await db.execute(stmt)
    updated_balance = result.scalar_one_or_none()

    if updated_balance is None:
        # Insufficient credits
        return False

    # 3. Record transaction
    tx = CreditTransactionModel(
        id=uuid.uuid4(),
        user_id=user_uuid,
        amount=-cost,
        reason="llm_call",
        razorpay_payment_id=None,
        created_at=now,
    )
    db.add(tx)
    await db.commit()
    return True

DIRECTION_MAP: Dict[str, str] = {
    # Long
    "long": "long",
    "buy": "long",
    "bullish": "long",
    "accumulate": "long",
    "accumulating": "long",
    "accumulation": "long",
    "call": "long",
    "up": "long",
    "overweight": "long",
    "positive": "long",
    # Short
    "short": "short",
    "sell": "short",
    "bearish": "short",
    "distribute": "short",
    "distributing": "short",
    "distribution": "short",
    "put": "short",
    "down": "short",
    "underweight": "short",
    "negative": "short",
    # Flat
    "flat": "flat",
    "neutral": "flat",
    "hold": "flat",
    "hedging": "flat",
    "hedge": "flat",
    "none": "flat",
    "sideways": "flat",
    "range": "flat",
    "standby": "flat",
    "balanced": "flat",
    "wait": "flat",
    "waiting": "flat",
}

def normalize_direction(raw_direction: Any) -> Optional[str]:
    """Normalizes any LLM direction string/synonym into 'long', 'short', or 'flat'."""
    if not raw_direction:
        return None
    val = str(raw_direction).strip().lower()
    return DIRECTION_MAP.get(val)

def _clean_json_text(raw_text: str) -> Dict[str, Any]:
    """
    Robust, multi-tiered JSON extraction and self-healing parser for LLM outputs.
    Defensively handles:
    - Thinking/reasoning tags (<think>...</think>, <reasoning>...</reasoning>)
    - Markdown code fences (```json ... ```)
    - Trailing commas
    - Single-quoted JSON
    - Truncated JSON due to max_tokens limit (unclosed strings, unclosed braces)
    - Regex fallback for key-value extraction when JSON is severely malformed
    """
    if not raw_text or not raw_text.strip():
        raise ValueError("Empty LLM response")

    text = raw_text.strip()

    # 1. Strip reasoning/thinking tags (DeepSeek R1, Groq Compound, Qwen, etc.)
    text = re.sub(r"<(?:think|reasoning|thought)>[\s\S]*?</(?:think|reasoning|thought)>", "", text, flags=re.IGNORECASE).strip()

    # 2. Extract content from markdown code fences if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()

    # 3. Direct JSON parse attempt
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # 4. Find outermost balanced or candidate JSON object
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        json_candidate = text[first_brace : last_brace + 1].strip()
        try:
            parsed = json.loads(json_candidate)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        # 4a. Fix trailing commas before } or ]
        fixed_commas = re.sub(r",\s*([\}\]])", r"\1", json_candidate)
        try:
            parsed = json.loads(fixed_commas)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

        # 4b. Fix single quotes to double quotes for keys and strings
        fixed_quotes = re.sub(r"(?<=[{\s,])'([a-zA-Z0-9_]+)'\s*:", r'"\1":', fixed_commas)
        fixed_quotes = re.sub(r":\s*'([^']*)'", r': "\1"', fixed_quotes)
        try:
            parsed = json.loads(fixed_quotes)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    # 5. Handle truncated JSON (e.g. max_tokens cutoff mid-generation)
    if first_brace != -1:
        partial = text[first_brace:].strip()
        partial = re.sub(r"```.*$", "", partial, flags=re.DOTALL).strip()
        
        # Balance double quotes
        quote_count = len(re.findall(r'(?<!\\)"', partial))
        if quote_count % 2 != 0:
            partial += '"'
        
        # Remove trailing commas
        partial = re.sub(r",\s*$", "", partial).strip()
        
        # Balance closing braces
        open_braces = partial.count("{")
        close_braces = partial.count("}")
        if open_braces > close_braces:
            partial += "}" * (open_braces - close_braces)
            
        try:
            parsed = json.loads(partial)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass

    # 6. Regex Key-Value Extraction Fallback
    extracted: Dict[str, Any] = {}

    dir_matches = re.findall(
        r'\b(?:direction|signal|view|action|bias|sentiment|opinion)\b[ \t]*[:=][ \t]*["\']?([a-zA-Z_-]+)["\']?',
        raw_text,
        re.IGNORECASE,
    )
    for dm in dir_matches:
        norm_d = normalize_direction(dm)
        if norm_d:
            extracted["direction"] = norm_d
            break
    if "direction" not in extracted and dir_matches:
        extracted["direction"] = dir_matches[0]

    if "direction" not in extracted:
        for kw, mapped in DIRECTION_MAP.items():
            if re.search(rf"\b{kw}\b", raw_text, re.IGNORECASE):
                extracted["direction"] = mapped
                break

    conf_match = re.search(
        r'\b(?:confidence|conf|score|conviction|probability|prob)\b[ \t]*[:=][ \t]*["\']?([0-9]+(?:\.[0-9]+)?%?)["\']?',
        raw_text,
        re.IGNORECASE,
    )
    if conf_match:
        val_str = conf_match.group(1).rstrip("%")
        try:
            c_val = float(val_str)
            if c_val > 1.0 and c_val <= 100.0:
                c_val /= 100.0
            extracted["confidence"] = max(0.0, min(1.0, c_val))
        except Exception:
            pass

    rat_match = re.search(
        r'\b(?:rationale|reason|reasoning|analysis|summary|explanation)\b[ \t]*[:=][ \t]*["\']?([^"\n\r\}]+)',
        raw_text,
        re.IGNORECASE,
    )
    if rat_match:
        extracted["rationale"] = rat_match.group(1).strip()
    elif "direction" in extracted:
        lines = [line.strip() for line in raw_text.splitlines() if line.strip() and not line.startswith(("{", "}", "```", "<"))]
        if lines:
            extracted["rationale"] = lines[0]

    if extracted.get("direction") is not None or extracted.get("rationale") is not None:
        return extracted

    raise ValueError(f"Unable to parse JSON from LLM output: {raw_text[:100]}...")

async def _execute_provider_http_call(
    provider_id: str,
    model_id: str,
    system_prompt: str,
    prompt_payload: dict,
    temperature: float,
    max_tokens: int,
    custom_api_key: Optional[str] = None,
) -> tuple[dict, Optional[int], Optional[int]]:
    """Dispatches raw HTTP request to provider REST endpoint. Returns (parsed_json, prompt_tokens, completion_tokens)."""
    async with httpx.AsyncClient(timeout=settings.LLM_CALL_TIMEOUT_SECONDS) as client:
        if provider_id == "groq":
            key = custom_api_key or settings.GROQ_API_KEY
            if not key:
                raise ValueError("GROQ_API_KEY is not configured on server")

            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            }
            body = {
                "model": model_id or "openai/gpt-oss-120b",
                "messages": [
                    {
                        "role": "system",
                        "content": f"{system_prompt}\nCRITICAL INSTRUCTION: Respond ONLY with a valid JSON object matching the requested schema. Do not output markdown fences or reasoning outside the JSON object.",
                    },
                    {"role": "user", "content": json.dumps(prompt_payload)},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            }

            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code == 400 and ("json_validate_failed" in resp.text or "response_format" in resp.text or "not supported" in resp.text) and "response_format" in body:
                del body["response_format"]
                resp = await client.post(url, headers=headers, json=body)

            if resp.status_code != 200:
                raise ValueError(f"Groq API returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            usage = res_json.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens")
            completion_tokens = usage.get("completion_tokens")
            content = res_json["choices"][0]["message"]["content"]
            parsed = _clean_json_text(content)
            return parsed, prompt_tokens, completion_tokens

        elif provider_id == "openai":
            key = custom_api_key or settings.OPENAI_API_KEY
            if not key:
                raise ValueError("OPENAI_API_KEY is not configured on server")

            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            }
            body = {
                "model": model_id or "gpt-5-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": f"{system_prompt}\nCRITICAL INSTRUCTION: Respond ONLY with a valid JSON object matching the requested schema.",
                    },
                    {"role": "user", "content": json.dumps(prompt_payload)},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            }
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                raise ValueError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            usage = res_json.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens")
            completion_tokens = usage.get("completion_tokens")
            content = res_json["choices"][0]["message"]["content"]
            parsed = _clean_json_text(content)
            return parsed, prompt_tokens, completion_tokens

        elif provider_id == "anthropic":
            key = custom_api_key or settings.ANTHROPIC_API_KEY
            if not key:
                raise ValueError("ANTHROPIC_API_KEY is not configured on server")

            url = "https://api.anthropic.com/v1/messages"
            headers = {
                "x-api-key": key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            }
            body = {
                "model": model_id or "claude-haiku",
                "max_tokens": max_tokens,
                "temperature": temperature,
                "system": f"{system_prompt}\nCRITICAL: Respond with ONLY a raw valid JSON object. Do not wrap in markdown fences or output any other text.",
                "messages": [
                    {"role": "user", "content": json.dumps(prompt_payload)},
                ],
            }
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                raise ValueError(f"Anthropic API returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            usage = res_json.get("usage", {})
            prompt_tokens = usage.get("input_tokens")
            completion_tokens = usage.get("output_tokens")
            content_blocks = res_json.get("content", [])
            raw_text = "".join([b.get("text", "") for b in content_blocks if b.get("type") == "text"])
            parsed = _clean_json_text(raw_text)
            return parsed, prompt_tokens, completion_tokens

        elif provider_id == "deepseek":
            key = custom_api_key or settings.DEEPSEEK_API_KEY
            if not key:
                raise ValueError("DEEPSEEK_API_KEY is not configured on server")

            url = "https://api.deepseek.com/chat/completions"
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            }
            body = {
                "model": model_id or "deepseek-v3",
                "messages": [
                    {
                        "role": "system",
                        "content": f"{system_prompt}\nYou MUST respond ONLY with a valid JSON object matching the requested schema.",
                    },
                    {"role": "user", "content": json.dumps(prompt_payload)},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            }
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                raise ValueError(f"DeepSeek API returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            usage = res_json.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens")
            completion_tokens = usage.get("completion_tokens")
            content = res_json["choices"][0]["message"]["content"]
            parsed = _clean_json_text(content)
            return parsed, prompt_tokens, completion_tokens

        elif provider_id == "google":
            key = custom_api_key or settings.GOOGLE_API_KEY
            if not key:
                raise ValueError("GOOGLE_API_KEY is not configured on server")

            model_slug = model_id or "gemini-flash"
            if model_slug.startswith("gemini-"):
                model_name = model_slug
            else:
                model_name = "gemini-1.5-flash"

            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={key}"
            headers = {"Content-Type": "application/json"}
            prompt_text = f"{system_prompt}\nCRITICAL: Respond with ONLY a raw valid JSON object.\n\nInput Data:\n{json.dumps(prompt_payload)}"
            body = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt_text}],
                    }
                ],
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_tokens,
                    "responseMimeType": "application/json",
                },
            }
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                raise ValueError(f"Google Gemini API returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            usage = res_json.get("usageMetadata", {})
            prompt_tokens = usage.get("promptTokenCount")
            completion_tokens = usage.get("candidatesTokenCount")
            candidates = res_json.get("candidates", [])
            if not candidates or "content" not in candidates[0]:
                raise ValueError(f"Google Gemini API returned unexpected response shape: {res_json}")
            content = candidates[0]["content"]["parts"][0]["text"]
            parsed = _clean_json_text(content)
            return parsed, prompt_tokens, completion_tokens

        elif provider_id == "alibaba":
            key = custom_api_key or settings.ALIBABA_API_KEY
            if not key:
                raise ValueError("ALIBABA_API_KEY is not configured on server")

            url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            }
            body = {
                "model": model_id or "qwen-72b",
                "messages": [
                    {
                        "role": "system",
                        "content": f"{system_prompt}\nYou MUST respond ONLY with a valid JSON object matching the requested schema.",
                    },
                    {"role": "user", "content": json.dumps(prompt_payload)},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            }
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                raise ValueError(f"Alibaba DashScope API returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            usage = res_json.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens")
            completion_tokens = usage.get("completion_tokens")
            content = res_json["choices"][0]["message"]["content"]
            parsed = _clean_json_text(content)
            return parsed, prompt_tokens, completion_tokens

        elif provider_id == "ollama":
            base_url = settings.OLLAMA_BASE_URL.rstrip("/")
            url = f"{base_url}/chat/completions"
            headers = {"Content-Type": "application/json"}
            body = {
                "model": model_id or "llama3",
                "messages": [
                    {
                        "role": "system",
                        "content": f"{system_prompt}\nYou MUST respond ONLY with a valid JSON object matching the requested schema.",
                    },
                    {"role": "user", "content": json.dumps(prompt_payload)},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False,
            }
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                raise ValueError(f"Ollama returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            content = res_json["choices"][0]["message"]["content"]
            parsed = _clean_json_text(content)
            return parsed, None, None

        else:
            raise ValueError(f"Unsupported provider: '{provider_id}'")

async def call_llm_for_signal(
    provider_id: str,
    model_id: str,
    system_prompt: str,
    feature_summary: Dict[str, Any],
    deterministic_baseline: Dict[str, Any],
    temperature: float = 0.4,
    max_tokens: int = 1024,
    custom_api_key: Optional[str] = None,
) -> LlmSignalResult:
    """
    Executes a structured LLM signal call with strict timeout, defensive parsing,
    and exception containment (never raises out, returns error/timeout LlmSignalResult).
    """
    t0 = time.perf_counter()

    # Interpolate prompt template variables if present (e.g. {{input}} -> BTCUSDT)
    symbol_str = str(feature_summary.get("symbol", "BTCUSDT"))
    clean_system_prompt = system_prompt.replace("{{input}}", symbol_str).replace("{input}", symbol_str)

    prompt_payload = {
        "market_features": feature_summary,
        "deterministic_baseline": deterministic_baseline,
        "instructions": (
            "Analyze the market features and deterministic baseline. Form your own quantitative directional view. "
            "Respond ONLY with a valid JSON object in the exact schema: "
            '{"direction": "long" | "short" | "flat", "confidence": <float 0.0 to 1.0>, "rationale": "<one or two sentences>"}'
        ),
    }

    try:
        parsed, prompt_tokens, completion_tokens = await asyncio.wait_for(
            _execute_provider_http_call(
                provider_id=provider_id,
                model_id=model_id,
                system_prompt=clean_system_prompt,
                prompt_payload=prompt_payload,
                temperature=temperature,
                max_tokens=max_tokens,
                custom_api_key=custom_api_key,
            ),
            timeout=settings.LLM_CALL_TIMEOUT_SECONDS,
        )

        latency_ms = int((time.perf_counter() - t0) * 1000)

        # Validate and normalize direction
        raw_direction = str(parsed.get("direction", "")).strip()
        normalized_direction = normalize_direction(raw_direction)

        if not normalized_direction:
            raise ValueError(f"Invalid direction '{raw_direction}' from LLM (must be long/short/flat)")

        try:
            raw_conf = parsed.get("confidence", 0.5)
            val_str = str(raw_conf).rstrip("%")
            conf_f = float(val_str)
            if conf_f > 1.0 and conf_f <= 100.0:
                conf_f /= 100.0
            confidence = max(0.0, min(1.0, conf_f))
        except Exception:
            confidence = float(deterministic_baseline.get("confidence", 0.5))

        rationale = str(parsed.get("rationale", "")).strip()
        if not rationale:
            rationale = f"LLM assessed market features with {normalized_direction} conviction."

        return LlmSignalResult(
            direction=normalized_direction,
            confidence=confidence,
            rationale=rationale,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=latency_ms,
            raw_status="ok",
            error_message=None,
        )

    except asyncio.TimeoutError:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        return LlmSignalResult(
            direction=deterministic_baseline.get("direction", "flat"),
            confidence=float(deterministic_baseline.get("confidence", 0.5)),
            rationale=str(deterministic_baseline.get("rationale", "")),
            latency_ms=latency_ms,
            raw_status="timeout",
            error_message=f"LLM call timed out after {settings.LLM_CALL_TIMEOUT_SECONDS}s",
        )

    except Exception as e:
        latency_ms = int((time.perf_counter() - t0) * 1000)
        clean_err = _sanitize_error_message(str(e))
        return LlmSignalResult(
            direction=deterministic_baseline.get("direction", "flat"),
            confidence=float(deterministic_baseline.get("confidence", 0.5)),
            rationale=str(deterministic_baseline.get("rationale", "")),
            latency_ms=latency_ms,
            raw_status="error",
            error_message=clean_err,
        )

async def log_llm_call(
    ctx: NodeContext,
    node_id: str,
    component_id: str,
    provider: str,
    model: str,
    result: LlmSignalResult,
    credits_charged: int,
):
    """Safely logs an LLM call into the llm_call_log table. Swallows and logs exceptions without interrupting execution."""
    if not ctx.db or not ctx.user_id or not ctx.bot_id:
        return

    try:
        user_uuid = uuid.UUID(str(ctx.user_id))
        bot_uuid = uuid.UUID(str(ctx.bot_id))
        run_uuid = uuid.UUID(str(ctx.run_id)) if ctx.run_id else None
        session_uuid = uuid.UUID(str(ctx.live_session_id)) if ctx.live_session_id else None

        call_log = LlmCallLogModel(
            id=uuid.uuid4(),
            user_id=user_uuid,
            bot_id=bot_uuid,
            run_id=run_uuid,
            live_session_id=session_uuid,
            node_id=node_id,
            component_id=component_id,
            provider=provider,
            model=model,
            status=result.raw_status,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            latency_ms=result.latency_ms,
            credits_charged=credits_charged,
            error_message=result.error_message,
            created_at=datetime.now(timezone.utc),
        )
        ctx.db.add(call_log)
        await ctx.db.commit()
    except Exception as e:
        try:
            await ctx.db.rollback()
        except Exception:
            pass
        print(f"[LLM Gateway] Warning: Failed to insert llm_call_log: {e}")
