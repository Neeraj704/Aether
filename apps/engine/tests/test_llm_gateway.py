import asyncio
import json
import uuid
import pytest
from unittest.mock import patch, AsyncMock
from sqlalchemy import select, update

from apps.engine.app.config import settings
from apps.engine.app.db.session import AsyncSessionLocal
from apps.engine.app.db.models import (
    CreditWalletModel,
    CreditTransactionModel,
    LlmCallLogModel,
    BotModel,
    BacktestRunModel,
)
from apps.engine.app.nodes.base import NodeContext
from apps.engine.app.nodes.intelligence_agents.technical_analyst import TechnicalAnalystNode
from apps.engine.app.llm.gateway import (
    call_llm_for_signal,
    check_and_debit_credits,
    log_llm_call,
    LlmSignalResult,
    LLM_CREDIT_COST,
)

async def get_test_user_id() -> str:
    async with AsyncSessionLocal() as session:
        from sqlalchemy import text
        res = await session.execute(text("SELECT id FROM auth.users LIMIT 1"))
        row = res.first()
        return str(row[0]) if row else str(uuid.uuid4())

@pytest.mark.asyncio
async def test_successful_llm_signal_parsing():
    """A successful OpenAI-shaped response parses into a valid LlmSignalResult with raw_status='ok'."""
    mock_response_data = {
        "id": "chatcmpl-test-123",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "direction": "long",
                        "confidence": 0.88,
                        "rationale": "Strong EMA trend alignment with RSI oversold recovery."
                    })
                }
            }
        ],
        "usage": {
            "prompt_tokens": 120,
            "completion_tokens": 35,
            "total_tokens": 155,
        }
    }

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = lambda: mock_response_data

    with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "sk-test-key-valid"):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            result = await call_llm_for_signal(
                provider_id="openai",
                model_id="gpt-5-mini",
                system_prompt="Test system prompt",
                feature_summary={"rsi": 28.5, "ema_fast": 65000, "ema_slow": 64500},
                deterministic_baseline={"direction": "long", "confidence": 0.72, "rationale": "Baseline oversold"},
            )

            assert result.raw_status == "ok"
            assert result.direction == "long"
            assert result.confidence == 0.88
            assert "Strong EMA trend" in result.rationale
            assert result.prompt_tokens == 120
            assert result.completion_tokens == 35
            assert result.latency_ms >= 0
            assert result.error_message is None

@pytest.mark.asyncio
async def test_successful_groq_signal_parsing():
    """A successful Groq API response parses into a valid LlmSignalResult with raw_status='ok' and correct credit cost."""
    mock_response_data = {
        "id": "chatcmpl-groq-test-789",
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "direction": "short",
                        "confidence": 0.91,
                        "rationale": "Groq Llama 3.3 detected clear resistance rejection with overbought momentum."
                    })
                }
            }
        ],
        "usage": {
            "prompt_tokens": 145,
            "completion_tokens": 28,
            "total_tokens": 173,
        }
    }

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.json = lambda: mock_response_data

    with patch("apps.engine.app.config.settings.GROQ_API_KEY", "gsk_test_key_valid"):
        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            result = await call_llm_for_signal(
                provider_id="groq",
                model_id="openai/gpt-oss-120b",
                system_prompt="Analyze market technical indicators.",
                feature_summary={"rsi": 78.0, "ema_fast": 63000, "ema_slow": 63500},
                deterministic_baseline={"direction": "short", "confidence": 0.75, "rationale": "Overbought baseline"},
            )

            assert result.raw_status == "ok"
            assert result.direction == "short"
            assert result.confidence == 0.91
            assert "Groq" in result.rationale
            assert result.prompt_tokens == 145
            assert result.completion_tokens == 28
            assert result.error_message is None

            # Verify Groq URL and Authorization header
            call_args = mock_post.call_args
            assert call_args[0][0] == "https://api.groq.com/openai/v1/chat/completions"
            assert call_args[1]["headers"]["Authorization"] == "Bearer gsk_test_key_valid"

@pytest.mark.asyncio
async def test_malformed_json_and_invalid_direction_handling():
    """A malformed-JSON or invalid direction response results in raw_status='error', never an unhandled exception."""
    # 1. Invalid direction value (e.g. 'bullish' instead of 'long')
    invalid_dir_resp = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": '{"direction": "bullish", "confidence": 0.9, "rationale": "Bullish breakout"}'
                }
            }
        ]
    }
    mock_resp1 = AsyncMock()
    mock_resp1.status_code = 200
    mock_resp1.json = lambda: invalid_dir_resp

    with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "sk-test-key-valid"):
        with patch("httpx.AsyncClient.post", return_value=mock_resp1):
            result1 = await call_llm_for_signal(
                provider_id="openai",
                model_id="gpt-5-mini",
                system_prompt="Test prompt",
                feature_summary={"rsi": 45},
                deterministic_baseline={"direction": "flat", "confidence": 0.5, "rationale": "Neutral filter"},
            )
            assert result1.raw_status == "error"
            assert result1.direction == "flat"  # Fallback to baseline
            assert result1.error_message is not None
            assert "Invalid direction 'bullish'" in result1.error_message

    # 2. Total garbage non-JSON response
    mock_resp2 = AsyncMock()
    mock_resp2.status_code = 200
    mock_resp2.json = lambda: {
        "choices": [{"message": {"role": "assistant", "content": "I am thinking about this trade..."}}]
    }

    with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "sk-test-key-valid"):
        with patch("httpx.AsyncClient.post", return_value=mock_resp2):
            result2 = await call_llm_for_signal(
                provider_id="openai",
                model_id="gpt-5-mini",
                system_prompt="Test prompt",
                feature_summary={"rsi": 45},
                deterministic_baseline={"direction": "short", "confidence": 0.65, "rationale": "Overbought"},
            )
            assert result2.raw_status == "error"
            assert result2.direction == "short"  # Fallback to baseline
            assert result2.error_message is not None

@pytest.mark.asyncio
async def test_llm_timeout_handling():
    """A simulated timeout results in raw_status='timeout', never an unhandled exception, within bounded test time."""
    async def slow_post(*args, **kwargs):
        await asyncio.sleep(0.5)
        raise asyncio.TimeoutError()

    with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "sk-test-key-valid"):
        with patch("apps.engine.app.config.settings.LLM_CALL_TIMEOUT_SECONDS", 0.05):
            with patch("httpx.AsyncClient.post", side_effect=slow_post):
                result = await call_llm_for_signal(
                    provider_id="openai",
                    model_id="gpt-5-mini",
                    system_prompt="Test prompt",
                    feature_summary={"rsi": 30},
                    deterministic_baseline={"direction": "long", "confidence": 0.70, "rationale": "Oversold baseline"},
                )
                assert result.raw_status == "timeout"
                assert result.direction == "long"
                assert result.confidence == 0.70
                assert "timed out" in result.error_message.lower()

@pytest.mark.asyncio
async def test_check_and_debit_credits_atomic():
    """check_and_debit_credits correctly refuses to debit when balance is insufficient, and debits atomically when sufficient."""
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        session.expire_all()
        # Set exact wallet balance to 5 credits
        await session.execute(
            update(CreditWalletModel)
            .where(CreditWalletModel.user_id == user_uuid)
            .values(balance=5)
        )
        await session.commit()
        session.expire_all()

        # 1. Attempt debit of 10 credits (insufficient -> should fail)
        success1 = await check_and_debit_credits(test_user_id, cost=10, db=session)
        assert success1 is False

        # Verify wallet balance remained untouched at exactly 5
        session.expire_all()
        res1 = await session.execute(select(CreditWalletModel.balance).where(CreditWalletModel.user_id == user_uuid))
        bal1 = res1.scalar_one()
        assert float(bal1) == 5.0

        # 2. Attempt debit of 2 credits (sufficient -> should succeed)
        success2 = await check_and_debit_credits(test_user_id, cost=2, db=session)
        assert success2 is True

        # Verify exact post-call balance is 3
        session.expire_all()
        res2 = await session.execute(select(CreditWalletModel.balance).where(CreditWalletModel.user_id == user_uuid))
        bal2 = res2.scalar_one()
        assert float(bal2) == 3.0

        # Reset wallet to 240
        await session.execute(
            update(CreditWalletModel)
            .where(CreditWalletModel.user_id == user_uuid)
            .values(balance=240)
        )
        await session.commit()

@pytest.mark.asyncio
async def test_historical_mode_never_invokes_llm_gateway():
    """Running TechnicalAnalystNode with ctx.mode='historical' NEVER attempts an HTTP call even if an LLM provider is configured."""
    node = TechnicalAnalystNode()
    candle = {"close": 60000.0, "open": 59900.0, "high": 60100.0, "low": 59800.0, "volume": 100}
    upstream = {
        "features": {
            "type": "FeatureVector",
            "rsi": 25.0,  # oversold
            "ema_fast": 60200.0,
            "ema_slow": 60000.0,
            "macd": 10.0,
            "macd_signal": 5.0,
        }
    }

    ctx = NodeContext(
        candle=candle,
        portfolio=None,
        upstream_outputs=upstream,
        mode="historical",
        user_id="test-user-123",
        bot_id="test-bot-123",
        db=None,
    )

    node_config = {
        "model": {
            "providerId": "openai",
            "modelId": "gpt-5-mini",
            "temperature": 0.4,
            "maxTokens": 1024,
        },
        "rsiOversold": 30,
        "rsiOverbought": 70,
    }

    # Patch httpx.AsyncClient to fail if called
    with patch("httpx.AsyncClient.post", side_effect=RuntimeError("HTTP call must never happen in historical mode!")) as mock_post:
        output = await node.run(ctx, node_config)

        # Assert no HTTP call was made
        mock_post.assert_not_called()

        assert output["type"] == "Signal"
        assert output["direction"] == "long"
        assert output["confidence"] >= 0.70
        assert output["audit"]["llm_status"] == "skipped_mode"
        assert "deterministic_baseline" in output["audit"]
        assert output["audit"]["deterministic_baseline"]["direction"] == "long"

@pytest.mark.asyncio
async def test_paper_mode_llm_execution_and_fallback_on_error():
    """Running TechnicalAnalystNode with ctx.mode='paper' attempts call, and on failure falls back to exact deterministic baseline."""
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        # Ensure user has plenty of credits
        await session.execute(
            update(CreditWalletModel)
            .where(CreditWalletModel.user_id == user_uuid)
            .values(balance=100)
        )
        await session.commit()

        node = TechnicalAnalystNode()
        candle = {"close": 65000.0}
        upstream = {
            "features": {
                "type": "FeatureVector",
                "rsi": 75.0,  # overbought -> deterministic baseline is 'short'
                "ema_fast": 64000.0,
                "ema_slow": 64500.0,
                "macd": -15.0,
                "macd_signal": -10.0,
            }
        }

        # 1. Successful LLM call in paper mode
        mock_success_resp = AsyncMock()
        mock_success_resp.status_code = 200
        mock_success_resp.json = lambda: {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps({
                            "direction": "short",
                            "confidence": 0.94,
                            "rationale": "High conviction top resistance rejection.",
                        })
                    }
                }
            ],
            "usage": {"prompt_tokens": 150, "completion_tokens": 40}
        }

        # Ensure user has a valid test bot and run for foreign keys
        bot_res = await session.execute(select(BotModel).where(BotModel.user_id == user_uuid))
        bot = bot_res.scalars().first()
        if not bot:
            bot = BotModel(
                id=uuid.uuid4(),
                user_id=user_uuid,
                name="Test Paper Bot",
                status="active",
                graph={"nodes": [], "edges": []},
            )
            session.add(bot)
            await session.commit()

        run_id = uuid.uuid4()
        run = BacktestRunModel(
            id=run_id,
            bot_id=bot.id,
            user_id=user_uuid,
            status="running",
            config={"type": "paper", "capital": 100000},
        )
        session.add(run)
        await session.commit()

        ctx_paper = NodeContext(
            candle=candle,
            portfolio=None,
            upstream_outputs=upstream,
            mode="paper",
            user_id=test_user_id,
            bot_id=str(bot.id),
            run_id=str(run.id),
            db=session,
        )

        node_config = {
            "model": {
                "providerId": "openai",
                "modelId": "gpt-5-mini",
                "temperature": 0.4,
                "maxTokens": 1024,
            },
            "rsiOversold": 30,
            "rsiOverbought": 70,
        }

        with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "sk-valid-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_success_resp):
                output = await node.run(ctx_paper, node_config)
                assert output["direction"] == "short"
                assert output["confidence"] == 0.94
                assert "[LLM]" in output["rationale"]
                assert output["audit"]["llm_status"] == "ok"
                assert output["audit"]["credits_charged"] == 1

        # Verify llm_call_log row exists in database
        log_res = await session.execute(
            select(LlmCallLogModel).where(LlmCallLogModel.run_id == run.id)
        )
        log_row = log_res.scalars().first()
        assert log_row is not None
        assert log_row.status == "ok"
        assert log_row.provider == "openai"
        assert log_row.model == "gpt-5-mini"
        assert int(log_row.credits_charged) == 1

        # 2. Failed LLM call (e.g. 500 error from provider) -> must fall back gracefully to deterministic rule
        mock_fail_resp = AsyncMock()
        mock_fail_resp.status_code = 500
        mock_fail_resp.text = "Internal Server Error"

        with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "sk-valid-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_fail_resp):
                output_fallback = await node.run(ctx_paper, node_config)
                # Must fall back to deterministic baseline ('short' due to RSI 75.0 > 70)
                assert output_fallback["direction"] == "short"
                assert output_fallback["confidence"] >= 0.70
                assert output_fallback["audit"]["llm_status"] == "error"
                assert "deterministic_baseline" in output_fallback["audit"]
                assert output_fallback["audit"]["deterministic_baseline"]["direction"] == "short"
