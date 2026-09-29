"""Unit tests for task classifier and agent planner."""

import pytest
from app.services.agent.task_classifier import TaskClassifier
from app.services.agent.planner import AgentPlanner
from app.services.agent.schemas import AgentIntent
from app.services.agent.tool_registry import ToolRegistry

def test_intent_classification():
    assert TaskClassifier.classify("What is the temperature now?")[0] == AgentIntent.WEATHER
    assert TaskClassifier.classify("Will it rain tomorrow?")[0] == AgentIntent.WEATHER
    assert TaskClassifier.classify("Is today hotter than normal baseline?")[0] == AgentIntent.CLIMATE
    assert TaskClassifier.classify("Is there flood risk in my area?")[0] == AgentIntent.RISK
    assert TaskClassifier.classify("Are there any active warnings?")[0] == AgentIntent.ALERT
    assert TaskClassifier.classify("What should I do during a flood?")[0] == AgentIntent.RAG
    assert TaskClassifier.classify("What if rainfall reaches 80 mm?")[0] == AgentIntent.WHAT_IF
    assert TaskClassifier.classify("Show this on the map")[0] == AgentIntent.MAP

def test_pronoun_context_resolution():
    history = [
        {"role": "user", "content": "Will it rain 100 mm tomorrow?"},
        {"role": "assistant", "content": "Yes, heavy rainfall is forecast."},
    ]
    intent, reason = TaskClassifier.classify("Will that cause flood?", history)
    assert intent == AgentIntent.RISK

def test_planner_tool_selection():
    plan_weather = AgentPlanner.plan(AgentIntent.WEATHER, "What's the weather?", 12.83, 79.70)
    assert any(step["tool_name"] == "weather_current" for step in plan_weather)

    plan_risk = AgentPlanner.plan(AgentIntent.RISK, "Flood risk?", 12.83, 79.70)
    assert any(step["tool_name"] == "risk_assessment" for step in plan_risk)

@pytest.mark.asyncio
async def test_tool_registry_execution_and_allowlist():
    registry = ToolRegistry()
    async def sample_tool(val: int):
        return val * 2
    registry.register("sample_tool", "Doubles value", sample_tool)

    assert registry.is_allowed("sample_tool") is True
    assert registry.is_allowed("unregistered_tool") is False

    res = await registry.execute("sample_tool", {"val": 5})
    assert res == 10

    with pytest.raises(ValueError):
        await registry.execute("unregistered_tool", {})
