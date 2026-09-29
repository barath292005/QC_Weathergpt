import type { AgentIntent, AgentChatMessage } from '../../types/agent';
import { Guardrails } from './guardrails';

export interface StructuredToolContext {
  intent: AgentIntent;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  weather?: any;
  climate?: any;
  risk?: any;
  alerts?: any[];
  sources?: any[];
  what_if?: any;
  history?: AgentChatMessage[];
}

export class PromptBuilder {
  public static readonly SYSTEM_PROMPT = `You are WeatherGPT, an impact-based weather intelligence and early-warning assistant built for disaster mitigation and civic awareness.

CORE GROUNDING RULES:
1. Real Data Authority: Never invent, extrapolate, or guess numerical weather values (temperature, precipitation, wind, humidity, air pressure). All numbers must come directly from tool outputs.
2. Risk Grounding: Never invent risk scores or risk categories. Impact levels (LOW, MODERATE, HIGH, EXTREME) must come from the rule-based Risk Engine.
3. Alert Distinctions: System-generated WeatherGPT risk alerts are computational prototypes. They are NOT official statutory government warnings (e.g. from IMD or NDMA). Explicitly state this distinction when discussing severe risks.
4. RAG Source Attribution: When answering disaster preparedness or meteorological questions, cite the authoritative source (e.g. "According to the National Disaster Management Authority (NDMA)..." or "As classified by the India Meteorological Department (IMD)...").
5. Simulation Isolation: If a What-If scenario is simulated (e.g. "What happens if rainfall reaches 80 mm?"), clearly label it as a hypothetical simulation and NEVER confuse it with the actual live weather forecast.
6. Conciseness: For simple queries (e.g. "What is the temperature?"), give a clear, direct answer. For complex risk or hazard queries, organize the response logically into:
   - SUMMARY
   - CURRENT CONDITIONS
   - FORECAST & RISK
   - WHY & DRIVERS
   - RECOMMENDED ACTION
   - SOURCES / DISCLAIMER
7. Missing Data: If specific tool data is unavailable, state the limitation clearly rather than guessing.`;

  public static buildUserPrompt(userMessage: string, context: StructuredToolContext): string {
    const sections: string[] = [];

    // 1. History Context (bounded to last 4 messages)
    if (context.history && context.history.length > 0) {
      const recentHistory = context.history.slice(-4);
      const historyText = recentHistory
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');
      sections.push(Guardrails.wrapAsUntrustedData('CONVERSATION_HISTORY', historyText));
    }

    // 2. Structured Telemetry & Tool Data
    const toolDataJson: Record<string, any> = {
      intent: context.intent,
      location: context.location,
    };
    if (context.weather) toolDataJson.weather = context.weather;
    if (context.climate) toolDataJson.climate = context.climate;
    if (context.risk) toolDataJson.risk = context.risk;
    if (context.alerts && context.alerts.length > 0) toolDataJson.alerts = context.alerts;
    if (context.what_if) toolDataJson.what_if_simulation = context.what_if;

    sections.push(Guardrails.wrapAsUntrustedData('TOOL_TELEMETRY', JSON.stringify(toolDataJson, null, 2)));

    // 3. RAG Reference Passages
    if (context.sources && context.sources.length > 0) {
      const sourcesText = context.sources
        .map(
          (s, idx) => `[Source ${idx + 1}]
Title: ${s.title}
Organization: ${s.organization}
URL: ${s.url}
Text: ${s.text || s.snippet || 'Authoritative Guidelines'}`
        )
        .join('\n\n');
      sections.push(Guardrails.wrapAsUntrustedData('AUTHORITATIVE_KNOWLEDGE_BASE', sourcesText));
    }

    // 4. Current User Query
    sections.push(`USER QUERY:\n${userMessage}`);

    return sections.join('\n\n');
  }
}
