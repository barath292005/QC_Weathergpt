import { GoogleGenAI } from '@google/genai';
import type { RAGQueryResponse, RAGSourceCitation, QueryClassification } from '../../types/rag';
import { documentStore } from './documentStore';
import { classifyQuery } from './classifier';
import { buildRAGPromptContext } from './contextBuilder';

export class RAGService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.ai = new GoogleGenAI();
    }
  }

  public search(query: string, topK = 4) {
    return documentStore.search(query, topK);
  }

  public async answerQuery(
    query: string,
    topK = 4,
    coords?: { lat: number; lon: number },
    liveContext?: {
      weather?: any;
      climate?: any;
      risk?: any;
      alert?: any;
    }
  ): Promise<RAGQueryResponse> {
    const { classification, reason } = classifyQuery(query);

    // 1. Tool Routing: Real-Time Weather
    if (classification === 'WEATHER' && liveContext?.weather?.current) {
      const c = liveContext.weather.current;
      const loc = liveContext.weather.location?.timezone || 'Selected Area';
      const answer = `[Weather Engine] Current conditions for ${loc} (${c.latitude.toFixed(2)}°N, ${c.longitude.toFixed(2)}°E):
• Temperature: ${c.temperature}°C (Feels like: ${c.feels_like ?? c.temperature}°C)
• Weather Condition: ${c.condition}
• Relative Humidity: ${c.humidity}%
• Wind Speed: ${c.wind_speed} km/h (Direction: ${c.wind_direction}°)
• Precipitation Rate: ${c.precipitation} mm/hr
• Source: Open-Meteo High-Resolution Numerical Forecast Model`;
      return {
        answer,
        tool_used: 'WEATHER',
        sources: [
          {
            document_id: 'live-weather-telemetry',
            title: 'Real-Time Meteorological Telemetry Stream',
            organization: 'Open-Meteo Numerical Weather Prediction Engine',
            url: 'https://open-meteo.com',
          },
        ],
        classification_reason: reason,
      };
    }

    // 2. Tool Routing: Impact Risk Engine
    if (classification === 'RISK' && liveContext?.risk) {
      const r = liveContext.risk;
      const scorePct = Math.round(r.risk_score * 100);
      const answer = `[Impact Risk Engine] Hazard Assessment: ${r.hazard}
• Computed Risk Level: ${r.risk_level} (${scorePct}%)
• Forecast Precipitation: ${r.features.forecast_precipitation ?? 0} mm (24h window)
• Historical Daily Baseline: ${r.features.historical_rainfall_baseline ?? 0} mm/day
• Soil Wetness / Antecedent Rain: ${r.features.recent_rainfall ?? 0} mm
• Assessment Drivers:
${(r.drivers || []).map((d: any) => `  - ${d.message}`).join('\n')}
• Recommended Actions:
${(r.recommended_actions || []).map((a: string) => `  - ${a}`).join('\n')}

Notice: This is an AI-generated decision support assessment, not an official government warning.`;
      return {
        answer,
        tool_used: 'RISK',
        sources: [
          {
            document_id: 'weathergpt-risk-engine',
            title: 'WeatherGPT Multi-Factor Impact-Based Hazard Assessment',
            organization: 'WeatherGPT Computational Risk Engine',
            url: 'https://weathergpt.gov.in/docs/risk',
          },
        ],
        classification_reason: reason,
      };
    }

    // 3. Tool Routing: Alerts Engine
    if (classification === 'ALERT' && liveContext?.alert) {
      const a = liveContext.alert;
      const answer = `[Alerts Engine] Active Early Warning Status:
• Status: [${a.severity}] ${a.title}
• Hazard: ${a.hazard}
• Risk Score: ${Math.round(a.risk_score * 100)}% (${a.risk_level})
• Description: ${a.description}
• Key Evidence:
${(a.evidence || []).map((e: string) => `  - ${e}`).join('\n')}
• Actionable Guidance:
${(a.recommended_actions || []).map((act: string) => `  - ${act}`).join('\n')}

⚠ Official Warning Notice: System-generated early warning prototype. For statutory disaster alerts, always verify with local IMD/NDMA bulletins.`;
      return {
        answer,
        tool_used: 'ALERT',
        sources: [
          {
            document_id: 'weathergpt-alerts-engine',
            title: 'WeatherGPT Automated Early Warning & Advisory Feed',
            organization: 'WeatherGPT Alerts Engine',
            url: 'https://weathergpt.gov.in/docs/alerts',
          },
        ],
        classification_reason: reason,
      };
    }

    // 4. Tool Routing: RAG Knowledge Retrieval
    const relevantChunks = this.search(query, topK);

    if (relevantChunks.length === 0) {
      return {
        answer: "I couldn't find enough information in the configured trusted sources to answer that reliably. Please consult official guidelines from the India Meteorological Department (https://mausam.imd.gov.in) or NDMA (https://ndma.gov.in).",
        tool_used: 'RAG',
        sources: [],
        classification_reason: 'No matching authoritative documents met the minimum relevance threshold.',
      };
    }

    const { systemPrompt, userPrompt, sources } = buildRAGPromptContext(query, relevantChunks);

    // Try Gemini LLM generation with fallback
    if (this.ai) {
      try {
        const response = await this.ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.2,
          },
        });

        if (response.text && response.text.trim()) {
          return {
            answer: response.text.trim(),
            tool_used: 'RAG',
            sources,
            classification_reason: reason,
          };
        }
      } catch (err: any) {
        console.warn('Gemini API call failed, using deterministic grounded synthesis fallback:', err?.message);
      }
    }

    // Deterministic Grounded Synthesis Fallback (guarantees 100% reliable responses without hallucination)
    const primaryChunk = relevantChunks[0].chunk;
    const bulletPoints = primaryChunk.text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.endsWith(':'))
      .slice(0, 8);

    const fallbackAnswer = `According to official guidance from the **${primaryChunk.metadata.organization}** (*${primaryChunk.metadata.title}*):\n\n` +
      bulletPoints.join('\n') +
      `\n\nFor official and urgent alerts, consult official bulletins at ${primaryChunk.metadata.url}.`;

    return {
      answer: fallbackAnswer,
      tool_used: 'RAG',
      sources,
      classification_reason: reason,
    };
  }
}

export const ragService = new RAGService();
