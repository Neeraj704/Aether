"""
Groq client implementation using the official OpenAI Python SDK.
Provides full compatibility with Groq's OpenAI-compatible completions endpoint.
"""
import io
from typing import Any, Union

from openai import AsyncOpenAI

from src.logger.logger import Logger
from src.platforms.ai_providers.base import BaseAIClient
from src.platforms.ai_providers.response_models import ChatResponseModel
from src.utils.decorators import retry_api_call


class GroqClient(BaseAIClient):
    """Client for handling Groq API requests using the OpenAI SDK."""

    def __init__(self, api_key: str, base_url: str, logger: Logger) -> None:
        """
        Initialize the GroqClient.

        Args:
            api_key: Groq API key
            base_url: Groq API base URL (e.g. 'https://api.groq.com/openai/v1')
            logger: Logger instance
        """
        super().__init__(logger)
        self.api_key = api_key
        self.base_url = base_url
        self._client: AsyncOpenAI | None = None

    async def _initialize_client(self) -> None:
        """Initialize the AsyncOpenAI client pointing to Groq."""
        self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        self.logger.debug("Groq SDK client initialized successfully")

    async def close(self) -> None:
        """Close the SDK client."""
        if self._client:
            try:
                self.logger.debug("Closing GroqClient SDK session")
                await self._client.close()
            except Exception as exc:
                self.logger.warning("Groq client cleanup failed: %s", exc)
            finally:
                self._client = None

    def _ensure_client(self) -> AsyncOpenAI:
        """Ensure a client exists and return it, initializing if needed."""
        if not self._client:
            self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    @retry_api_call(max_retries=3, initial_delay=1, backoff_factor=2, max_delay=30)
    async def chat_completion(
        self, model: str, messages: list[dict[str, Any]], model_config: dict[str, Any]
    ) -> ChatResponseModel | None:
        """
        Send a chat completion request to the Groq API using OpenAI SDK.

        Args:
            model: Model name to use (e.g., 'openai/gpt-oss-120b')
            messages: list of OpenAI-style messages
            model_config: Configuration parameters (temperature, max_tokens, etc.)

        Returns:
            ChatResponseModel or None if failed
        """
        client = self._ensure_client()
        try:
            self.logger.debug("Sending request to Groq with model: %s", model)
            # Use base class parameter retry to filter unsupported arguments
            response = await self._execute_with_param_retry(
                client.chat.completions.create,
                model_config,
                model=model,
                messages=messages
            )
            return self.convert_pydantic_response(response)
        except Exception as e:
            return self._handle_exception(e)

    async def chat_completion_with_chart_analysis(
        self,
        model: str,
        messages: list[dict[str, Any]],
        chart_image: Union[io.BytesIO, bytes, str],
        model_config: dict[str, Any],
    ) -> ChatResponseModel | None:
        """
        Send a chat completion request with a chart image for pattern analysis.
        Note: Since Groq text models do not support vision/charts natively,
        this logs a warning and falls back to a text-only prompt.
        """
        self.logger.warning("Chart analysis requested on Groq client which does not support vision. Falling back to text-only completion.")
        return await self.chat_completion(model, messages, model_config)

    def _handle_exception(self, exception: Exception) -> ChatResponseModel | None:
        """Handle Groq specific exceptions, falling back to common handler."""
        result = self.handle_common_errors(exception)
        if result:
            return result
        sanitized_error = self._sanitize_error_message(str(exception))
        self.logger.error("Groq API error: %s", sanitized_error)
        return ChatResponseModel.from_error(sanitized_error)
