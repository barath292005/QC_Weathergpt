"""Google Gemini LLM Provider."""

import os
from typing import Optional
from app.services.llm.provider import LLMProvider
from app.services.llm.schemas import LLMGenerateOptions, LLMResponse
from app.services.llm.exceptions import MissingAPIKeyError, RateLimitError

class GeminiProvider(LLMProvider):
    name: str = "gemini"

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("LLM_MODEL", "gemini-3.8-flash")
        self._client = None
        if self.api_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception:
                self._client = None

    def is_available(self) -> bool:
        return bool(self.api_key and self._client is not None)

    async def health_check(self) -> bool:
        if not self.is_available():
            return False
        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents="ping",
            )
            return bool(response.text)
        except Exception:
            return False

    async def generate(self, prompt: str, options: Optional[LLMGenerateOptions] = None) -> LLMResponse:
        if not self.is_available():
            raise MissingAPIKeyError("GEMINI_API_KEY is not configured.")

        system_instruction = options.system_instruction if options else None
        temperature = options.temperature if options else 0.2

        try:
            response = self._client.models.generate_content(
                model=self.model,
                contents=prompt,
                config={
                    "system_instruction": system_instruction,
                    "temperature": temperature,
                }
            )
            return LLMResponse(
                text=response.text or "",
                model=self.model,
                provider="gemini",
                fallback_used=False
            )
        except Exception as e:
            err_str = str(e).lower()
            if "resource_exhausted" in err_str or "quota" in err_str or "rate" in err_str:
                raise RateLimitError(f"Gemini quota limit exceeded: {str(e)}") from e
            raise
