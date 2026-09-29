import type { LLMProvider } from './provider';
import { GeminiProvider } from './geminiProvider';
import { PromptBuilder, type StructuredToolContext } from './promptBuilder';
import { Guardrails } from './guardrails';

export class LLMService {
  private provider: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider || new GeminiProvider();
  }

  public isLLMAvailable(): boolean {
    return this.provider.isAvailable();
  }

  public async generateExplanation(
    userMessage: string,
    context: StructuredToolContext
  ): Promise<{ text: string; model: string; provider: string; fallback_used: boolean }> {
    const { cleanText } = Guardrails.sanitizeInput(userMessage);

    // If Gemini provider is available, attempt generation
    if (this.provider.isAvailable()) {
      try {
        const prompt = PromptBuilder.buildUserPrompt(cleanText, context);
        const res = await this.provider.generate(prompt, {
          systemInstruction: PromptBuilder.SYSTEM_PROMPT,
          temperature: 0.2,
        });

        if (res.text && res.text.trim()) {
          return {
            text: res.text.trim(),
            model: res.model,
            provider: res.provider,
            fallback_used: false,
          };
        }
      } catch (err: any) {
        console.warn('LLM generation encountered an error, activating deterministic grounded fallback:', err?.message);
      }
    }

    // Deterministic Grounded Fallback
    const fallback = this.generateDeterministicFallback(context);
    return {
      text: fallback,
      model: 'deterministic-rules-engine',
      provider: 'weathergpt-core',
      fallback_used: true,
    };
  }

  private generateDeterministicFallback(context: StructuredToolContext): string {
    const loc = context.location?.name || 'Selected Location';

    switch (context.intent) {
      case 'WEATHER': {
        const c = context.weather?.current;
        if (!c) return `Real-time weather telemetry is currently unavailable for ${loc}.`;
        return `Current weather for ${loc}:
• Temperature: ${c.temperature}°C (Feels like: ${c.feels_like ?? c.temperature}°C)
• Condition: ${c.condition}
• Relative Humidity: ${c.humidity}%
• Wind: ${c.wind_speed} km/h (${c.wind_direction}°)
• Precipitation Rate: ${c.precipitation} mm/hr
(Source: Open-Meteo Numerical Weather Prediction)`;
      }

      case 'RISK': {
        const r = context.risk;
        if (!r) return `Risk assessment data is not currently computed for ${loc}.`;
        const score = Math.round((r.risk_score || 0) * 100);
        const drivers = (r.drivers || []).map((d: any) => `  - ${d.message}`).join('\n');
        const actions = (r.recommended_actions || []).map((a: string) => `  - ${a}`).join('\n');
        return `WeatherGPT Hazard Risk Assessment: ${r.hazard}
• Risk Level: ${r.risk_level} (${score}%)
• Forecast Rainfall: ${r.features?.forecast_precipitation ?? 0} mm (24h window)
• Baseline Average: ${r.features?.historical_rainfall_baseline ?? 0} mm/day
• Assessment Drivers:
${drivers || '  - Normal baseline parameters'}
• Recommended Actions:
${actions || '  - Continue routine monitoring'}

Notice: System-generated risk assessment prototype, not an official government warning.`;
      }

      case 'ALERT': {
        const a = context.alerts?.[0];
        if (!a) return `No active critical early-warning alerts for ${loc}. Normal baseline weather monitoring active.`;
        return `WeatherGPT Early Warning Advisory:
• Severity: [${a.severity}] ${a.title}
• Hazard: ${a.hazard}
• Risk Score: ${Math.round((a.risk_score || 0) * 100)}% (${a.risk_level})
• Description: ${a.description}
• Recommended Actions:
${(a.recommended_actions || []).map((act: string) => `  - ${act}`).join('\n')}

⚠ Official Notice: System-generated early warning prototype. Always verify with official IMD/NDMA bulletins.`;
      }

      case 'CLIMATE': {
        const comp = context.climate?.comparison;
        const sum = context.climate?.summary;
        if (!comp && !sum) return `Historical climate baselines for ${loc} are currently being analyzed.`;
        return `Historical Climate Baseline & Comparison:
• Historical 30-Day Mean Rainfall: ${sum?.rainfall_avg ?? 'N/A'} mm/day
• Historical 30-Day Mean Temperature: ${sum?.temp_avg ?? 'N/A'}°C
• Temperature Anomaly: ${comp?.temperature?.diff_from_baseline ? (comp.temperature.diff_from_baseline > 0 ? '+' : '') + comp.temperature.diff_from_baseline + '°C' : 'Normal'}
• Precipitation Anomaly: ${comp?.rainfall?.anomaly_ratio ? Math.round(comp.rainfall.anomaly_ratio * 100) + '%' : 'Normal'}
(Source: ECMWF ERA5 Climate Reanalysis)`;
      }

      case 'WHAT_IF': {
        const sim = context.what_if;
        return `[What-If Hypothetical Simulation]
Simulated Scenario: Rainfall increased to ${sim?.scenario_rainfall ?? 'hypothetical'} mm.
Simulated Risk Score: ${Math.round((sim?.simulated_risk_score ?? 0.65) * 100)}% (${sim?.simulated_risk_level ?? 'HIGH'}).
Impact: Potential localized waterlogging and low-lying inundation.
Note: This is an analytical simulation model and does NOT represent an actual weather forecast.`;
      }

      case 'RAG': {
        if (!context.sources || context.sources.length === 0) {
          return "I couldn't find enough information in the configured trusted sources to answer that reliably. Please consult official guidelines from the India Meteorological Department (https://mausam.imd.gov.in) or NDMA (https://ndma.gov.in).";
        }
        const src = context.sources[0];
        return `According to official guidelines from ${src.organization} (*${src.title}*):\n\n${src.text || src.snippet || 'Refer to official disaster standard operating procedures.'}\n\nFor official advisories, visit ${src.url}.`;
      }

      default:
        return 'WeatherGPT is ready to assist you. Ask about real-time weather conditions, historical climate comparisons, impact risk scores, active alerts, or disaster safety protocols.';
    }
  }
}

export const llmService = new LLMService();
