import type { AgentIntent } from '../../types/agent';

export interface PlannedToolStep {
  toolName: string;
  params: Record<string, any>;
  description: string;
}

export class AgentPlanner {
  public static plan(intent: AgentIntent, query: string, lat: number, lon: number): PlannedToolStep[] {
    switch (intent) {
      case 'WEATHER':
        return [
          {
            toolName: 'weather_current',
            params: { lat, lon },
            description: 'Retrieve real-time surface temperature, precipitation, and wind telemetry',
          },
          {
            toolName: 'weather_forecast',
            params: { lat, lon },
            description: 'Retrieve numerical forecast trajectory for the next 24 hours',
          },
        ];

      case 'CLIMATE':
        return [
          {
            toolName: 'climate_comparison',
            params: { lat, lon },
            description: 'Compare current measurements with the 30-day historical ERA5 reanalysis baseline',
          },
        ];

      case 'RISK':
        return [
          {
            toolName: 'risk_assessment',
            params: { lat, lon, forecast_hours: 24 },
            description: 'Execute impact-based hydrological risk scoring over a 24-hour horizon',
          },
          {
            toolName: 'active_alerts',
            params: { lat, lon },
            description: 'Verify if active early warning advisories correspond to the computed risk level',
          },
        ];

      case 'ALERT':
        return [
          {
            toolName: 'active_alerts',
            params: { lat, lon },
            description: 'Query live early-warning feed for active severe advisories',
          },
        ];

      case 'RAG':
        return [
          {
            toolName: 'knowledge_search',
            params: { query, top_k: 4 },
            description: 'Retrieve grounded disaster standard operating procedures and meteorological glossary items',
          },
        ];

      case 'WHAT_IF': {
        // Extract numbers if present in query, e.g. "if rainfall reaches 80 mm"
        const match = query.match(/(\d+)\s*(mm|cm)?/i);
        const scenarioRainfall = match ? parseInt(match[1], 10) : 50;
        return [
          {
            toolName: 'what_if_simulation',
            params: { scenario_rainfall: scenarioRainfall },
            description: `Run stress-test simulation with hypothetical rainfall spike of ${scenarioRainfall} mm`,
          },
        ];
      }

      case 'MAP':
        return [
          {
            toolName: 'geospatial_context',
            params: { lat, lon },
            description: 'Retrieve geospatial coordinate bounds and Leaflet hazard map layer information',
          },
          {
            toolName: 'risk_assessment',
            params: { lat, lon, forecast_hours: 24 },
            description: 'Retrieve spatial risk overlay properties',
          },
        ];

      case 'GENERAL':
      default:
        return [
          {
            toolName: 'weather_current',
            params: { lat, lon },
            description: 'Retrieve basic current weather context',
          },
        ];
    }
  }
}
