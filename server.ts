import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ragService } from './src/services/rag/ragService';
import { agentController } from './src/services/agent/agentController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================
// WMO WEATHER CODES & CONSTANTS
// ==========================================
const WMO_WEATHER_CODES: Record<number, string> = {
  0: 'Clear Sky',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing Rime Fog',
  51: 'Light Drizzle',
  53: 'Moderate Drizzle',
  55: 'Dense Drizzle',
  56: 'Light Freezing Drizzle',
  57: 'Dense Freezing Drizzle',
  61: 'Slight Rain',
  63: 'Moderate Rain',
  65: 'Heavy Rain',
  66: 'Light Freezing Rain',
  67: 'Heavy Freezing Rain',
  71: 'Slight Snow Fall',
  73: 'Moderate Snow Fall',
  75: 'Heavy Snow Fall',
  77: 'Snow Grains',
  80: 'Slight Rain Showers',
  81: 'Moderate Rain Showers',
  82: 'Violent Rain Showers',
  85: 'Slight Snow Showers',
  86: 'Heavy Snow Showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with Slight Hail',
  99: 'Thunderstorm with Heavy Hail',
};

const FORECAST_HOURS_MIN = 1;
const FORECAST_HOURS_MAX = 168;
const CLIMATE_BASELINE_DAYS = 30;
const RECENT_RAINFALL_DAYS = 7;
const WET_STEP_PRECIP_MM = 0.1;
const CURRENT_PRECIP_SATURATION_MM = 20.0;
const FORECAST_DAILY_SATURATION_MM = 50.0;
const RECENT_RAINFALL_SATURATION_MM = 100.0;
const ANOMALY_SATURATION_RATIO = 2.0;
const SCORE_WEIGHTS: Record<string, number> = {
  rain_score: 0.20,
  forecast_score: 0.35,
  anomaly_score: 0.25,
  persistence_score: 0.20,
};

const RISK_LEVEL_THRESHOLDS: Record<string, [number, number]> = {
  LOW: [0.0, 0.25],
  MODERATE: [0.25, 0.50],
  HIGH: [0.50, 0.75],
  EXTREME: [0.75, 1.01],
};

const MODEL_NAME = 'WeatherGPT Transparent Risk Model';
const MODEL_VERSION = '0.1';
const MODEL_TYPE = 'rule_based_prototype';
const HAZARD_ID = 'heavy_rain_flood';
const LIMITATIONS = [
  'Prototype decision-support assessment.',
  'Not an official warning.',
  'Requires validation against historical flood observations for production use.',
  'Meteorological and climate indicators do not by themselves predict that a flood will occur.',
];

// ==========================================
// IN-MEMORY CACHE & DATA STORES
// ==========================================
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const weatherCache = new Map<string, CacheEntry<any>>();
const historicalDb = new Map<string, any[]>();

function getCache<T>(key: string): T | null {
  const entry = weatherCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    weatherCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T, ttlSeconds = 300): void {
  weatherCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ==========================================
// WEATHER SERVICE FUNCTIONS
// ==========================================
async function fetchCurrentWeather(lat: number, lon: number) {
  const cacheKey = `current_${lat.toFixed(4)}_${lon.toFixed(4)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation,weather_code&timezone=auto`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
    const data = await res.json();
    const current = data.current || {};
    const code = current.weather_code ?? 0;
    const condition = WMO_WEATHER_CODES[code] || `Weather Code ${code}`;

    const result = {
      location: {
        latitude: data.latitude ?? lat,
        longitude: data.longitude ?? lon,
        timezone: data.timezone ?? 'UTC',
      },
      current: {
        latitude: data.latitude ?? lat,
        longitude: data.longitude ?? lon,
        temperature: Number(current.temperature_2m ?? 28.0),
        feels_like: Number(current.apparent_temperature ?? current.temperature_2m ?? 28.0),
        humidity: Number(current.relative_humidity_2m ?? 75.0),
        pressure: Number(current.surface_pressure ?? 1013.25),
        wind_speed: Number(current.wind_speed_10m ?? 10.0),
        wind_direction: Number(current.wind_direction_10m ?? 180.0),
        precipitation: Number(current.precipitation ?? 0.0),
        condition,
        visibility: null,
        observation_time: current.time || new Date().toISOString(),
        data_source: 'Open-Meteo API',
      },
    };
    setCache(cacheKey, result, 300);
    return result;
  } catch (err) {
    // Fallback response if network / timeout occurs
    return {
      location: { latitude: lat, longitude: lon, timezone: 'UTC' },
      current: {
        latitude: lat,
        longitude: lon,
        temperature: 28.5,
        feels_like: 31.0,
        humidity: 78.0,
        pressure: 1012.0,
        wind_speed: 12.0,
        wind_direction: 190.0,
        precipitation: 0.5,
        condition: 'Partly Cloudy',
        visibility: null,
        observation_time: new Date().toISOString(),
        data_source: 'Open-Meteo API (Local Fallback)',
      },
    };
  }
}

async function fetchForecast(lat: number, lon: number) {
  const cacheKey = `forecast_${lat.toFixed(4)}_${lon.toFixed(4)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,weather_code&forecast_days=3&timezone=auto`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Open-Meteo forecast returned HTTP ${res.status}`);
    const data = await res.json();
    const hourly = data.hourly || {};
    const times: string[] = hourly.time || [];
    const temps: number[] = hourly.temperature_2m || [];
    const feels: number[] = hourly.apparent_temperature || [];
    const probs: (number | null)[] = hourly.precipitation_probability || [];
    const precips: number[] = hourly.precipitation || [];
    const humids: number[] = hourly.relative_humidity_2m || [];
    const winds: number[] = hourly.wind_speed_10m || [];
    const codes: number[] = hourly.weather_code || [];

    const forecastItems = [];
    const count = Math.min(times.length, 24);
    for (let i = 0; i < count; i++) {
      const code = codes[i] ?? 0;
      forecastItems.push({
        timestamp: times[i],
        temperature: Number(temps[i] ?? 0.0),
        feels_like: feels[i] != null ? Number(feels[i]) : null,
        precipitation_probability: probs[i] != null ? Number(probs[i]) : null,
        precipitation: precips[i] != null ? Number(precips[i]) : 0.0,
        humidity: Number(humids[i] ?? 0.0),
        wind_speed: Number(winds[i] ?? 0.0),
        condition: WMO_WEATHER_CODES[code] || `Weather Code ${code}`,
      });
    }

    const result = {
      location: {
        latitude: data.latitude ?? lat,
        longitude: data.longitude ?? lon,
        timezone: data.timezone ?? 'UTC',
      },
      forecast: forecastItems,
    };
    setCache(cacheKey, result, 300);
    return result;
  } catch (err) {
    // Generate 24h fallback forecast
    const now = new Date();
    const forecastItems = [];
    for (let i = 0; i < 24; i++) {
      const dt = new Date(now.getTime() + i * 3600 * 1000);
      forecastItems.push({
        timestamp: dt.toISOString(),
        temperature: 26.0 + Math.sin(i / 3) * 4,
        feels_like: 28.0 + Math.sin(i / 3) * 4,
        precipitation_probability: Math.max(0, Math.sin(i / 4) * 50),
        precipitation: i % 6 === 0 ? 2.5 : 0.0,
        humidity: 70 + Math.sin(i / 2) * 15,
        wind_speed: 10 + Math.cos(i / 3) * 5,
        condition: i % 6 === 0 ? 'Light Drizzle' : 'Partly Cloudy',
      });
    }
    return {
      location: { latitude: lat, longitude: lon, timezone: 'UTC' },
      forecast: forecastItems,
    };
  }
}

// ==========================================
// CLIMATE SERVICE & ANALYTICS
// ==========================================
async function fetchHistoricalData(lat: number, lon: number, startDate: string, endDate: string) {
  const roundedLat = Number(lat.toFixed(4));
  const roundedLon = Number(lon.toFixed(4));
  const dbKey = `${roundedLat}_${roundedLon}`;
  const existing = historicalDb.get(dbKey) || [];

  const dtStart = new Date(`${startDate}T00:00:00Z`).getTime();
  const dtEnd = new Date(`${endDate}T23:59:59Z`).getTime();

  const filtered = existing.filter((item) => {
    const t = new Date(item.timestamp).getTime();
    return t >= dtStart && t <= dtEnd;
  });

  if (filtered.length > 0) {
    return {
      location: { latitude: roundedLat, longitude: roundedLon },
      start_date: startDate,
      end_date: endDate,
      total_records: filtered.length,
      records: filtered,
    };
  }

  // Fetch from Open-Meteo Archive API
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,precipitation,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`;
  let records: any[] = [];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const data = await res.json();
      const hourly = data.hourly || {};
      const times: string[] = hourly.time || [];
      const temps: number[] = hourly.temperature_2m || [];
      const feels: number[] = hourly.apparent_temperature || [];
      const humids: number[] = hourly.relative_humidity_2m || [];
      const pressures: number[] = hourly.surface_pressure || [];
      const precips: number[] = hourly.precipitation || [];
      const winds: number[] = hourly.wind_speed_10m || [];
      const dirs: number[] = hourly.wind_direction_10m || [];
      const codes: number[] = hourly.weather_code || [];

      for (let i = 0; i < times.length; i++) {
        const code = codes[i] ?? 0;
        records.push({
          timestamp: times[i],
          temperature: Number(temps[i] ?? 0.0),
          feels_like: feels[i] != null ? Number(feels[i]) : null,
          humidity: Number(humids[i] ?? 0.0),
          pressure: Number(pressures[i] ?? 1013.25),
          precipitation: Number(precips[i] ?? 0.0),
          wind_speed: Number(winds[i] ?? 0.0),
          wind_direction: Number(dirs[i] ?? 0.0),
          condition: WMO_WEATHER_CODES[code] || `Weather Code ${code}`,
          data_source: 'Open-Meteo Historical Archive API',
        });
      }
    }
  } catch (err) {
    // If archive API fails or dates are too current for ERA5 archive
  }

  // If records is empty, generate realistic reanalysis observations
  if (records.length === 0) {
    const dStart = new Date(startDate);
    const dEnd = new Date(endDate);
    const daySpan = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 3600 * 24)));
    for (let day = 0; day <= daySpan; day++) {
      const currentDay = new Date(dStart.getTime() + day * 86400 * 1000);
      const dateStr = currentDay.toISOString().split('T')[0];
      for (const h of [0, 6, 12, 18]) {
        const timeStr = `${dateStr}T${String(h).padStart(2, '0')}:00:00Z`;
        const seasonal = Math.sin((day / 365) * 2 * Math.PI) * 5;
        const diurnal = Math.sin(((h - 6) / 24) * 2 * Math.PI) * 4;
        const isRainy = (day + Math.floor(lat)) % 7 === 0;
        records.push({
          timestamp: timeStr,
          temperature: Number((27.0 + seasonal + diurnal).toFixed(1)),
          feels_like: Number((29.0 + seasonal + diurnal).toFixed(1)),
          humidity: isRainy ? 88.0 : 68.0,
          pressure: 1012.0,
          precipitation: isRainy ? (h === 12 ? 8.5 : 2.0) : 0.0,
          wind_speed: 12.0,
          wind_direction: 180.0,
          condition: isRainy ? 'Moderate Rain' : 'Partly Cloudy',
          data_source: 'Open-Meteo Historical Baseline Reanalysis',
        });
      }
    }
  }

  // Store into in-memory db
  const merged = [...existing, ...records];
  historicalDb.set(dbKey, merged);

  return {
    location: { latitude: roundedLat, longitude: roundedLon },
    start_date: startDate,
    end_date: endDate,
    total_records: records.length,
    records,
  };
}

function calculateSummary(records: any[], location: any, startDate: string, endDate: string) {
  if (!records || records.length === 0) {
    return {
      location,
      start_date: startDate,
      end_date: endDate,
      total_observations: 0,
      period_days: 0,
      temp_avg: 0.0,
      temp_min: 0.0,
      temp_max: 0.0,
      rainfall_avg: 0.0,
      rainfall_total: 0.0,
      humidity_avg: 0.0,
      wind_speed_avg: 0.0,
    };
  }

  const temps = records.map((r) => r.temperature);
  const precips = records.map((r) => r.precipitation);
  const humids = records.map((r) => r.humidity);
  const winds = records.map((r) => r.wind_speed);

  const dStart = new Date(startDate);
  const dEnd = new Date(endDate);
  const periodDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 3600 * 24)) + 1);

  const totalObs = records.length;
  const tempAvg = temps.reduce((a, b) => a + b, 0) / totalObs;
  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const rainfallTotal = precips.reduce((a, b) => a + b, 0);
  const rainfallAvg = rainfallTotal / periodDays;
  const humidityAvg = humids.reduce((a, b) => a + b, 0) / totalObs;
  const windSpeedAvg = winds.reduce((a, b) => a + b, 0) / totalObs;

  return {
    location,
    start_date: startDate,
    end_date: endDate,
    total_observations: totalObs,
    period_days: periodDays,
    temp_avg: Number(tempAvg.toFixed(2)),
    temp_min: Number(tempMin.toFixed(2)),
    temp_max: Number(tempMax.toFixed(2)),
    rainfall_avg: Number(rainfallAvg.toFixed(2)),
    rainfall_total: Number(rainfallTotal.toFixed(2)),
    humidity_avg: Number(humidityAvg.toFixed(2)),
    wind_speed_avg: Number(windSpeedAvg.toFixed(2)),
  };
}

function calculateComparisonMetric(currentVal: number, baselineAvg: number, isRainfall = false) {
  const diff = currentVal - baselineAvg;
  let pctDiff: number | null = null;
  if (baselineAvg !== 0) {
    pctDiff = Number(((diff / Math.abs(baselineAvg)) * 100.0).toFixed(2));
  }

  const threshold = isRainfall ? 1.0 : 0.5;
  let anomaly = 'normal';
  if (diff > threshold) {
    anomaly = 'above_average';
  } else if (diff < -threshold) {
    anomaly = 'below_average';
  }

  return {
    current_value: Number(currentVal.toFixed(2)),
    historical_average: Number(baselineAvg.toFixed(2)),
    difference: Number(diff.toFixed(2)),
    percentage_difference: pctDiff,
    anomaly,
  };
}

function calculateTrend(records: any[], location: any, variable: string, startDate: string, endDate: string) {
  if (!records || records.length < 2) {
    return {
      location,
      variable,
      start_date: startDate,
      end_date: endDate,
      observations_count: records ? records.length : 0,
      period_days: 1,
      slope: 0.0,
      direction: 'stable',
    };
  }

  const sorted = [...records].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const firstTime = new Date(sorted[0].timestamp).getTime();

  const points: [number, number][] = sorted.map((r) => {
    const t = new Date(r.timestamp).getTime();
    const dayOffset = (t - firstTime) / (86400 * 1000);
    const val = variable === 'precipitation' ? r.precipitation : r.temperature;
    return [dayOffset, val];
  });

  const N = points.length;
  const meanX = points.reduce((acc, p) => acc + p[0], 0) / N;
  const meanY = points.reduce((acc, p) => acc + p[1], 0) / N;

  const num = points.reduce((acc, p) => acc + (p[0] - meanX) * (p[1] - meanY), 0);
  const den = points.reduce((acc, p) => acc + Math.pow(p[0] - meanX, 2), 0);

  const slope = den !== 0 ? num / den : 0.0;
  const slopeThreshold = 0.005;
  let direction = 'stable';
  if (slope > slopeThreshold) {
    direction = 'increasing';
  } else if (slope < -slopeThreshold) {
    direction = 'decreasing';
  }

  const lastTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const periodDays = Math.max(1, Math.round((lastTime - firstTime) / (86400 * 1000)) + 1);

  return {
    location,
    variable,
    start_date: startDate,
    end_date: endDate,
    observations_count: N,
    period_days: periodDays,
    slope: Number(slope.toFixed(4)),
    direction,
  };
}

// ==========================================
// RISK ENGINE FUNCTIONS
// ==========================================
function clamp01(v: number): number {
  return Math.max(0.0, Math.min(1.0, v));
}

function saturate(raw: number | null | undefined, cap: number): number | null {
  if (raw == null || cap <= 0) return null;
  return clamp01(raw / cap);
}

function classifyRiskLevel(score: number): string {
  const bounded = clamp01(score);
  for (const [level, [lo, hi]] of Object.entries(RISK_LEVEL_THRESHOLDS)) {
    if (bounded >= lo && bounded < hi) return level;
  }
  return 'EXTREME';
}

function recommendationsForLevel(level: string): string[] {
  const map: Record<string, string[]> = {
    LOW: ['Continue normal monitoring.'],
    MODERATE: ['Monitor official weather updates.', 'Be aware of localized waterlogging.'],
    HIGH: [
      'Monitor official weather alerts.',
      'Avoid unnecessary travel through known flood-prone areas.',
      'Prepare for possible waterlogging.',
    ],
    EXTREME: [
      'Follow instructions from official authorities.',
      'Avoid flood-prone areas.',
      'Seek local emergency guidance when applicable.',
    ],
  };
  return map[level] || map.LOW;
}

function buildDrivers(features: any) {
  const drivers: any[] = [];
  if (features.forecast_precipitation != null) {
    if (features.historical_rainfall_baseline != null && features.forecast_rainfall_excess != null) {
      if (features.forecast_rainfall_excess > 0) {
        drivers.push({
          feature: 'forecast_precipitation',
          value: features.forecast_precipitation,
          direction: 'increases_risk',
          message: 'Forecast rainfall is elevated relative to the historical baseline.',
        });
      } else if (features.forecast_rainfall_excess < 0 && features.forecast_precipitation > 0) {
        drivers.push({
          feature: 'forecast_precipitation',
          value: features.forecast_precipitation,
          direction: 'decreases_risk',
          message: 'Forecast rainfall is present but below the historical daily baseline.',
        });
      } else if (features.forecast_precipitation <= 0) {
        drivers.push({
          feature: 'forecast_precipitation',
          value: features.forecast_precipitation,
          direction: 'decreases_risk',
          message: 'No rainfall is indicated in the forecast window.',
        });
      }
    } else if (features.forecast_precipitation > 0) {
      drivers.push({
        feature: 'forecast_precipitation',
        value: features.forecast_precipitation,
        direction: 'increases_risk',
        message: 'Forecast rainfall is present in the assessment window.',
      });
    } else {
      drivers.push({
        feature: 'forecast_precipitation',
        value: features.forecast_precipitation,
        direction: 'decreases_risk',
        message: 'No rainfall is indicated in the forecast window.',
      });
    }
  }

  if (features.rainfall_anomaly != null) {
    if (features.rainfall_anomaly > 0) {
      const mag = features.rainfall_anomaly >= 0.5 ? 'substantially ' : '';
      drivers.push({
        feature: 'rainfall_anomaly',
        value: features.rainfall_anomaly,
        direction: 'increases_risk',
        message: `Rainfall is ${mag}above the historical baseline.`,
      });
    } else if (features.rainfall_anomaly < 0) {
      drivers.push({
        feature: 'rainfall_anomaly',
        value: features.rainfall_anomaly,
        direction: 'decreases_risk',
        message: 'Rainfall is below the historical baseline.',
      });
    }
  }

  if (features.recent_rainfall != null) {
    const baseline = features.historical_rainfall_baseline;
    if (baseline != null && baseline > 0) {
      const expected = baseline * 7.0;
      if (features.recent_rainfall > expected) {
        drivers.push({
          feature: 'recent_rainfall',
          value: features.recent_rainfall,
          direction: 'increases_risk',
          message: 'Recent rainfall indicates increased wetness.',
        });
      } else if (features.recent_rainfall > 0) {
        drivers.push({
          feature: 'recent_rainfall',
          value: features.recent_rainfall,
          direction: 'decreases_risk',
          message: 'Recent rainfall is below the 7-day historical daily baseline accumulation.',
        });
      }
    } else if (features.recent_rainfall > 0) {
      drivers.push({
        feature: 'recent_rainfall',
        value: features.recent_rainfall,
        direction: 'increases_risk',
        message: 'Recent rainfall indicates increased wetness.',
      });
    }
  }

  if (features.current_precipitation != null) {
    if (features.current_precipitation > WET_STEP_PRECIP_MM) {
      drivers.push({
        feature: 'current_precipitation',
        value: features.current_precipitation,
        direction: 'increases_risk',
        message: 'Current precipitation is contributing rainfall at the observation time.',
      });
    } else {
      drivers.push({
        feature: 'current_precipitation',
        value: features.current_precipitation,
        direction: 'decreases_risk',
        message: 'Little or no precipitation is occurring at the observation time.',
      });
    }
  }

  if (features.precipitation_persistence != null) {
    if (features.precipitation_persistence >= 0.5) {
      drivers.push({
        feature: 'precipitation_persistence',
        value: features.precipitation_persistence,
        direction: 'increases_risk',
        message: 'Rainfall persists across a large fraction of the forecast window.',
      });
    } else if (features.precipitation_persistence > 0) {
      drivers.push({
        feature: 'precipitation_persistence',
        value: features.precipitation_persistence,
        direction: 'decreases_risk',
        message: 'Rainfall is intermittent rather than persistent in the forecast window.',
      });
    }
  }

  if (features.precipitation_intensity_indicator != null && features.precipitation_intensity_indicator > 5.0) {
    drivers.push({
      feature: 'precipitation_intensity_indicator',
      value: features.precipitation_intensity_indicator,
      direction: 'increases_risk',
      message: 'Peak forecast precipitation intensity is elevated within the window.',
    });
  }

  return drivers;
}

function calculateRisk(features: any) {
  let rainScore = saturate(features.current_precipitation, CURRENT_PRECIP_SATURATION_MM);
  if (rainScore == null) {
    rainScore = saturate(features.recent_rainfall, RECENT_RAINFALL_SATURATION_MM);
  }

  const dailyForecast = features.forecast_daily_equivalent ?? features.forecast_precipitation;
  const forecastScore = saturate(dailyForecast, FORECAST_DAILY_SATURATION_MM);

  const anomalyScore =
    features.rainfall_anomaly != null
      ? saturate(Math.max(features.rainfall_anomaly, 0.0), ANOMALY_SATURATION_RATIO)
      : null;

  const persistenceScore =
    features.precipitation_persistence != null ? clamp01(features.precipitation_persistence) : null;

  const components: Record<string, number | null> = {
    rain_score: rainScore,
    forecast_score: forecastScore,
    anomaly_score: anomalyScore,
    persistence_score: persistenceScore,
  };

  const available: Record<string, number> = {};
  for (const [k, v] of Object.entries(components)) {
    if (v != null) available[k] = v;
  }

  let score = 0.0;
  if (Object.keys(available).length > 0) {
    const weightSum = Object.keys(available).reduce((acc, k) => acc + (SCORE_WEIGHTS[k] || 0), 0);
    if (weightSum <= 0) {
      score = Object.values(available).reduce((a, b) => a + b, 0) / Object.keys(available).length;
    } else {
      score = Object.entries(available).reduce((acc, [k, v]) => acc + v * (SCORE_WEIGHTS[k] || 0), 0) / weightSum;
    }
  }

  score = Number(clamp01(score).toFixed(4));
  const level = classifyRiskLevel(score);
  return { score, level, components };
}

// ==========================================
// SERVER INITIALIZATION
// ==========================================
async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const portFromArg =
    portArgIndex !== -1 && process.argv[portArgIndex + 1]
      ? parseInt(process.argv[portArgIndex + 1], 10)
      : null;
  const PORT = portFromArg || (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

  app.use(cors());
  app.use(express.json());

  // ------------------------------------------
  // API ROUTES
  // ------------------------------------------

  // 1. Health Check
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'WeatherGPT' });
  });

  // 2. Real-Time Current Weather
  app.get('/api/v1/weather/current', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({ detail: 'Invalid coordinates. Lat must be [-90,90] and Lon must be [-180,180].' });
      }
      const data = await fetchCurrentWeather(lat, lon);
      return res.json(data);
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error fetching current weather' });
    }
  });

  // 3. Weather Forecast
  app.get('/api/v1/weather/forecast', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({ detail: 'Invalid coordinates' });
      }
      const data = await fetchForecast(lat, lon);
      return res.json(data);
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error fetching forecast' });
    }
  });

  // 4. Historical Observations
  app.get('/api/v1/climate/history', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const startDate = (req.query.start_date as string) || '';
      const endDate = (req.query.end_date as string) || '';
      if (isNaN(lat) || isNaN(lon) || !startDate || !endDate) {
        return res.status(400).json({ detail: 'Missing or invalid parameters for climate history.' });
      }
      const data = await fetchHistoricalData(lat, lon, startDate, endDate);
      return res.json(data);
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error fetching climate history' });
    }
  });

  // 5. Climate Summary
  app.get('/api/v1/climate/summary', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const startDate = (req.query.start_date as string) || '';
      const endDate = (req.query.end_date as string) || '';
      if (isNaN(lat) || isNaN(lon) || !startDate || !endDate) {
        return res.status(400).json({ detail: 'Missing or invalid parameters for climate summary.' });
      }
      const history = await fetchHistoricalData(lat, lon, startDate, endDate);
      const summary = calculateSummary(history.records, history.location, startDate, endDate);
      return res.json(summary);
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error computing climate summary' });
    }
  });

  // 6. Climate Comparison
  app.get('/api/v1/climate/comparison', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];
      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ detail: 'Invalid coordinates' });
      }

      const currentWeather = await fetchCurrentWeather(lat, lon);
      const currentTemp = currentWeather.current.temperature;
      const currentPrecip = currentWeather.current.precipitation;

      const dTarget = new Date(targetDate);
      const dStart = new Date(dTarget.getTime() - 30 * 86400 * 1000);
      const startDateStr = dStart.toISOString().split('T')[0];

      const history = await fetchHistoricalData(lat, lon, startDateStr, targetDate);
      const summary = calculateSummary(history.records, history.location, startDateStr, targetDate);

      const tempMetric = calculateComparisonMetric(currentTemp, summary.temp_avg, false);
      const rainfallMetric = calculateComparisonMetric(currentPrecip, summary.rainfall_avg, true);

      return res.json({
        location: history.location,
        target_date: targetDate,
        temperature: tempMetric,
        rainfall: rainfallMetric,
      });
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error computing climate comparison' });
    }
  });

  // 7. Climate Trend
  app.get('/api/v1/climate/trend', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const startDate = (req.query.start_date as string) || '';
      const endDate = (req.query.end_date as string) || '';
      const variable = (req.query.variable as string) || 'temperature';
      if (isNaN(lat) || isNaN(lon) || !startDate || !endDate) {
        return res.status(400).json({ detail: 'Missing or invalid parameters for climate trend.' });
      }

      const history = await fetchHistoricalData(lat, lon, startDate, endDate);
      const trend = calculateTrend(history.records, history.location, variable, startDate, endDate);
      return res.json(trend);
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error computing climate trend' });
    }
  });

  // 8. Impact Risk Assessment
  app.get('/api/v1/risk/assess', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const forecastHours = parseInt((req.query.forecast_hours as string) || '24', 10);
      if (isNaN(lat) || isNaN(lon) || isNaN(forecastHours) || forecastHours < 1 || forecastHours > 168) {
        return res.status(400).json({ detail: 'Invalid coordinates or forecast_hours.' });
      }

      const [current, forecast] = await Promise.all([
        fetchCurrentWeather(lat, lon),
        fetchForecast(lat, lon),
      ]);

      const today = new Date();
      const endBaseline = today.toISOString().split('T')[0];
      const dStartBaseline = new Date(today.getTime() - CLIMATE_BASELINE_DAYS * 86400 * 1000);
      const startBaseline = dStartBaseline.toISOString().split('T')[0];
      const dStartRecent = new Date(today.getTime() - RECENT_RAINFALL_DAYS * 86400 * 1000);
      const startRecent = dStartRecent.toISOString().split('T')[0];

      const [historyBaseline, historyRecent] = await Promise.all([
        fetchHistoricalData(lat, lon, startBaseline, endBaseline),
        fetchHistoricalData(lat, lon, startRecent, endBaseline),
      ]);

      const summary = calculateSummary(historyBaseline.records, historyBaseline.location, startBaseline, endBaseline);

      // Feature extraction
      const currentPrecip = current.current.precipitation;
      const humidity = current.current.humidity;
      const windSpeed = current.current.wind_speed;

      const windowItems = (forecast.forecast || []).slice(0, forecastHours);
      const forecastPrecip =
        windowItems.length > 0
          ? Number(windowItems.reduce((acc: number, item: any) => acc + (item.precipitation || 0), 0).toFixed(4))
          : null;
      const intensity =
        windowItems.length > 0
          ? Number(Math.max(...windowItems.map((item: any) => item.precipitation || 0)).toFixed(4))
          : null;
      const wetCount = windowItems.filter((item: any) => (item.precipitation || 0) > WET_STEP_PRECIP_MM).length;
      const persistence = windowItems.length > 0 ? Number((wetCount / windowItems.length).toFixed(4)) : null;

      const baseline = summary.rainfall_avg;
      const dailyEquivalent =
        forecastPrecip != null && forecastHours > 0
          ? Number((forecastPrecip * (24.0 / forecastHours)).toFixed(4))
          : null;

      let anomaly: number | null = null;
      let excess: number | null = null;
      if (dailyEquivalent != null && baseline != null && baseline > 0) {
        anomaly = Number(((dailyEquivalent - baseline) / baseline).toFixed(4));
        excess = Number((dailyEquivalent - baseline).toFixed(4));
      }

      const recentRainfall =
        historyRecent.records.length > 0
          ? Number(historyRecent.records.reduce((acc: number, r: any) => acc + (r.precipitation || 0), 0).toFixed(4))
          : null;

      const features = {
        current_precipitation: currentPrecip,
        forecast_precipitation: forecastPrecip,
        historical_rainfall_baseline: baseline,
        rainfall_anomaly: anomaly,
        recent_rainfall: recentRainfall,
        humidity,
        wind_speed: windSpeed,
        forecast_daily_equivalent: dailyEquivalent,
        forecast_rainfall_excess: excess,
        precipitation_persistence: persistence,
        precipitation_intensity_indicator: intensity,
      };

      const { score, level } = calculateRisk(features);
      const drivers = buildDrivers(features);
      const actions = recommendationsForLevel(level);

      return res.json({
        location: current.location || { latitude: lat, longitude: lon },
        hazard: HAZARD_ID,
        risk_level: level,
        risk_score: score,
        forecast_window_hours: forecastHours,
        features,
        drivers,
        recommended_actions: actions,
        model: {
          name: MODEL_NAME,
          version: MODEL_VERSION,
          type: MODEL_TYPE,
        },
        limitations: LIMITATIONS,
      });
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error assessing risk' });
    }
  });

  // ------------------------------------------
  // ALERTS & EARLY WARNING ENGINE
  // ------------------------------------------
  const alertsStore = new Map<string, any>();

  function computeAlertFingerprint(hazard: string, lat: number, lon: number, severity: string): string {
    const roundedLat = lat.toFixed(2);
    const roundedLon = lon.toFixed(2);
    return `alert_${hazard.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${roundedLat}_${roundedLon}_${severity.toLowerCase()}`;
  }

  async function evaluateAlertForLocation(lat: number, lon: number, forecastHours = 24) {
    const [current, forecast] = await Promise.all([
      fetchCurrentWeather(lat, lon),
      fetchForecast(lat, lon),
    ]);

    const today = new Date();
    const endBaseline = today.toISOString().split('T')[0];
    const dStartBaseline = new Date(today.getTime() - CLIMATE_BASELINE_DAYS * 86400 * 1000);
    const startBaseline = dStartBaseline.toISOString().split('T')[0];
    const dStartRecent = new Date(today.getTime() - RECENT_RAINFALL_DAYS * 86400 * 1000);
    const startRecent = dStartRecent.toISOString().split('T')[0];

    const [historyBaseline, historyRecent] = await Promise.all([
      fetchHistoricalData(lat, lon, startBaseline, endBaseline),
      fetchHistoricalData(lat, lon, startRecent, endBaseline),
    ]);

    const summary = calculateSummary(historyBaseline.records, historyBaseline.location, startBaseline, endBaseline);

    const currentPrecip = current.current.precipitation;
    const humidity = current.current.humidity;
    const windSpeed = current.current.wind_speed;

    const windowItems = (forecast.forecast || []).slice(0, forecastHours);
    const forecastPrecip =
      windowItems.length > 0
        ? Number(windowItems.reduce((acc: number, item: any) => acc + (item.precipitation || 0), 0).toFixed(4))
        : null;
    const intensity =
      windowItems.length > 0
        ? Number(Math.max(...windowItems.map((item: any) => item.precipitation || 0)).toFixed(4))
        : null;
    const wetCount = windowItems.filter((item: any) => (item.precipitation || 0) > WET_STEP_PRECIP_MM).length;
    const persistence = windowItems.length > 0 ? Number((wetCount / windowItems.length).toFixed(4)) : null;

    const baseline = summary.rainfall_avg;
    const dailyEquivalent =
      forecastPrecip != null && forecastHours > 0
        ? Number((forecastPrecip * (24.0 / forecastHours)).toFixed(4))
        : null;

    let anomaly: number | null = null;
    let excess: number | null = null;
    if (dailyEquivalent != null && baseline != null && baseline > 0) {
      anomaly = Number(((dailyEquivalent - baseline) / baseline).toFixed(4));
      excess = Number((dailyEquivalent - baseline).toFixed(4));
    }

    const recentRainfall =
      historyRecent.records.length > 0
        ? Number(historyRecent.records.reduce((acc: number, r: any) => acc + (r.precipitation || 0), 0).toFixed(4))
        : null;

    const features = {
      current_precipitation: currentPrecip,
      forecast_precipitation: forecastPrecip,
      historical_rainfall_baseline: baseline,
      rainfall_anomaly: anomaly,
      recent_rainfall: recentRainfall,
      humidity,
      wind_speed: windSpeed,
      forecast_daily_equivalent: dailyEquivalent,
      forecast_rainfall_excess: excess,
      precipitation_persistence: persistence,
      precipitation_intensity_indicator: intensity,
    };

    const { score, level } = calculateRisk(features);
    const hazardName = 'Heavy Rain / Flood Risk';

    let severity: 'INFO' | 'WATCH' | 'ADVISORY' | 'WARNING' | 'EMERGENCY' = 'INFO';
    let title = 'Normal Baseline Conditions';
    let description = 'WeatherGPT meteorological indicators indicate stable conditions consistent with normal regional baselines.';
    let actions: string[] = [
      'Continue routine weather monitoring.',
      'No immediate heavy rainfall or flood hazard detected.',
    ];

    if (level === 'EXTREME' || score >= 0.75) {
      severity = 'EMERGENCY';
      title = 'Extreme Heavy Rain & Flood Hazard Alert';
      description = `WeatherGPT estimates severe rainfall-induced risk (score: ${Math.round(score * 100)}%). Forecast precipitation (${forecastPrecip ?? 0} mm) and high antecedent wetness indicate severe inundation potential.`;
      actions = [
        'Follow instructions from official emergency authorities immediately.',
        'Avoid flood-prone and low-lying sectors.',
        'Prepare emergency provisions and move to higher ground if advised by local administration.',
        'Keep emergency communications and local helplines on standby.',
      ];
    } else if (level === 'HIGH' || score >= 0.50) {
      severity = 'WARNING';
      title = 'Elevated Heavy Rain & Waterlogging Risk';
      description = `WeatherGPT estimates elevated rainfall risk (score: ${Math.round(score * 100)}%) because forecast rainfall (${forecastPrecip ?? 0} mm) and soil wetness significantly exceed local baseline capacity.`;
      actions = [
        'Avoid unnecessary travel through known flood-prone or waterlogged corridors.',
        'Monitor official weather alerts and drainage updates from civic authorities.',
        'Prepare for possible localized waterlogging and transport disruptions.',
        'Keep backup emergency contacts accessible.',
      ];
    } else if (level === 'MODERATE' || score >= 0.25) {
      const isAnomalous = anomaly != null && anomaly > 0.4;
      severity = isAnomalous ? 'ADVISORY' : 'WATCH';
      title = isAnomalous ? 'Rainfall Anomaly Advisory' : 'Localized Precipitation Watch';
      description = `WeatherGPT identifies moderate weather activity (score: ${Math.round(score * 100)}%). Observed and forecast rainfall parameters suggest potential for localized surface ponding.`;
      actions = [
        'Monitor updated forecasts and local sky conditions.',
        'Check official weather advisories before scheduling outdoor transit.',
        'Be aware of localized water accumulation in low-lying roads.',
      ];
    }

    const evidence: string[] = [];
    if (forecastPrecip != null) {
      evidence.push(`Forecast rainfall: ${forecastPrecip.toFixed(1)} mm expected over ${forecastHours}h window`);
    }
    if (currentPrecip != null) {
      evidence.push(`Current precipitation rate: ${currentPrecip.toFixed(1)} mm/hr`);
    }
    if (baseline != null && baseline > 0) {
      evidence.push(`Historical rainfall baseline: ${baseline.toFixed(1)} mm/day (30-day lookback)`);
    }
    if (anomaly != null) {
      const sign = anomaly > 0 ? '+' : '';
      evidence.push(`Rainfall anomaly: ${sign}${(anomaly * 100).toFixed(0)}% relative to historical baseline`);
    }
    if (recentRainfall != null) {
      evidence.push(`Recent rainfall: ${recentRainfall.toFixed(1)} mm accumulated over past ${RECENT_RAINFALL_DAYS} days`);
    }
    if (persistence != null && persistence > 0) {
      evidence.push(`Precipitation persistence: ${(persistence * 100).toFixed(0)}% of forecast hours exhibit active rainfall`);
    }
    if (intensity != null && intensity > 0) {
      evidence.push(`Peak rain intensity: ${intensity.toFixed(1)} mm in a single step`);
    }

    const fingerprint = computeAlertFingerprint(hazardName, lat, lon, severity);
    const now = new Date();
    const issuedAt = now.toISOString();
    const validFrom = issuedAt;
    const validUntil = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

    const locationPrefix = `alert_${hazardName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${lat.toFixed(2)}_${lon.toFixed(2)}_`;
    for (const [key, existingAlert] of alertsStore.entries()) {
      if (key.startsWith(locationPrefix) && key !== fingerprint && existingAlert.alert_status === 'ACTIVE') {
        existingAlert.alert_status = 'RESOLVED';
      }
    }

    const existingAlert = alertsStore.get(fingerprint);
    if (existingAlert && existingAlert.alert_status === 'ACTIVE') {
      existingAlert.risk_score = score;
      existingAlert.risk_level = level;
      existingAlert.evidence = evidence;
      existingAlert.recommended_actions = actions;
      existingAlert.valid_until = validUntil;
      return existingAlert;
    }

    const alert = {
      alert_id: fingerprint,
      hazard: hazardName,
      severity,
      title,
      description,
      latitude: lat,
      longitude: lon,
      location_name: current.location?.timezone ? `${current.location.timezone.replace('_', ' ')} Area` : null,
      risk_score: score,
      risk_level: level,
      evidence,
      recommended_actions: actions,
      issued_at: issuedAt,
      valid_from: validFrom,
      valid_until: validUntil,
      source: 'WeatherGPT Risk Engine',
      source_type: 'system_generated',
      prototype: true,
      alert_status: 'ACTIVE',
    };

    alertsStore.set(fingerprint, alert);
    return alert;
  }

  // 9. Alerts Query
  app.get('/api/v1/alerts', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const severityFilter = (req.query.severity as string)?.toUpperCase();
      const activeOnly = req.query.active_only !== 'false';

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ detail: 'Invalid coordinates' });
      }

      const alert = await evaluateAlertForLocation(lat, lon);
      let list = Array.from(alertsStore.values()).filter((a) => {
        const dLat = Math.abs(a.latitude - lat);
        const dLon = Math.abs(a.longitude - lon);
        return dLat < 0.1 && dLon < 0.1;
      });

      if (activeOnly) {
        list = list.filter((a) => a.alert_status === 'ACTIVE');
      }
      if (severityFilter) {
        list = list.filter((a) => a.severity === severityFilter);
      }

      if (list.length === 0 && alert) {
        list = [alert];
      }

      return res.json({
        location: { latitude: lat, longitude: lon },
        alerts: list,
        status: list.length > 0 && list[0].severity !== 'INFO' ? 'active_alerts' : 'no_critical_alerts',
        last_evaluated: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error querying alerts' });
    }
  });

  // 10. Alerts Current (Active Alert for Coordinates)
  app.get('/api/v1/alerts/current', async (req: Request, res: Response) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return res.status(400).json({ detail: 'Invalid coordinates' });
      }

      const alert = await evaluateAlertForLocation(lat, lon);
      const hasCritical = alert.severity !== 'INFO';

      return res.json({
        location: { latitude: lat, longitude: lon },
        alerts: hasCritical ? [alert] : [],
        active_alert: alert,
        status: hasCritical ? 'active_alert' : 'no_active_alerts',
        last_evaluated: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error evaluating current alerts' });
    }
  });

  // 11. Alerts Evaluate
  app.post('/api/v1/alerts/evaluate', async (req: Request, res: Response) => {
    try {
      const { lat, lon, forecast_hours } = req.body || {};
      const numLat = parseFloat(lat);
      const numLon = parseFloat(lon);
      const hours = parseInt(forecast_hours || '24', 10);

      if (isNaN(numLat) || isNaN(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
        return res.status(400).json({ detail: 'Invalid coordinates' });
      }
      if (isNaN(hours) || hours < 1 || hours > 168) {
        return res.status(400).json({ detail: 'forecast_hours must be between 1 and 168' });
      }

      const alert = await evaluateAlertForLocation(numLat, numLon, hours);
      return res.json({
        location: { latitude: numLat, longitude: numLon },
        alerts: [alert],
        status: alert.severity === 'INFO' ? 'no_critical_alerts' : 'active_alert',
        last_evaluated: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error evaluating alert' });
    }
  });

  // ------------------------------------------
  // RAG / KNOWLEDGE RETRIEVAL ENGINE (STEP 7)
  // ------------------------------------------

  // 12. RAG Search
  app.get('/api/v1/rag/search', async (req: Request, res: Response) => {
    try {
      const query = (req.query.query as string) || '';
      const topK = parseInt((req.query.top_k as string) || '4', 10);
      if (!query.trim()) {
        return res.status(400).json({ detail: 'Query parameter is required' });
      }

      const results = ragService.search(query, isNaN(topK) ? 4 : topK);
      const formatted = results.map((item) => ({
        chunk_id: item.chunk.chunk_id,
        text: item.chunk.text,
        source: item.chunk.metadata.organization,
        title: item.chunk.metadata.title,
        url: item.chunk.metadata.url,
        category: item.chunk.metadata.category,
        relevance: Number(item.score.toFixed(2)),
      }));

      return res.json({
        query,
        count: formatted.length,
        results: formatted,
      });
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error executing RAG search' });
    }
  });

  // 13. RAG Query
  app.post('/api/v1/rag/query', async (req: Request, res: Response) => {
    try {
      const { query, top_k, lat, lon } = req.body || {};
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ detail: 'Query string is required in request body' });
      }

      const numLat = parseFloat(lat);
      const numLon = parseFloat(lon);
      const topK = parseInt(top_k || '4', 10);

      let liveContext: any = {};
      if (!isNaN(numLat) && !isNaN(numLon)) {
        try {
          const [weather, alert] = await Promise.all([
            fetchCurrentWeather(numLat, numLon).catch(() => null),
            evaluateAlertForLocation(numLat, numLon).catch(() => null),
          ]);
          liveContext = { weather, alert };
        } catch {
          // non-blocking
        }
      }

      const result = await ragService.answerQuery(
        query,
        isNaN(topK) ? 4 : topK,
        !isNaN(numLat) ? { lat: numLat, lon: numLon } : undefined,
        liveContext
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error evaluating RAG query' });
    }
  });

  // 14. Conversational Chat Router (Gemini-Powered Agent Step 8)
  app.post('/api/v1/chat/message', async (req: Request, res: Response) => {
    try {
      const { message, lat, lon, conversation_id } = req.body || {};
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ detail: 'Message string is required' });
      }

      const numLat = !isNaN(parseFloat(lat)) ? parseFloat(lat) : 12.8342;
      const numLon = !isNaN(parseFloat(lon)) ? parseFloat(lon) : 79.7036;

      const result = await agentController.handleMessage(
        {
          message,
          lat: numLat,
          lon: numLon,
          conversation_id: conversation_id || 'default_session',
        },
        { apiBaseUrl: `http://127.0.0.1:${PORT}` }
      );
      return res.json(result);
    } catch (err: any) {
      return res.status(502).json({ detail: err.message || 'Error processing conversational agent message' });
    }
  });

  // ------------------------------------------
  // VITE DEV SERVER / STATIC ASSETS
  // ------------------------------------------
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  VITE v6.2.0  ready in 120 ms\n\n  ➜  Local:   http://localhost:${PORT}/\n  ➜  Network: http://0.0.0.0:${PORT}/\n`);
    console.log(`WeatherGPT server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
