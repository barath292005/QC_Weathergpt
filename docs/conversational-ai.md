# WeatherGPT Step 8: Gemini-Powered Conversational AI

## 1. Architecture Overview

In Step 8, WeatherGPT integrates Google Gemini as a conversational intelligence layer that synthesizes grounded explanations from application domain tools rather than hallucinating weather data:

```
                         USER
                           │
                           ▼
                    CHAT INTERFACE (ChatPanel)
                           │
                           ▼
                  CONVERSATIONAL AGENT
                           │
                           ▼
                    INTENT / PLANNER
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
       WEATHER          CLIMATE           RISK
          │                │                │
          └────────────────┼────────────────┘
                           │
                 ┌─────────┼─────────┐
                 ▼         ▼         ▼
              ALERTS      RAG       MAP
                 │         │         │
                 └─────────┼─────────┘
                           ▼
                    ACTUAL TOOL DATA
                           │
                           ▼
               GEMINI 3.8 FLASH (Google GenAI)
                           │
                           ▼
                  GROUNDED RESPONSE
                           │
                           ▼
                         USER
```

---

## 2. Intent Classification & Tool Planner

The conversational agent classifies each query into one of 8 distinct intents:
1. `WEATHER`: Live temperature, rain, wind, forecasts.
2. `CLIMATE`: Historical baseline comparison and 30-day ERA5 anomalies.
3. `RISK`: Multi-factor hydrological impact risk scores and drivers.
4. `ALERT`: Live early-warning advisories and severity badges.
5. `RAG`: Authoritative disaster preparedness protocols (NDMA/IMD).
6. `WHAT_IF`: Analytical stress-testing simulations.
7. `MAP`: Geographic coordinates and Leaflet risk visualizations.
8. `GENERAL`: Conversational queries and capability overviews.

---

## 3. Strict Grounding Contract & Anti-Hallucination

1. **No Fake Weather**: Gemini never invents temperature, precipitation, or barometric measurements. Numbers are supplied strictly via tool executions.
2. **No Fake Risk Scores**: Risk levels (`LOW`, `MODERATE`, `HIGH`, `EXTREME`) are calculated by the rule-based Risk Engine.
3. **No Fake Government Warnings**: System-generated alerts are clearly labeled as research prototypes, never claiming to be statutory IMD or NDMA bulletins.
4. **Untrusted Data Isolation**: All retrieved documents and tool telemetry are framed as pure data inside fenced markers, rendering prompt-injection attempts ineffective.

---

## 4. Multi-Turn Conversation Memory

The controller tracks conversation sessions with bounded memory (up to 10 messages per session) with automatic expiration to prevent token bloat and memory leaks. Pronouns such as *"Will that be dangerous?"* or *"What should I do about that?"* automatically resolve against the previous turn's context.

---

## 5. Resilient Failure & Quota Fallback

If `GEMINI_API_KEY` is missing, rate-limited (e.g. quota exhaustion), or encounters network timeouts, WeatherGPT activates its **Deterministic Grounded Fallback**:
- Automatically synthesizes a structured, factual answer using tool telemetry.
- Ensures 100% uptime for the chat interface without exposing raw API errors or breaking user experience.

---

## 6. API Specification

### `POST /api/v1/chat/message`

**Request:**
```json
{
  "message": "Is there flood risk?",
  "lat": 12.8342,
  "lon": 79.7036,
  "conversation_id": "conv_user_123"
}
```

**Response:**
```json
{
  "answer": "WeatherGPT Hazard Risk Assessment: Heavy Rain / Flood Risk...",
  "intent": "RISK",
  "tool_calls": [
    {
      "tool_name": "risk_assessment",
      "status": "success",
      "execution_time_ms": 45
    }
  ],
  "sources": [],
  "risk": { "risk_level": "HIGH", "risk_score": 0.68 },
  "alert": null,
  "metadata": {
    "model": "gemini-3.8-flash",
    "provider": "gemini",
    "fallback_used": false,
    "execution_time_ms": 112
  }
}
```

---

## 7. Configuration & Environment

In `.env.example`:
```bash
GEMINI_API_KEY=your_api_key_here
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.8-flash
```
