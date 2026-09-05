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
from apps.engine.app.nodes.intelligence_agents.sentiment_analyst import SentimentAnalystNode
from apps.engine.app.nodes.intelligence_agents.macro_strategist import MacroStrategistNode
from apps.engine.app.nodes.intelligence_agents.event_specialist import EventSpecialistNode
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
    # 1. Truly unparseable direction value (e.g. 'unsupported_signal')
    invalid_dir_resp = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": '{"direction": "unsupported_signal", "confidence": 0.9, "rationale": "Unknown bias"}'
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
            assert "Invalid direction 'unsupported_signal'" in result1.error_message

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
async def test_llm_json_self_repair_and_synonym_normalization():
    """Deep customization outputs (thinking tags, BUY/SELL, truncated JSON, trailing commas) parse cleanly."""
    # 1. Groq compound-mini thinking tag + unclosed JSON due to max_tokens cutoff
    groq_thinking_content = '<think>Analyzing ask volume 4.4128 and bid volume 0.0414. Imbalance is -98.14%.</think>{\n  "direction": "distributing",\n  "confidence": 0.92,\n  "rationale": "Heavy ask liquidity resistance: Live orderbook ask volume exceeds bids by 98.14%.'
    mock_resp_groq = AsyncMock()
    mock_resp_groq.status_code = 200
    mock_resp_groq.json = lambda: {
        "choices": [{"message": {"role": "assistant", "content": groq_thinking_content}}],
        "usage": {"prompt_tokens": 150, "completion_tokens": 80}
    }

    with patch("apps.engine.app.config.settings.GROQ_API_KEY", "gsk_test_key_valid"):
        with patch("httpx.AsyncClient.post", return_value=mock_resp_groq):
            res_groq = await call_llm_for_signal(
                provider_id="groq",
                model_id="groq/compound-mini",
                system_prompt="You are an institutional order-flow analyst in {{input}}.",
                feature_summary={"symbol": "BTCUSDT", "imbalance_pct": -0.98},
                deterministic_baseline={"direction": "short", "confidence": 0.90, "rationale": "Baseline"},
            )
            assert res_groq.raw_status == "ok"
            assert res_groq.direction == "short"
            assert res_groq.confidence == 0.92
            assert "Heavy ask liquidity resistance" in res_groq.rationale

    # 2. GPT OSS with reasoning text and BUY / SELL / HOLD format
    gpt_oss_content = 'Based on the technical features (RSI 44.0, EMA Fast 79843), here is the quantitative view:\nSignal: HOLD\nConfidence: 50%\nRationale: Neutral: RSI (44.0) is within balanced range [35, 65].'
    mock_resp_gpt = AsyncMock()
    mock_resp_gpt.status_code = 200
    mock_resp_gpt.json = lambda: {
        "choices": [{"message": {"role": "assistant", "content": gpt_oss_content}}],
        "usage": {"prompt_tokens": 180, "completion_tokens": 60}
    }

    with patch("apps.engine.app.config.settings.GROQ_API_KEY", "gsk_test_key_valid"):
        with patch("httpx.AsyncClient.post", return_value=mock_resp_gpt):
            res_gpt = await call_llm_for_signal(
                provider_id="groq",
                model_id="openai/gpt-oss-120b",
                system_prompt="Output your view (BUY, SELL, or HOLD)",
                feature_summary={"rsi": 44.0},
                deterministic_baseline={"direction": "flat", "confidence": 0.50, "rationale": "Baseline"},
            )
            assert res_gpt.raw_status == "ok"
            assert res_gpt.direction == "flat"
            assert res_gpt.confidence == 0.50
            assert "Neutral: RSI" in res_gpt.rationale

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

@pytest.mark.asyncio
async def test_key_vault_encryption_decryption_and_resolution():
    """Fernet encryption encrypts raw keys into opaque ciphertext and decrypts faithfully back."""
    from apps.engine.app.llm.key_vault import encrypt_key, decrypt_key, resolve_byok_key
    from apps.engine.app.db.models import UserProviderKeyModel

    raw_secret = "gsk_super_secret_user_key_999"
    ciphertext = encrypt_key(raw_secret)
    assert ciphertext != raw_secret
    assert "gsk_super_secret" not in ciphertext

    decrypted = decrypt_key(ciphertext)
    assert decrypted == raw_secret

    # Test DB resolution with backup/restore of existing row
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        # Save existing row if any
        res = await session.execute(
            select(UserProviderKeyModel).where(
                UserProviderKeyModel.user_id == user_uuid,
                UserProviderKeyModel.provider_id == "groq",
            )
        )
        orig_row = res.scalars().first()
        orig_encrypted = orig_row.encrypted_key if orig_row else None

        # Upsert test provider key in DB
        if orig_row:
            orig_row.encrypted_key = ciphertext
        else:
            session.add(
                UserProviderKeyModel(
                    user_id=user_uuid,
                    provider_id="groq",
                    encrypted_key=ciphertext,
                )
            )
        await session.commit()

        # Resolve via resolve_byok_key
        resolved = await resolve_byok_key(user_uuid, "groq", session)
        assert resolved == raw_secret

        # Non-existent provider returns None
        resolved_missing = await resolve_byok_key(user_uuid, "anthropic", session)
        if not resolved_missing:
            assert resolved_missing is None

        # Restore original row
        if orig_encrypted is not None:
            res_rest = await session.execute(
                select(UserProviderKeyModel).where(
                    UserProviderKeyModel.user_id == user_uuid,
                    UserProviderKeyModel.provider_id == "groq",
                )
            )
            rest_row = res_rest.scalars().first()
            if rest_row:
                rest_row.encrypted_key = orig_encrypted
                await session.commit()

@pytest.mark.asyncio
async def test_byok_audit_and_graph_redaction():
    """TechnicalAnalystNode returns sanitized audit.model_config with no apiKey field anywhere."""
    from apps.engine.app.llm.key_vault import encrypt_key
    from apps.engine.app.db.models import UserProviderKeyModel
    from apps.engine.app.llm.gateway import redact_model_config

    # Test standalone redaction helper
    leaky_config = {
        "providerId": "groq",
        "modelId": "openai/gpt-oss-120b",
        "apiKey": "gsk_leaked_key_12345",
        "useByok": True,
        "temperature": 0.4,
    }
    cleaned = redact_model_config(leaky_config)
    assert "apiKey" not in cleaned
    assert cleaned["useByok"] is True

    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        # Save existing row if any
        res = await session.execute(
            select(UserProviderKeyModel).where(
                UserProviderKeyModel.user_id == user_uuid,
                UserProviderKeyModel.provider_id == "groq",
            )
        )
        orig_row = res.scalars().first()
        orig_encrypted = orig_row.encrypted_key if orig_row else None

        # Vault a key for groq
        enc_key = encrypt_key("gsk_user_vaulted_key")
        if orig_row:
            orig_row.encrypted_key = enc_key
        else:
            session.add(
                UserProviderKeyModel(
                    user_id=user_uuid,
                    provider_id="groq",
                    encrypted_key=enc_key,
                )
            )
        await session.commit()

        node = TechnicalAnalystNode()
        candle = {"close": 70000.0}
        upstream = {
            "features": {
                "type": "FeatureVector",
                "rsi": 20.0,
                "ema_fast": 70500.0,
                "ema_slow": 70000.0,
            }
        }

        ctx = NodeContext(
            candle=candle,
            portfolio=None,
            upstream_outputs=upstream,
            mode="paper",
            user_id=test_user_id,
            bot_id=str(uuid.uuid4()),
            db=session,
            current_node_id="analyst-node-canvas-1",
        )

        mock_resp = AsyncMock()
        mock_resp.status_code = 200
        mock_resp.json = lambda: {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": json.dumps({"direction": "long", "confidence": 0.85, "rationale": "BYOK test OK"}),
                    }
                }
            ],
            "usage": {"prompt_tokens": 50, "completion_tokens": 20},
        }

        with patch("httpx.AsyncClient.post", return_value=mock_resp) as mock_post:
            output = await node.run(ctx, {
                "model": {
                    "providerId": "groq",
                    "modelId": "openai/gpt-oss-120b",
                    "useByok": True,
                    "apiKey": "accidental_inline_key_should_be_stripped",
                }
            })

            # Check that BYOK key was sent to provider in Authorization header
            call_args = mock_post.call_args
            assert call_args[1]["headers"]["Authorization"] == "Bearer gsk_user_vaulted_key"

            # Check that output audit dictionary is completely free of any apiKey key
            audit = output["audit"]
            assert "apiKey" not in audit["model_config"]
            # Zero credits charged for BYOK
            assert audit.get("credits_charged") == 0

            # Restore original row
            if orig_encrypted is not None:
                res_rest = await session.execute(
                    select(UserProviderKeyModel).where(
                        UserProviderKeyModel.user_id == user_uuid,
                        UserProviderKeyModel.provider_id == "groq",
                    )
                )
                rest_row = res_rest.scalars().first()
                if rest_row:
                    rest_row.encrypted_key = orig_encrypted
                    await session.commit()

@pytest.mark.asyncio
async def test_paper_mode_caps_candles_to_300_bars():
    """Paper backtest mode truncates long candle feeds (>300 bars) to the most recent 300 bars."""
    from apps.engine.app.engine.backtest_runner import (
        MAX_LLM_ELIGIBLE_BARS_PER_PAPER_RUN,
        compute_metrics,
        EquityPoint,
        ClosedTrade,
    )
    from datetime import datetime

    assert MAX_LLM_ELIGIBLE_BARS_PER_PAPER_RUN == 300

    # Test metrics calculation with capping metadata
    ep = [EquityPoint(date=datetime.utcnow().isoformat(), equity=105000, benchmark=100000, drawdown=0.0)]
    metrics = compute_metrics(
        trades=[],
        equity_curve=ep,
        initial_capital=100000,
        exposure_pct=10.0,
        capped_to_bars=300,
        notes="Paper simulation capped to most recent 300 bars.",
    )
    assert metrics.cappedToBars == 300
    assert "300 bars" in (metrics.notes or "")

@pytest.mark.asyncio
async def test_wallet_bootstrap_consolidation():
    """get_or_create_wallet bootstraps fresh wallets with 240 credits and initial_grant transaction."""
    from apps.engine.app.billing.wallet import get_or_create_wallet

    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        wallet = await get_or_create_wallet(user_uuid, session)
        assert wallet is not None
        assert float(wallet.balance) >= 0

        # Verify transaction
        tx_res = await session.execute(
            select(CreditTransactionModel).where(CreditTransactionModel.user_id == user_uuid)
        )
        txs = tx_res.scalars().all()
        assert len(txs) >= 1
        initial_tx = [t for t in txs if t.reason == "initial_grant"]
        assert len(initial_tx) >= 1
        assert float(initial_tx[0].amount) == 240.0

@pytest.mark.asyncio
async def test_google_and_alibaba_dispatch():
    """Google Gemini and Alibaba DashScope REST API dispatches parse valid JSON signals."""
    # 1. Google Gemini
    google_mock_data = {
        "candidates": [
            {
                "content": {
                    "parts": [
                        {
                            "text": json.dumps({
                                "direction": "long",
                                "confidence": 0.89,
                                "rationale": "Gemini 1.5 Pro detected bullish momentum divergence.",
                            })
                        }
                    ]
                }
            }
        ],
        "usageMetadata": {
            "promptTokenCount": 210,
            "candidatesTokenCount": 42,
        }
    }
    google_resp = AsyncMock()
    google_resp.status_code = 200
    google_resp.json = lambda: google_mock_data

    with patch("apps.engine.app.config.settings.GOOGLE_API_KEY", "gemini-test-secret"):
        with patch("httpx.AsyncClient.post", return_value=google_resp) as mock_post:
            res_google = await call_llm_for_signal(
                provider_id="google",
                model_id="gemini-pro",
                system_prompt="Analyze momentum",
                feature_summary={"rsi": 25.0},
                deterministic_baseline={"direction": "long", "confidence": 0.70, "rationale": "baseline"},
            )
            assert res_google.raw_status == "ok"
            assert res_google.direction == "long"
            assert res_google.confidence == 0.89
            assert "Gemini" in res_google.rationale
            assert res_google.prompt_tokens == 210
            assert res_google.completion_tokens == 42

    # 2. Alibaba Qwen (DashScope)
    ali_mock_data = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "direction": "short",
                        "confidence": 0.92,
                        "rationale": "Qwen 72B detected sharp distribution with volume spike.",
                    }),
                }
            }
        ],
        "usage": {
            "prompt_tokens": 160,
            "completion_tokens": 30,
        }
    }
    ali_resp = AsyncMock()
    ali_resp.status_code = 200
    ali_resp.json = lambda: ali_mock_data

    with patch("apps.engine.app.config.settings.ALIBABA_API_KEY", "dashscope-test-secret"):
        with patch("httpx.AsyncClient.post", return_value=ali_resp) as mock_post_ali:
            res_ali = await call_llm_for_signal(
                provider_id="alibaba",
                model_id="qwen-72b",
                system_prompt="Analyze trend",
                feature_summary={"rsi": 77.0},
                deterministic_baseline={"direction": "short", "confidence": 0.70, "rationale": "baseline"},
            )
            assert res_ali.raw_status == "ok"
            assert res_ali.direction == "short"
            assert res_ali.confidence == 0.92
            assert "Qwen" in res_ali.rationale
            assert res_ali.prompt_tokens == 160
            assert res_ali.completion_tokens == 30

@pytest.mark.asyncio
async def test_groq_missing_server_key_raises_clear_error():
    """If GROQ_API_KEY is unset and no BYOK is provided, gateway raises clear startup/config error."""
    with patch("apps.engine.app.config.settings.GROQ_API_KEY", ""):
        result = await call_llm_for_signal(
            provider_id="groq",
            model_id="openai/gpt-oss-120b",
            system_prompt="Analyze",
            feature_summary={"rsi": 50},
            deterministic_baseline={"direction": "flat", "confidence": 0.5, "rationale": "baseline"},
            custom_api_key=None,
        )
        assert result.raw_status == "error"
        assert "GROQ_API_KEY is not configured on server" in (result.error_message or "")

@pytest.mark.asyncio
async def test_sentiment_analyst_paper_mode_execution_and_fallback():
    """SentimentAnalystNode in paper mode calls LLM gateway on success and falls back to deterministic sentiment baseline on error."""
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        await session.execute(
            update(CreditWalletModel).where(CreditWalletModel.user_id == user_uuid).values(balance=100)
        )
        await session.commit()

        bot_res = await session.execute(select(BotModel).where(BotModel.user_id == user_uuid))
        bot = bot_res.scalars().first()
        if not bot:
            bot = BotModel(id=uuid.uuid4(), user_id=user_uuid, name="Sentiment Bot", status="active", graph={})
            session.add(bot)
            await session.commit()

        run = BacktestRunModel(id=uuid.uuid4(), bot_id=bot.id, user_id=user_uuid, status="running", config={"type": "paper"})
        session.add(run)
        await session.commit()

        node = SentimentAnalystNode()
        candle = {"close": 68000.0}
        upstream = {
            "news": {
                "type": "NewsFeed",
                "sentimentScore": 0.65,  # strongly bullish (> 0.3)
                "blackoutActive": False,
            }
        }

        ctx_paper = NodeContext(
            candle=candle, portfolio=None, upstream_outputs=upstream,
            mode="paper", user_id=test_user_id, bot_id=str(bot.id), run_id=str(run.id),
            current_node_id="sentiment-agent-node-1", db=session,
        )

        node_cfg = {
            "model": {"providerId": "anthropic", "modelId": "claude-sonnet", "temperature": 0.3, "maxTokens": 1024},
            "bullishThreshold": 0.3,
            "bearishThreshold": -0.3,
        }

        # 1. Successful paper execution
        mock_success = AsyncMock()
        mock_success.status_code = 200
        mock_success.json = lambda: {
            "content": [{"type": "text", "text": json.dumps({"direction": "long", "confidence": 0.93, "rationale": "Overwhelmingly positive retail and institutional sentiment."})}],
            "usage": {"input_tokens": 80, "output_tokens": 25},
        }

        with patch("apps.engine.app.config.settings.ANTHROPIC_API_KEY", "anthropic-test-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_success):
                out = await node.run(ctx_paper, node_cfg)
                assert out["type"] == "Signal"
                assert out["direction"] == "long"
                assert out["confidence"] == 0.93
                assert "[LLM]" in out["rationale"]
                assert out["audit"]["llm_status"] == "ok"
                assert out["audit"]["credits_charged"] == 2

        # Verify llm_call_log entry
        log_res = await session.execute(select(LlmCallLogModel).where(LlmCallLogModel.run_id == run.id))
        log_row = log_res.scalars().first()
        assert log_row is not None
        assert log_row.component_id == "sentiment-agent"
        assert log_row.node_id == "sentiment-agent-node-1"
        assert log_row.provider == "anthropic"

        # 2. Failed call falls back to deterministic baseline
        mock_fail = AsyncMock()
        mock_fail.status_code = 500
        mock_fail.text = "Anthropic rate limit"

        with patch("apps.engine.app.config.settings.ANTHROPIC_API_KEY", "anthropic-test-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_fail):
                out_fail = await node.run(ctx_paper, node_cfg)
                assert out_fail["direction"] == "long"
                assert out_fail["confidence"] >= 0.65
                assert "Sentiment_Bullish_Threshold" in out_fail["audit"]["applied_rule"]
                assert out_fail["audit"]["llm_status"] == "error"

@pytest.mark.asyncio
async def test_macro_strategist_paper_mode_execution_and_fallback():
    """MacroStrategistNode in paper mode calls LLM and on error falls back to regime-weighted baseline."""
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        await session.execute(
            update(CreditWalletModel).where(CreditWalletModel.user_id == user_uuid).values(balance=100)
        )
        await session.commit()

        bot_res = await session.execute(select(BotModel).where(BotModel.user_id == user_uuid))
        bot = bot_res.scalars().first()
        if not bot:
            bot = BotModel(id=uuid.uuid4(), user_id=user_uuid, name="Macro Bot", status="active", graph={})
            session.add(bot)
            await session.commit()

        run = BacktestRunModel(id=uuid.uuid4(), bot_id=bot.id, user_id=user_uuid, status="running", config={"type": "paper"})
        session.add(run)
        await session.commit()

        node = MacroStrategistNode()
        candle = {"close": 70000.0}
        upstream = {
            "news": {"type": "NewsFeed", "sentimentScore": 0.45, "blackoutActive": False},
            "features": {"type": "FeatureVector", "regime": "Trend"},
        }

        ctx_paper = NodeContext(
            candle=candle, portfolio=None, upstream_outputs=upstream,
            mode="paper", user_id=test_user_id, bot_id=str(bot.id), run_id=str(run.id),
            current_node_id="macro-agent-node-1", db=session,
        )

        node_cfg = {
            "model": {"providerId": "google", "modelId": "gemini-pro", "temperature": 0.4, "maxTokens": 1024},
            "bullishThreshold": 0.25,
            "bearishThreshold": -0.25,
        }

        mock_google = AsyncMock()
        mock_google.status_code = 200
        mock_google.json = lambda: {
            "candidates": [{"content": {"parts": [{"text": json.dumps({"direction": "long", "confidence": 0.88, "rationale": "Macro liquidity expansion supports trending asset rally."})}]}}],
            "usageMetadata": {"promptTokenCount": 110, "candidatesTokenCount": 30},
        }

        with patch("apps.engine.app.config.settings.GOOGLE_API_KEY", "google-test-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_google):
                out = await node.run(ctx_paper, node_cfg)
                assert out["direction"] == "long"
                assert out["confidence"] == 0.88
                assert "[LLM]" in out["rationale"]
                assert out["audit"]["llm_status"] == "ok"
                assert out["audit"]["credits_charged"] == 3

        # Fallback test
        mock_fail = AsyncMock()
        mock_fail.status_code = 503
        mock_fail.text = "Service Unavailable"

        with patch("apps.engine.app.config.settings.GOOGLE_API_KEY", "google-test-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_fail):
                out_fail = await node.run(ctx_paper, node_cfg)
                assert out_fail["direction"] == "long"
                assert "Macro_Risk_On_Trend_Aligned" in out_fail["audit"]["applied_rule"]
                assert out_fail["audit"]["llm_status"] == "error"

@pytest.mark.asyncio
async def test_event_specialist_paper_mode_execution_and_fallback():
    """EventSpecialistNode in paper mode calls LLM and on error falls back to catalyst-selective baseline."""
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        await session.execute(
            update(CreditWalletModel).where(CreditWalletModel.user_id == user_uuid).values(balance=100)
        )
        await session.commit()

        bot_res = await session.execute(select(BotModel).where(BotModel.user_id == user_uuid))
        bot = bot_res.scalars().first()
        if not bot:
            bot = BotModel(id=uuid.uuid4(), user_id=user_uuid, name="Event Bot", status="active", graph={})
            session.add(bot)
            await session.commit()

        run = BacktestRunModel(id=uuid.uuid4(), bot_id=bot.id, user_id=user_uuid, status="running", config={"type": "paper"})
        session.add(run)
        await session.commit()

        node = EventSpecialistNode()
        candle = {"close": 72000.0}
        upstream = {
            "news": {"type": "NewsFeed", "sentimentScore": 0.60, "blackoutActive": False},
        }

        ctx_paper = NodeContext(
            candle=candle, portfolio=None, upstream_outputs=upstream,
            mode="paper", user_id=test_user_id, bot_id=str(bot.id), run_id=str(run.id),
            current_node_id="event-agent-node-1", db=session,
        )

        node_cfg = {
            "model": {"providerId": "openai", "modelId": "gpt-5-mini", "temperature": 0.4, "maxTokens": 1024},
            "eventThreshold": 0.50,
        }

        mock_openai = AsyncMock()
        mock_openai.status_code = 200
        mock_openai.json = lambda: {
            "choices": [{"message": {"role": "assistant", "content": json.dumps({"direction": "long", "confidence": 0.90, "rationale": "High-conviction post-earnings momentum catalyst."})}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 20},
        }

        with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "openai-test-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_openai):
                out = await node.run(ctx_paper, node_cfg)
                assert out["direction"] == "long"
                assert out["confidence"] == 0.90
                assert "[LLM]" in out["rationale"]
                assert out["audit"]["llm_status"] == "ok"
                assert out["audit"]["credits_charged"] == 1

        # Fallback test
        mock_fail = AsyncMock()
        mock_fail.status_code = 500
        mock_fail.text = "Internal error"

        with patch("apps.engine.app.config.settings.OPENAI_API_KEY", "openai-test-key"):
            with patch("httpx.AsyncClient.post", return_value=mock_fail):
                out_fail = await node.run(ctx_paper, node_cfg)
                assert out_fail["direction"] == "long"
                assert "Event_Bullish_Catalyst" in out_fail["audit"]["applied_rule"]
                assert out_fail["audit"]["llm_status"] == "error"

@pytest.mark.asyncio
async def test_new_agents_historical_mode_never_invokes_llm_gateway():
    """All 3 new agents in historical mode MUST NEVER invoke httpx.AsyncClient.post."""
    candle = {"close": 60000.0}
    upstream = {
        "news": {"type": "NewsFeed", "sentimentScore": 0.65, "blackoutActive": False},
        "features": {"type": "FeatureVector", "regime": "Trend"},
    }

    ctx_hist = NodeContext(
        candle=candle, portfolio=None, upstream_outputs=upstream,
        mode="historical", user_id="test-user-123", bot_id="test-bot-123", db=None,
    )

    nodes = [
        (SentimentAnalystNode(), {"model": {"providerId": "anthropic", "modelId": "claude-sonnet"}}),
        (MacroStrategistNode(), {"model": {"providerId": "google", "modelId": "gemini-pro"}}),
        (EventSpecialistNode(), {"model": {"providerId": "openai", "modelId": "gpt-5-mini"}}),
    ]

    with patch("httpx.AsyncClient.post", side_effect=RuntimeError("HTTP call must never happen in historical mode!")) as mock_post:
        for node, cfg in nodes:
            out = await node.run(ctx_hist, cfg)
            mock_post.assert_not_called()
            assert out["type"] == "Signal"
            assert out["audit"]["llm_status"] == "skipped_mode"
            assert "deterministic_baseline" in out["audit"]

@pytest.mark.asyncio
async def test_new_agents_no_upstream_newsfeed_fallback():
    """When no NewsFeed upstream is present, all 3 new agents return flat with 'Default Flat (No Data)' and skipped_no_features."""
    candle = {"close": 50000.0}
    upstream_empty = {}

    ctx = NodeContext(
        candle=candle, portfolio=None, upstream_outputs=upstream_empty,
        mode="paper", user_id="test-user-123", bot_id="test-bot-123", db=None,
    )

    nodes = [SentimentAnalystNode(), MacroStrategistNode(), EventSpecialistNode()]

    for node in nodes:
        out = await node.run(ctx, {})
        assert out["type"] == "Signal"
        assert out["direction"] == "flat"
        assert out["confidence"] == 0.0
        assert out["audit"]["applied_rule"] == "Default Flat (No Data)"
        assert out["audit"]["llm_status"] == "skipped_no_features"

@pytest.mark.asyncio
async def test_macro_strategist_blackout_override_precedence():
    """MacroStrategistNode: blackoutActive=True MUST override even a strongly bullish/bearish sentiment score."""
    candle = {"close": 65000.0}
    upstream = {
        "news": {
            "type": "NewsFeed",
            "sentimentScore": 0.85,  # Extreme bullish sentiment
            "blackoutActive": True,   # Active macro blackout
        },
        "features": {
            "type": "FeatureVector",
            "regime": "Trend",
        },
    }

    ctx = NodeContext(
        candle=candle, portfolio=None, upstream_outputs=upstream,
        mode="historical", user_id="test-user-123", bot_id="test-bot-123", db=None,
    )

    node = MacroStrategistNode()
    out = await node.run(ctx, {"bullishThreshold": 0.25})

    assert out["direction"] == "flat"
    assert out["confidence"] == 0.80
    assert out["audit"]["applied_rule"] == "Macro_Event_Blackout_Override"
    assert "blackout" in out["rationale"].lower()

@pytest.mark.asyncio
async def test_event_specialist_two_distinct_flat_states():
    """EventSpecialistNode distinguishes between active blackout flatness and no-catalyst flatness."""
    candle = {"close": 60000.0}

    # Case A: Blackout window flat
    ctx_blackout = NodeContext(
        candle=candle, portfolio=None,
        upstream_outputs={"news": {"type": "NewsFeed", "sentimentScore": 0.80, "blackoutActive": True}},
        mode="historical", user_id="test-user-123", bot_id="test-bot-123", db=None,
    )
    node = EventSpecialistNode()
    out_blackout = await node.run(ctx_blackout, {"eventThreshold": 0.50})

    assert out_blackout["direction"] == "flat"
    assert out_blackout["confidence"] == 0.85
    assert out_blackout["audit"]["applied_rule"] == "Active_Event_Blackout"
    assert "blackout" in out_blackout["rationale"].lower()

    # Case B: No active catalyst flat (sentiment magnitude 0.20 < threshold 0.50)
    ctx_no_catalyst = NodeContext(
        candle=candle, portfolio=None,
        upstream_outputs={"news": {"type": "NewsFeed", "sentimentScore": 0.20, "blackoutActive": False}},
        mode="historical", user_id="test-user-123", bot_id="test-bot-123", db=None,
    )
    out_no_catalyst = await node.run(ctx_no_catalyst, {"eventThreshold": 0.50})

    assert out_no_catalyst["direction"] == "flat"
    assert out_no_catalyst["confidence"] == 0.40
    assert out_no_catalyst["audit"]["applied_rule"] == "No_Active_Catalyst"
    assert "no active catalyst" in out_no_catalyst["rationale"].lower()

    # Verify that the two flat states are completely distinguishable
    assert out_blackout["audit"]["applied_rule"] != out_no_catalyst["audit"]["applied_rule"]
    assert out_blackout["confidence"] != out_no_catalyst["confidence"]

@pytest.mark.asyncio
async def test_llm_call_log_records_correct_current_node_id():
    """Verifies that multiple instances of an agent in a graph log their respective current_node_id, not a hardcoded default string."""
    test_user_id = await get_test_user_id()
    user_uuid = uuid.UUID(test_user_id)

    async with AsyncSessionLocal() as session:
        await session.execute(
            update(CreditWalletModel).where(CreditWalletModel.user_id == user_uuid).values(balance=100)
        )
        await session.commit()

        bot_res = await session.execute(select(BotModel).where(BotModel.user_id == user_uuid))
        bot = bot_res.scalars().first()
        if not bot:
            bot = BotModel(id=uuid.uuid4(), user_id=user_uuid, name="Multi-Node Bot", status="active", graph={})
            session.add(bot)
            await session.commit()

        run = BacktestRunModel(id=uuid.uuid4(), bot_id=bot.id, user_id=user_uuid, status="running", config={"type": "paper"})
        session.add(run)
        await session.commit()

        node = SentimentAnalystNode()
        mock_success = AsyncMock()
        mock_success.status_code = 200
        mock_success.json = lambda: {
            "choices": [{"message": {"role": "assistant", "content": json.dumps({"direction": "long", "confidence": 0.85, "rationale": "Bullish view."})}}],
            "usage": {"prompt_tokens": 50, "completion_tokens": 15},
        }

        # Instance 1: current_node_id = "sentiment-node-alpha"
        ctx1 = NodeContext(
            candle={"close": 60000.0}, portfolio=None,
            upstream_outputs={"news": {"type": "NewsFeed", "sentimentScore": 0.5, "blackoutActive": False}},
            mode="paper", user_id=test_user_id, bot_id=str(bot.id), run_id=str(run.id),
            current_node_id="sentiment-node-alpha", db=session,
        )

        with patch("apps.engine.app.config.settings.GROQ_API_KEY", "gsk-valid"):
            with patch("httpx.AsyncClient.post", return_value=mock_success):
                await node.run(ctx1, {"model": {"providerId": "groq", "modelId": "openai/gpt-oss-120b"}})

        # Instance 2: current_node_id = "sentiment-node-beta"
        ctx2 = NodeContext(
            candle={"close": 60000.0}, portfolio=None,
            upstream_outputs={"news": {"type": "NewsFeed", "sentimentScore": 0.5, "blackoutActive": False}},
            mode="paper", user_id=test_user_id, bot_id=str(bot.id), run_id=str(run.id),
            current_node_id="sentiment-node-beta", db=session,
        )

        with patch("apps.engine.app.config.settings.GROQ_API_KEY", "gsk-valid"):
            with patch("httpx.AsyncClient.post", return_value=mock_success):
                await node.run(ctx2, {"model": {"providerId": "groq", "modelId": "openai/gpt-oss-120b"}})

        # Verify logs have both distinct node IDs
        logs_res = await session.execute(
            select(LlmCallLogModel).where(LlmCallLogModel.run_id == run.id).order_by(LlmCallLogModel.created_at.asc())
        )
        logs = logs_res.scalars().all()
        node_ids_logged = [l.node_id for l in logs]
        assert "sentiment-node-alpha" in node_ids_logged
        assert "sentiment-node-beta" in node_ids_logged

