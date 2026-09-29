import React from 'react';
import { Map, ShieldAlert, Info } from 'lucide-react';
import { GeoSpatialMap } from './GeoSpatialMap';
import type { RiskAssessment } from '../types/risk';
import { formatCoordinates, formatHazardLabel, formatRiskScorePercent, isRiskLevel } from '../types/risk';
import type { WeatherGPTAlert } from '../types/alert';
import type { GeoJsonFeatureCollection } from '../types/spatial';

interface MapPanelProps {
  lat: number;
  lon: number;
  risk: RiskAssessment | null;
  loading: boolean;
  error: string | null;
  spatialLayers?: GeoJsonFeatureCollection;
  alert?: WeatherGPTAlert | null;
}

const legendItems = [
  { level: 'LOW', className: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50', icon: '●' },
  { level: 'MODERATE', className: 'bg-amber-950/60 text-amber-300 border-amber-800/50', icon: '▲' },
  { level: 'HIGH', className: 'bg-orange-950/60 text-orange-300 border-orange-800/50', icon: '■' },
  { level: 'EXTREME', className: 'bg-rose-950/60 text-rose-300 border-rose-800/50', icon: '✦' },
] as const;

export const MapPanel: React.FC<MapPanelProps> = ({ lat, lon, risk, loading, error, spatialLayers, alert }) => {
  const showRisk = Boolean(risk) && !loading && !error;
  const level = showRisk && isRiskLevel(risk?.risk_level) ? risk.risk_level : null;
  const scorePct = showRisk ? formatRiskScorePercent(risk?.risk_score) : null;
  const legendMatch = legendItems.find((item) => item.level === level);

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Map className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="text-base font-semibold text-slate-100">Geospatial Hazard Map</h3>
            <p className="text-xs text-slate-400">Selected-location risk visualization from the Risk API</p>
          </div>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-md bg-cyan-950/50 text-cyan-300 font-mono border border-cyan-800/40">
          Prototype
        </span>
      </div>

      <GeoSpatialMap
        lat={lat}
        lon={lon}
        risk={risk}
        loading={loading}
        error={error}
        spatialLayers={spatialLayers}
        alert={alert}
      />

      <div>
        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-2">Risk Level</h4>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Risk level legend">
          {legendItems.map((item) => (
            <li
              key={item.level}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border flex items-center justify-center space-x-1.5 ${item.className}`}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.level}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
          <div className="text-[11px] text-slate-400">Selected Location</div>
          <div className="text-sm font-mono text-cyan-300 mt-0.5">{formatCoordinates(lat, lon)}</div>
        </div>
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
          <div className="text-[11px] text-slate-400">Hazard</div>
          <div className="text-sm font-semibold text-slate-200 mt-0.5">
            {showRisk ? formatHazardLabel(risk!.hazard) : loading ? 'Updating...' : 'Risk data unavailable'}
          </div>
        </div>
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1">
            <ShieldAlert className="w-3 h-3" />
            <span>Risk</span>
          </div>
          <div className="text-sm font-semibold text-slate-200 mt-0.5 flex items-center space-x-2">
            {level && legendMatch ? (
              <>
                <span aria-hidden="true">{legendMatch.icon}</span>
                <span>{level}</span>
              </>
            ) : (
              <span>{loading ? 'Updating...' : 'Risk data unavailable'}</span>
            )}
          </div>
        </div>
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
          <div className="text-[11px] text-slate-400">Risk Score</div>
          <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
            {scorePct ?? (loading ? 'Updating...' : '—')}
          </div>
        </div>
        <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-800/60 sm:col-span-2">
          <div className="text-[11px] text-slate-400">Forecast</div>
          <div className="text-sm font-mono text-slate-200 mt-0.5">
            {showRisk ? `${risk!.forecast_window_hours} hours` : loading ? 'Updating...' : '—'}
          </div>
        </div>
      </div>

      <div className="flex items-start space-x-2 text-[11px] text-slate-500">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500" />
        <p>
          Risk visualization is a prototype decision-support layer and does not represent an official flood
          boundary or warning. The dashed circle is a risk visualization radius only.
        </p>
      </div>
    </div>
  );
};
