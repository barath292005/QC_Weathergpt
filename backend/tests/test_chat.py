"""Integration tests for Chat controller and end-to-end conversation flows."""

import pytest
from unittest.mock import AsyncMock
from app.services.agent.controller import AgentController
from app.services.agent.tool_registry import ToolRegistry
from app.services.agent.schemas import ChatRequest, AgentIntent
from app.services.llm.service import LLMService
from app.services.llm.provider import LLMProvider
from app.services.llm.schemas import LLMResponse

class DeterministicMockProvider(LLMProvider):
    name = "deterministic_mock"

    def is_available(self) -> bool:
        return True

    async def health_check(self) -> bool:
        return True

    async def generate(self, prompt, options=None) -> LLMResponse:
        return LLMResponse(
            text="Grounded assistant response based on tool outputs.",
            model="gemini-3.8-flash",
            provider="gemini"
        )

@pytest.mark.asyncio
async def test_chat_controller_weather_flow():
    registry = ToolRegistry()
    async def mock_weather(lat, lon):
        return {"current": {"temperature": 28.5, "condition": "Clear Sky"}}
    registry.register("weather_current", "Weather current", mock_weather)
    async def mock_forecast(lat, lon):
        return {"forecast": []}
    registry.register("weather_forecast", "Weather forecast", mock_forecast)

    controller = AgentController(
        tool_registry=registry,
        llm_service=LLMService(provider=DeterministicMockProvider())
    )

    req = ChatRequest(message="What is the weather right now?", lat=12.83, lon=79.70)
    res = await controller.handle_message(req)

    assert res.intent == AgentIntent.WEATHER
    assert len(res.tool_calls) > 0
    assert res.answer == "Grounded assistant response based on tool outputs."

@pytest.mark.asyncio
async def test_chat_controller_risk_flow():
    registry = ToolRegistry()
    async def mock_risk(lat, lon, forecast_hours=24):
        return {"risk_score": 0.72, "risk_level": "HIGH", "hazard": "Heavy Rain / Flood Risk"}
    registry.register("risk_assessment", "Risk assessment", mock_risk)
    async def mock_alerts(lat, lon):
        return {"alerts": []}
    registry.register("active_alerts", "Active alerts", mock_alerts)

    controller = AgentController(
        tool_registry=registry,
        llm_service=LLMService(provider=DeterministicMockProvider())
    )

    req = ChatRequest(message="Is there flood risk?", lat=12.83, lon=79.70)
    res = await controller.handle_message(req)

    assert res.intent == AgentIntent.RISK
    assert res.risk["risk_level"] == "HIGH"
