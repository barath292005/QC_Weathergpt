"""Agent Planner determining tool sequence."""

import re
from typing import List, Dict, Any
from app.services.agent.schemas import AgentIntent

class AgentPlanner:
    @staticmethod
    def plan(intent: AgentIntent, query: str, lat: float, lon: float) -> List[Dict[str, Any]]:
        if intent == AgentIntent.WEATHER:
            return [
                {"tool_name": "weather_current", "params": {"lat": lat, "lon": lon}},
                {"tool_name": "weather_forecast", "params": {"lat": lat, "lon": lon}},
            ]
        elif intent == AgentIntent.CLIMATE:
            return [
                {"tool_name": "climate_comparison", "params": {"lat": lat, "lon": lon}},
            ]
        elif intent == AgentIntent.RISK:
            return [
                {"tool_name": "risk_assessment", "params": {"lat": lat, "lon": lon, "forecast_hours": 24}},
                {"tool_name": "active_alerts", "params": {"lat": lat, "lon": lon}},
            ]
        elif intent == AgentIntent.ALERT:
            return [
                {"tool_name": "active_alerts", "params": {"lat": lat, "lon": lon}},
            ]
        elif intent == AgentIntent.RAG:
            return [
                {"tool_name": "knowledge_search", "params": {"query": query, "top_k": 4}},
            ]
        elif intent == AgentIntent.WHAT_IF:
            m = re.search(r"(\d+)\s*(?:mm)?", query)
            rain = int(m.group(1)) if m else 50
            return [
                {"tool_name": "what_if_simulation", "params": {"scenario_rainfall": rain}},
            ]
        elif intent == AgentIntent.MAP:
            return [
                {"tool_name": "geospatial_context", "params": {"lat": lat, "lon": lon}},
                {"tool_name": "risk_assessment", "params": {"lat": lat, "lon": lon}},
            ]
        else:
            return [
                {"tool_name": "weather_current", "params": {"lat": lat, "lon": lon}},
            ]
