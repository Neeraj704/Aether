"""Unit tests for Groq provider compatibility and orchestrator wiring."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

import src.platforms.ai_providers.groq as groq_module
from src.managers.provider_orchestrator import ProviderOrchestrator
from src.managers.provider_types import ProviderClients
from src.platforms.ai_providers.groq import GroqClient
from src.platforms.ai_providers.response_models import ChatResponseModel


def _make_client() -> GroqClient:
    return GroqClient(api_key="gsk-test-key", base_url="https://api.groq.com/openai/v1", logger=MagicMock())


def _fake_sdk_response(text: str = "ok") -> SimpleNamespace:
    message = SimpleNamespace(role="assistant", content=text)
    choice = SimpleNamespace(message=message, finish_reason="stop")
    usage = SimpleNamespace(prompt_tokens=1, completion_tokens=2, total_tokens=3)
    return SimpleNamespace(choices=[choice], usage=usage, id="gen-123", model="openai/gpt-oss-120b")


class TestGroqClientConstruction:
    @pytest.mark.asyncio
    async def test_initialize_client_passes_base_url_and_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        calls = []

        def fake_openai(**kwargs):
            calls.append(kwargs)
            return SimpleNamespace()

        monkeypatch.setattr(groq_module, "AsyncOpenAI", fake_openai)
        client = _make_client()

        await client._initialize_client()

        assert calls == [{"api_key": "gsk-test-key", "base_url": "https://api.groq.com/openai/v1"}]


class TestGroqRequestWiring:
    @pytest.mark.asyncio
    async def test_chat_completion_uses_openai_sdk(self) -> None:
        client = _make_client()
        create = AsyncMock(return_value=_fake_sdk_response())
        client._client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

        response = await client.chat_completion(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": "hello"}],
            model_config={"temperature": 0.7},
        )

        assert response is not None
        assert response.choices[0].message.content == "ok"
        create.assert_called_once_with(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": "hello"}],
            temperature=0.7
        )

    @pytest.mark.asyncio
    async def test_chart_analysis_logs_warning_and_falls_back(self) -> None:
        client = _make_client()
        create = AsyncMock(return_value=_fake_sdk_response("text fallback"))
        client._client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

        response = await client.chat_completion_with_chart_analysis(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": "analyze this"}],
            chart_image=b"fake-image",
            model_config={"temperature": 0.5},
        )

        assert response is not None
        assert response.choices[0].message.content == "text fallback"
        client.logger.warning.assert_called_once_with(
            "Chart analysis requested on Groq client which does not support vision. Falling back to text-only completion."
        )


class TestGroqOrchestratorIntegration:
    @pytest.mark.asyncio
    async def test_orchestrator_invokes_groq_correctly(self) -> None:
        config = _ConfigStub()
        groq_client = MagicMock()
        groq_client.chat_completion = AsyncMock(return_value=ChatResponseModel.from_content("groq response"))

        orchestrator = ProviderOrchestrator(
            logger=MagicMock(),
            config=config,
            clients=ProviderClients(groq=groq_client),
        )

        result = await orchestrator.invoke("groq", [{"role": "user", "content": "hello"}])

        assert result.success
        assert result.model == "openai/gpt-oss-120b"
        assert result.response.choices[0].message.content == "groq response"
        groq_client.chat_completion.assert_called_once_with(
            "openai/gpt-oss-120b",
            [{"role": "user", "content": "hello"}],
            {"max_tokens": 16}
        )


class _ConfigStub:
    GOOGLE_STUDIO_MODEL = "gemini-3.5-flash"
    OPENROUTER_BASE_MODEL = "primary/model"
    OPENROUTER_FALLBACK_MODEL = "fallback/model"
    LM_STUDIO_MODEL = "local/model"
    GROQ_MODEL = "openai/gpt-oss-120b"
    BLOCKRUN_MODEL = "deepseek/deepseek-reasoner"

    def get_model_config(self, _model: str) -> dict[str, int]:
        return {"max_tokens": 16}
