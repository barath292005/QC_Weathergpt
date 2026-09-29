"""Abstract LLM Provider Base Class."""

from abc import ABC, abstractmethod
from typing import Optional
from app.services.llm.schemas import LLMGenerateOptions, LLMResponse

class LLMProvider(ABC):
    name: str = "base_provider"

    @abstractmethod
    def is_available(self) -> bool:
        pass

    @abstractmethod
    async def generate(self, prompt: str, options: Optional[LLMGenerateOptions] = None) -> LLMResponse:
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        pass
