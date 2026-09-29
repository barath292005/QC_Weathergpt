"""Schemas for WeatherGPT LLM Service."""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class LLMGenerateOptions(BaseModel):
    system_instruction: Optional[str] = None
    temperature: float = 0.2
    max_output_tokens: int = 1024

class LLMResponse(BaseModel):
    text: str
    model: str
    provider: str
    finish_reason: Optional[str] = None
    fallback_used: bool = False
