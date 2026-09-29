"""Task Intent Classifier for Conversational Agent."""

from typing import List, Dict, Optional, Tuple
from app.services.agent.schemas import AgentIntent

class TaskClassifier:
    @staticmethod
    def classify(message: str, history: Optional[List[Dict[str, str]]] = None) -> Tuple[AgentIntent, str]:
        q = message.lower().strip()

        if any(kw in q for kw in ["what if", "what happens if", "scenario", "if rainfall reaches", "if it rains"]):
            return AgentIntent.WHAT_IF, "Hypothetical scenario simulation."

        if any(kw in q for kw in ["show on map", "view map", "map view", "map marker", "coordinates"]):
            return AgentIntent.MAP, "Geospatial visualization request."

        # Pronoun resolution from conversation history
        if history:
            if any(kw in q for kw in ["is that dangerous", "will that cause flood", "will it be dangerous"]):
                return AgentIntent.RISK, "Resolved pronoun reference to flood impact risk."
            if any(kw in q for kw in ["what should i do about that", "how to prepare for that"]):
                return AgentIntent.RAG, "Resolved pronoun reference to disaster safety protocols."

        if any(kw in q for kw in ["alert", "warning", "advisory", "active alerts", "red alert", "orange alert"]):
            if any(kw in q for kw in ["what is", "meaning", "colour code", "color code"]):
                return AgentIntent.RAG, "Explaining warning classifications."
            return AgentIntent.ALERT, "Live early-warning inquiry."

        if any(kw in q for kw in ["flood risk", "waterlogging", "inundation", "danger of flood", "risk score"]):
            if any(kw in q for kw in ["what should i do", "how to prepare", "safety"]):
                return AgentIntent.RAG, "Safety protocol guidelines."
            return AgentIntent.RISK, "Impact-based risk scoring inquiry."

        if any(kw in q for kw in ["climate", "historical", "unusual", "baseline", "anomaly", "past 30 days"]):
            return AgentIntent.CLIMATE, "Statistical climate baseline inquiry."

        if any(kw in q for kw in ["what should i do", "how to prepare", "safety", "survival kit", "cyclone checklist", "humidity mean"]):
            return AgentIntent.RAG, "Authoritative safety protocol or glossary inquiry."

        if any(kw in q for kw in ["weather", "temperature", "forecast", "wind", "humidity", "rain today", "will it rain"]):
            return AgentIntent.WEATHER, "Real-time or forecast weather conditions."

        return AgentIntent.GENERAL, "General conversational request."
