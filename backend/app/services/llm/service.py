"""LLM Service orchestrating prompts, providers, and deterministic fallback."""

from typing import Dict, Any, Optional, List
from app.services.llm.provider import LLMProvider
from app.services.llm.providers.gemini import GeminiProvider
from app.services.llm.prompt_builder import SYSTEM_PROMPT, build_user_prompt
from app.services.llm.schemas import LLMGenerateOptions, LLMResponse
from app.services.llm.guardrails import Guardrails

class LLMService:
    def __init__(self, provider: Optional[LLMProvider] = None):
        self.provider = provider or GeminiProvider()

    def is_available(self) -> bool:
        return self.provider.is_available()

    async def generate_explanation(
        self,
        user_message: str,
        context: Dict[str, Any],
        history: Optional[List[Dict[str, str]]] = None
    ) -> LLMResponse:
        clean_text, _ = Guardrails.sanitize_input(user_message)

        if self.provider.is_available():
            try:
                prompt = build_user_prompt(clean_text, context, history)
                options = LLMGenerateOptions(system_instruction=SYSTEM_PROMPT, temperature=0.2)
                res = await self.provider.generate(prompt, options)
                if res.text.strip():
                    return res
            except Exception:
                # Silently catch quota, network, or provider errors and fall back gracefully
                pass

        # Deterministic Grounded Fallback
        fallback_text = self._build_deterministic_fallback(clean_text, context)
        return LLMResponse(
            text=fallback_text,
            model="deterministic-rules-engine",
            provider="weathergpt-core",
            fallback_used=True
        )

    def _build_deterministic_fallback(self, query: str, context: Dict[str, Any]) -> str:
        intent = context.get("intent", "GENERAL")
        loc_name = context.get("location", {}).get("name", "Selected Location")

        if intent == "WEATHER" and context.get("weather"):
            w = context["weather"].get("current", {})
            return (
                f"Current meteorological observations for {loc_name}:\n"
                f"• Temperature: {w.get('temperature', 'N/A')}°C\n"
                f"• Weather Condition: {w.get('condition', 'N/A')}\n"
                f"• Relative Humidity: {w.get('humidity', 'N/A')}%\n"
                f"• Wind Speed: {w.get('wind_speed', 'N/A')} km/h\n"
                f"• Precipitation: {w.get('precipitation', 0)} mm/hr\n"
                f"(Source: Open-Meteo High-Resolution Numerical Model)"
            )
        elif intent == "RISK" and context.get("risk"):
            r = context["risk"]
            score = int((r.get("risk_score") or 0) * 100)
            return (
                f"WeatherGPT Impact Risk Assessment for {loc_name}:\n"
                f"• Hazard: {r.get('hazard', 'Heavy Rain / Flood Risk')}\n"
                f"• Computed Risk Level: {r.get('risk_level', 'LOW')} ({score}%)\n"
                f"• Forecast Precipitation: {r.get('features', {}).get('forecast_precipitation', 0)} mm\n"
                f"• Recommended Actions: Follow civic guidelines and monitor updates.\n\n"
                f"⚠ Notice: AI-generated risk assessment, not an official government warning."
            )
        elif intent == "ALERT" and context.get("alerts"):
            a = context["alerts"][0]
            return (
                f"WeatherGPT Early Warning Advisory:\n"
                f"• Severity: [{a.get('severity', 'INFO')}] {a.get('title', '')}\n"
                f"• Description: {a.get('description', '')}\n\n"
                f"⚠ Official Warning Notice: System-generated early warning prototype."
            )
        elif intent == "RAG" and context.get("sources"):
            s = context["sources"][0]
            return (
                f"According to official guidance from {s.get('organization', 'NDMA')} "
                f"({s.get('title', '')}):\n\n{s.get('text', '')}\n\n"
                f"Official resource: {s.get('url', '')}"
            )
        else:
            return (
                f"WeatherGPT is standing by for {loc_name}. "
                "Ask about live weather telemetry, flood impact risk scores, active alerts, or disaster safety protocols."
            )
