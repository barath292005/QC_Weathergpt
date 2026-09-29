import type { ToolCallTrace } from '../../types/agent';
import { documentStore } from '../rag/documentStore';

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, string>;
  execute(params: Record<string, any>, context: { apiBaseUrl: string; lat?: number; lon?: number }): Promise<any>;
}

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  constructor() {
    this.registerCoreTools();
  }

  private registerCoreTools() {
    // 1. weather_current
    this.register({
      name: 'weather_current',
      description: 'Fetches real-time surface meteorological telemetry for specified coordinates.',
      parameters: { lat: 'number', lon: 'number' },
      execute: async (params, ctx) => {
        const lat = params.lat ?? ctx.lat;
        const lon = params.lon ?? ctx.lon;
        const res = await fetch(`${ctx.apiBaseUrl}/api/v1/weather/current?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
        return res.json();
      },
    });

    // 2. weather_forecast
    this.register({
      name: 'weather_forecast',
      description: 'Retrieves multi-step numerical weather prediction forecast steps.',
      parameters: { lat: 'number', lon: 'number' },
      execute: async (params, ctx) => {
        const lat = params.lat ?? ctx.lat;
        const lon = params.lon ?? ctx.lon;
        const res = await fetch(`${ctx.apiBaseUrl}/api/v1/weather/forecast?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`Forecast API error: ${res.status}`);
        return res.json();
      },
    });

    // 3. climate_comparison
    this.register({
      name: 'climate_comparison',
      description: 'Calculates anomalies between current conditions and the 30-day ERA5 historical baseline.',
      parameters: { lat: 'number', lon: 'number' },
      execute: async (params, ctx) => {
        const lat = params.lat ?? ctx.lat;
        const lon = params.lon ?? ctx.lon;
        const res = await fetch(`${ctx.apiBaseUrl}/api/v1/climate/compare?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`Climate Comparison API error: ${res.status}`);
        return res.json();
      },
    });

    // 4. risk_assessment
    this.register({
      name: 'risk_assessment',
      description: 'Evaluates multi-factor flood and heavy rain impact risk using meteorological and soil wetness features.',
      parameters: { lat: 'number', lon: 'number', forecast_hours: 'number' },
      execute: async (params, ctx) => {
        const lat = params.lat ?? ctx.lat;
        const lon = params.lon ?? ctx.lon;
        const hours = params.forecast_hours ?? 24;
        const res = await fetch(`${ctx.apiBaseUrl}/api/v1/risk/assess?lat=${lat}&lon=${lon}&forecast_hours=${hours}`);
        if (!res.ok) throw new Error(`Risk API error: ${res.status}`);
        return res.json();
      },
    });

    // 5. active_alerts
    this.register({
      name: 'active_alerts',
      description: 'Retrieves active early warning advisories and status for given coordinates.',
      parameters: { lat: 'number', lon: 'number' },
      execute: async (params, ctx) => {
        const lat = params.lat ?? ctx.lat;
        const lon = params.lon ?? ctx.lon;
        const res = await fetch(`${ctx.apiBaseUrl}/api/v1/alerts/current?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`Alerts API error: ${res.status}`);
        return res.json();
      },
    });

    // 6. knowledge_search (RAG)
    this.register({
      name: 'knowledge_search',
      description: 'Retrieves authoritative standard operating procedures and guidelines from NDMA and IMD.',
      parameters: { query: 'string', top_k: 'number' },
      execute: async (params) => {
        const q = params.query || '';
        const topK = params.top_k || 4;
        const results = documentStore.search(q, topK);
        return results.map((r) => ({
          chunk_id: r.chunk.chunk_id,
          document_id: r.chunk.document_id,
          title: r.chunk.metadata.title,
          organization: r.chunk.metadata.organization,
          url: r.chunk.metadata.url,
          category: r.chunk.metadata.category,
          text: r.chunk.text,
          relevance: Number(r.score.toFixed(2)),
        }));
      },
    });

    // 7. what_if_simulation
    this.register({
      name: 'what_if_simulation',
      description: 'Computes analytical scenario simulation for hypothetical rainfall spikes.',
      parameters: { scenario_rainfall: 'number' },
      execute: async (params) => {
        const rain = params.scenario_rainfall || 50;
        let simLevel = 'LOW';
        let simScore = 0.15;
        if (rain >= 100) {
          simLevel = 'EXTREME';
          simScore = 0.88;
        } else if (rain >= 50) {
          simLevel = 'HIGH';
          simScore = 0.68;
        } else if (rain >= 25) {
          simLevel = 'MODERATE';
          simScore = 0.42;
        }
        return {
          scenario_rainfall: rain,
          simulated_risk_level: simLevel,
          simulated_risk_score: simScore,
          is_simulation: true,
          notice: 'Hypothetical stress-test simulation only — not an actual weather forecast.',
        };
      },
    });

    // 8. geospatial_context
    this.register({
      name: 'geospatial_context',
      description: 'Returns geospatial boundaries, coordinates, and hazard map zoom focus metadata.',
      parameters: { lat: 'number', lon: 'number' },
      execute: async (params, ctx) => {
        const lat = params.lat ?? ctx.lat ?? 12.8342;
        const lon = params.lon ?? ctx.lon ?? 79.7036;
        return {
          latitude: lat,
          longitude: lon,
          layer: 'Geospatial Hazard Map (OpenStreetMap Leaflet)',
          overlay_active: true,
          radius_meters: 5000,
        };
      },
    });
  }

  public register(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  public listTools(): Array<{ name: string; description: string; parameters: Record<string, string> }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  public async executeTool(
    name: string,
    params: Record<string, any>,
    context: { apiBaseUrl: string; lat?: number; lon?: number }
  ): Promise<{ result: any; trace: ToolCallTrace }> {
    const tool = this.tools.get(name);
    const startTime = Date.now();

    if (!tool) {
      return {
        result: null,
        trace: {
          tool_name: name,
          parameters: params,
          status: 'failed',
          summary: `Tool ${name} is not in the registered allowlist.`,
          execution_time_ms: 0,
        },
      };
    }

    try {
      const result = await tool.execute(params, context);
      const executionTime = Date.now() - startTime;
      return {
        result,
        trace: {
          tool_name: name,
          parameters: params,
          status: 'success',
          summary: `Executed ${name} successfully`,
          execution_time_ms: executionTime,
        },
      };
    } catch (err: any) {
      const executionTime = Date.now() - startTime;
      return {
        result: null,
        trace: {
          tool_name: name,
          parameters: params,
          status: 'failed',
          summary: err.message || `Failed executing tool ${name}`,
          execution_time_ms: executionTime,
        },
      };
    }
  }
}

export const toolRegistry = new ToolRegistry();
