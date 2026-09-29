import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Thermometer,
  CloudRain,
  AlertCircle,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react';
import { getApiBaseUrl } from '../utils/api';

interface ClimatePanelProps {
  lat: number;
  lon: number;
}

interface HistoricalObservation {
  timestamp: string;
  temperature: number;
  feels_like?: number | null;
  humidity: number;
  pressure: number;
  precipitation: number;
  wind_speed: number;
  wind_direction: number;
  condition: string;
  data_source: string;
}

interface ClimateSummary {
  temp_avg: number;
  temp_min: number;
  temp_max: number;
  rainfall_avg: number;
  rainfall_total: number;
  humidity_avg: number;
  wind_speed_avg: number;
  total_observations: number;
  period_days: number;
}

interface ComparisonMetric {
  current_value: number;
  historical_average: number;
  difference: number;
  percentage_difference?: number | null;
  anomaly: string;
}

interface ClimateComparison {
  target_date: string;
  temperature: ComparisonMetric;
  rainfall: ComparisonMetric;
}

interface ClimateTrend {
  variable: string;
  observations_count: number;
  period_days: number;
  slope: number;
  direction: string;
}

export const ClimatePanel: React.FC<ClimatePanelProps> = ({ lat, lon }) => {
  // Date Presets Helper
  const getPresetDates = (daysAgo: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - daysAgo);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const [dateRangePreset, setDateRangePreset] = useState<number>(30);
  const [startDate, setStartDate] = useState<string>(getPresetDates(30).start);
  const [endDate, setEndDate] = useState<string>(getPresetDates(30).end);

  const [records, setRecords] = useState<HistoricalObservation[]>([]);
  const [summary, setSummary] = useState<ClimateSummary | null>(null);
  const [comparison, setComparison] = useState<ClimateComparison | null>(null);
  const [trend, setTrend] = useState<ClimateTrend | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClimateData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = getApiBaseUrl();

      const [historyRes, summaryRes, comparisonRes, trendRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/v1/climate/history?lat=${lat}&lon=${lon}&start_date=${startDate}&end_date=${endDate}`),
        fetch(`${apiBaseUrl}/api/v1/climate/summary?lat=${lat}&lon=${lon}&start_date=${startDate}&end_date=${endDate}`),
        fetch(`${apiBaseUrl}/api/v1/climate/comparison?lat=${lat}&lon=${lon}&date=${endDate}`),
        fetch(`${apiBaseUrl}/api/v1/climate/trend?lat=${lat}&lon=${lon}&start_date=${startDate}&end_date=${endDate}&variable=temperature`),
      ]);

      if (!historyRes.ok) throw new Error(`History query failed: HTTP ${historyRes.status}`);
      if (!summaryRes.ok) throw new Error(`Summary query failed: HTTP ${summaryRes.status}`);

      const historyData = await historyRes.json();
      const summaryData = await summaryRes.json();
      const comparisonData = comparisonRes.ok ? await comparisonRes.json() : null;
      const trendData = trendRes.ok ? await trendRes.json() : null;

      setRecords(historyData.records || []);
      setSummary(summaryData);
      setComparison(comparisonData);
      setTrend(trendData);
    } catch (err: any) {
      console.error('Climate data fetch error:', err);
      setError(err.message || 'Unable to retrieve climate analysis data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [lat, lon, startDate, endDate]);

  useEffect(() => {
    fetchClimateData();
  }, [fetchClimateData]);

  const handlePresetChange = (days: number) => {
    setDateRangePreset(days);
    const { start, end } = getPresetDates(days);
    setStartDate(start);
    setEndDate(end);
  };

  const getAnomalyBadge = (metric: ComparisonMetric | undefined) => {
    if (!metric) return null;
    if (metric.anomaly === 'above_average') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/60">
          <TrendingUp className="w-3 h-3 text-rose-400" />
          <span>Above Avg (+{metric.difference.toFixed(1)})</span>
        </span>
      );
    }
    if (metric.anomaly === 'below_average') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
          <TrendingDown className="w-3 h-3 text-blue-400" />
          <span>Below Avg ({metric.difference.toFixed(1)})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
        <Minus className="w-3 h-3 text-emerald-400" />
        <span>Normal Baseline</span>
      </span>
    );
  };

  // Helper SVG Line Chart Generator for Temperature
  const renderTemperatureChart = () => {
    if (!records || records.length === 0) return null;
    const sampleStep = Math.max(1, Math.floor(records.length / 30));
    const sampled = records.filter((_, idx) => idx % sampleStep === 0);

    const temps = sampled.map((r) => r.temperature);
    const minT = Math.min(...temps) - 2;
    const maxT = Math.max(...temps) + 2;
    const range = maxT - minT || 1;

    const width = 500;
    const height = 120;

    const points = sampled.map((r, i) => {
      const x = (i / (sampled.length - 1 || 1)) * width;
      const y = height - ((r.temperature - minT) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return (
      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold flex items-center space-x-1.5">
            <Thermometer className="w-4 h-4 text-amber-400" />
            <span>Historical Temperature Curve</span>
          </span>
          <span className="font-mono text-slate-400 text-[11px]">
            Min: {minT.toFixed(1)}°C | Max: {maxT.toFixed(1)}°C
          </span>
        </div>
        <div className="relative h-28 w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full preserve-3d" preserveAspectRatio="none">
            <defs>
              <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <polygon points={`0,${height} ${points} ${width},${height}`} fill="url(#tempGradient)" />
            <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  };

  // Helper SVG Bar Chart Generator for Rainfall
  const renderRainfallChart = () => {
    if (!records || records.length === 0) return null;
    const sampleStep = Math.max(1, Math.floor(records.length / 30));
    const sampled = records.filter((_, idx) => idx % sampleStep === 0);

    const precips = sampled.map((r) => r.precipitation);
    const maxP = Math.max(...precips, 5.0);

    return (
      <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold flex items-center space-x-1.5">
            <CloudRain className="w-4 h-4 text-cyan-400" />
            <span>Historical Rainfall Histogram</span>
          </span>
          <span className="font-mono text-slate-400 text-[11px]">
            Total: {summary ? summary.rainfall_total.toFixed(1) : '0.0'} mm
          </span>
        </div>
        <div className="h-28 flex items-end justify-between gap-1 pt-2">
          {sampled.map((r, i) => {
            const hPct = Math.min(100, Math.max(4, (r.precipitation / maxP) * 100));
            return (
              <div key={i} className="flex-1 bg-slate-900 rounded-t overflow-hidden flex flex-col justify-end group relative h-full">
                <div
                  style={{ height: `${hPct}%` }}
                  className="bg-cyan-500/80 group-hover:bg-cyan-400 transition-all rounded-t"
                  title={`${r.timestamp}: ${r.precipitation} mm`}
                ></div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-sm space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-950 border border-indigo-500/30 rounded-lg text-indigo-400">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Climate Analysis & Historical Baseline</h3>
            <p className="text-xs text-slate-400">Statistical anomalies, climate trends & historical comparison</p>
          </div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => handlePresetChange(30)}
              className={`px-2.5 py-1 rounded-md transition ${dateRangePreset === 30 ? 'bg-slate-800 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              30 Days
            </button>
            <button
              onClick={() => handlePresetChange(90)}
              className={`px-2.5 py-1 rounded-md transition ${dateRangePreset === 90 ? 'bg-slate-800 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              90 Days
            </button>
            <button
              onClick={() => handlePresetChange(180)}
              className={`px-2.5 py-1 rounded-md transition ${dateRangePreset === 180 ? 'bg-slate-800 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
            >
              6 Months
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 bg-slate-950/50 rounded-lg border border-slate-800/80">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <div className="text-sm font-medium text-slate-200">Loading historical climate analysis...</div>
          <p className="text-xs text-slate-500">Retrieving dataset & executing statistical regression</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-lg space-y-2">
          <div className="flex items-center space-x-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchClimateData}
            className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-rose-100 rounded text-xs transition"
          >
            Retry Climate Query
          </button>
        </div>
      )}

      {/* Empty Data State */}
      {!loading && !error && records.length === 0 && (
        <div className="p-6 bg-slate-950/50 rounded-lg border border-slate-800 text-center text-xs text-slate-400 space-y-1">
          <Calendar className="w-6 h-6 text-slate-500 mx-auto" />
          <p className="font-semibold text-slate-300">No historical observations found</p>
          <p>Try selecting a different date range or location coordinates.</p>
        </div>
      )}

      {/* Climate Analytics Content */}
      {!loading && !error && records.length > 0 && summary && (
        <div className="space-y-5">
          {/* Top Summary & Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Temperature Baseline Comparison */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Temp Anomaly vs Baseline</span>
                {getAnomalyBadge(comparison?.temperature)}
              </div>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-100">
                  {comparison?.temperature.current_value.toFixed(1)} °C
                </span>
                <span className="text-xs text-slate-400">
                  vs {comparison?.temperature.historical_average.toFixed(1)} °C avg
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                Range: <strong className="text-slate-300">{summary.temp_min.toFixed(1)}°C</strong> to{' '}
                <strong className="text-slate-300">{summary.temp_max.toFixed(1)}°C</strong> over {summary.period_days} days
              </div>
            </div>

            {/* Rainfall Baseline Comparison */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Rainfall Anomaly vs Baseline</span>
                {getAnomalyBadge(comparison?.rainfall)}
              </div>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold font-mono text-slate-100">
                  {comparison?.rainfall.current_value.toFixed(1)} mm
                </span>
                <span className="text-xs text-slate-400">
                  vs {comparison?.rainfall.historical_average.toFixed(1)} mm avg
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60">
                Total Cumulative: <strong className="text-cyan-400">{summary.rainfall_total.toFixed(1)} mm</strong>
              </div>
            </div>

            {/* Linear Trend Indicator */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Measured Linear Trend</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-indigo-300 border border-slate-700">
                  OLS REGRESSION
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                {trend?.direction === 'increasing' ? (
                  <TrendingUp className="w-5 h-5 text-rose-400" />
                ) : trend?.direction === 'decreasing' ? (
                  <TrendingDown className="w-5 h-5 text-blue-400" />
                ) : (
                  <Minus className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-lg font-bold font-mono uppercase text-slate-200">
                  {trend?.direction || 'STABLE'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
                Slope: {trend ? (trend.slope > 0 ? `+${trend.slope}` : trend.slope) : '0.00'} °C / day ({trend?.observations_count || 0} obs)
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderTemperatureChart()}
            {renderRainfallChart()}
          </div>

          {/* Footer Metadata */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div className="flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Analyzed Period:</span>
              <strong className="text-slate-300 font-mono">{startDate} to {endDate}</strong>
            </div>
            <div className="flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Climate Data Engine:</span>
              <span className="px-2 py-0.5 bg-slate-800 text-indigo-300 rounded font-mono text-[11px] border border-slate-700">
                Open-Meteo ERA5 Historical Archive
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
