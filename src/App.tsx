import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { LocationSelector, PRESET_LOCATIONS } from './components/LocationSelector';
import { WeatherDashboard } from './components/WeatherDashboard';
import type { WeatherResponseData } from './components/WeatherDashboard';
import { ClimatePanel } from './components/ClimatePanel';
import { RiskPanel } from './components/RiskPanel';
import { MapPanel } from './components/MapPanel';
import { ChatPanel } from './components/ChatPanel';
import { AlertPanel } from './components/AlertPanel';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { RiskAssessment } from './types/risk';
import type { WeatherGPTAlert } from './types/alert';
import { getApiBaseUrl } from './utils/api';

const RISK_FORECAST_HOURS = 24;

interface HealthData {
  status: string;
  service: string;
}

export const App: React.FC = () => {
  // Health Check State
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Active Coordinates State (Default: Kanchipuram, TN / Disaster Sector Alpha)
  const [coords, setCoords] = useState<{ lat: number; lon: number; label: string }>({
    lat: PRESET_LOCATIONS[0].lat,
    lon: PRESET_LOCATIONS[0].lon,
    label: PRESET_LOCATIONS[0].label,
  });

  // Weather Engine State
  const [weatherData, setWeatherData] = useState<WeatherResponseData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Shared Risk Engine State (RiskPanel + Geospatial Map)
  const [riskData, setRiskData] = useState<RiskAssessment | null>(null);
  const [riskLoading, setRiskLoading] = useState<boolean>(true);
  const [riskError, setRiskError] = useState<string | null>(null);

  // Early Warning Alert State
  const [currentAlert, setCurrentAlert] = useState<WeatherGPTAlert | null>(null);

  // Fetch Core API Health Status
  const fetchHealthStatus = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/v1/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: HealthData = await response.json();
      setHealthData(data);
    } catch (err: any) {
      console.error('Backend health check failed:', err);
      setHealthError(err.message || 'Failed to communicate with WeatherGPT backend API');
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Fetch Real-Time Weather Data for current coordinates
  const fetchWeatherData = useCallback(async (lat: number, lon: number) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/v1/weather/current?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.detail || `Weather API error! HTTP ${response.status}`);
      }
      const data: WeatherResponseData = await response.json();
      setWeatherData(data);
    } catch (err: any) {
      console.error('Weather data retrieval failed:', err);
      setWeatherError(err.message || 'Unable to retrieve weather data. Please try again.');
      setWeatherData(null);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  const fetchRiskData = useCallback(async (lat: number, lon: number) => {
    setRiskLoading(true);
    setRiskError(null);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(
        `${apiBaseUrl}/api/v1/risk/assess?lat=${lat}&lon=${lon}&forecast_hours=${RISK_FORECAST_HOURS}`
      );
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.detail || `Risk API error! HTTP ${response.status}`);
      }
      const data: RiskAssessment = await response.json();
      setRiskData(data);
    } catch (err: any) {
      console.error('Risk assessment retrieval failed:', err);
      setRiskError(err.message || 'Unable to retrieve risk assessment. Please try again.');
      setRiskData(null);
    } finally {
      setRiskLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthStatus();
    fetchWeatherData(coords.lat, coords.lon);
    fetchRiskData(coords.lat, coords.lon);
  }, [fetchHealthStatus, fetchWeatherData, fetchRiskData]);

  const handleLocationSelect = (lat: number, lon: number, label: string) => {
    setCoords({ lat, lon, label });
    fetchWeatherData(lat, lon);
    fetchRiskData(lat, lon);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Application Header */}
      <Header
        healthStatus={healthData}
        loading={healthLoading}
        error={healthError}
        onRetry={fetchHealthStatus}
      />

      {/* Main Content Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Backend Connection Status Banner */}
        {healthError ? (
          <div className="bg-rose-950/40 border border-rose-800/60 p-4 rounded-xl flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <span className="font-semibold text-rose-200">Backend Server Unreachable</span>
                <p className="text-slate-400 mt-0.5">
                  Could not connect to WeatherGPT FastAPI server on port 8000. Please start the backend process.
                </p>
              </div>
            </div>
            <button
              onClick={fetchHealthStatus}
              className="px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded-lg border border-rose-700 font-medium transition shrink-0 ml-4"
            >
              Retry Connection
            </button>
          </div>
        ) : healthData ? (
          <div className="bg-emerald-950/20 border border-emerald-800/30 px-4 py-2 rounded-xl flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                Backend Verified: <strong>{healthData.service}</strong> Engine returning <code className="font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded text-emerald-300">status: "{healthData.status}"</code>
              </span>
            </div>
            <span className="text-[11px] text-emerald-500/80 font-mono">Real-Time Telemetry & Climate Analytics Active</span>
          </div>
        ) : null}

        {/* Location Selector Bar (Reused for all weather & climate modules) */}
        <LocationSelector
          currentLat={coords.lat}
          currentLon={coords.lon}
          onLocationSelect={handleLocationSelect}
        />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Weather, Climate & Risk (2 cols wide on large screens) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Real-time Weather Intelligence Dashboard */}
            <WeatherDashboard
              weather={weatherData}
              loading={weatherLoading}
              error={weatherError}
              onRetry={() => fetchWeatherData(coords.lat, coords.lon)}
            />

            {/* Historical Climate & Statistical Analysis Engine */}
            <ClimatePanel lat={coords.lat} lon={coords.lon} />

            {/* Impact-Based Risk Analytics */}
            <RiskPanel
              data={riskData}
              loading={riskLoading}
              error={riskError}
              onRetry={() => fetchRiskData(coords.lat, coords.lon)}
            />

            {/* Geospatial Hazard Map */}
            <MapPanel
              lat={coords.lat}
              lon={coords.lon}
              risk={riskData}
              loading={riskLoading}
              error={riskError}
              alert={currentAlert}
            />
          </div>

          {/* Column 2: Conversational AI & Alerts (1 col wide on large screens) */}
          <div className="lg:col-span-1 space-y-6 flex flex-col">
            {/* Conversational Assistant */}
            <div className="flex-1 min-h-[380px]">
              <ChatPanel lat={coords.lat} lon={coords.lon} />
            </div>

            {/* Disaster Alerts Feed */}
            <AlertPanel
              lat={coords.lat}
              lon={coords.lon}
              onAlertChange={setCurrentAlert}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WeatherGPT Climate & Weather Engine • Smart India Hackathon Project</span>
          <span className="font-mono text-slate-600">FastAPI • SQLAlchemy ORM • Open-Meteo ERA5 Reanalysis</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
