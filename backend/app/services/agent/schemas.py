"""Schemas for WeatherGPT Conversational Agent."""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class AgentIntent(str, Enum):
    WEATHER = "WEATHER"
    CLIMATE = "CLIMATE"
    RISK = "RISK"
    ALERT = "ALERT"
    RAG = "RAG"
    MAP = "MAP"
    WHAT_IF = "WHAT_IF"
    GENERAL = "GENERAL"

class ToolCallTrace(BaseModel):
    tool_name: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    status: str = "success"
    summary: Optional[str] = None
    execution_time_ms: int = 0

class ChatRequest(BaseModel):
    message: str
    lat: float = 12.8342
    lon: float = 79.7036
    conversation_id: Optional[str] = "default_session"

class ChatResponse(BaseModel):
    answer: str
    intent: AgentIntent
    tool_calls: List[ToolCallTrace] = Field(default_factory=list)
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    risk: Optional[Dict[str, Any]] = None
    alert: Optional[Dict[str, Any]] = None
    weather: Optional[Dict[str, Any]] = None
    climate: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
