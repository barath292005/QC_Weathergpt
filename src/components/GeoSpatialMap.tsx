import React, { useEffect, useMemo, useRef } from 'react';
import {
  Circle,
  GeoJSON,
  LayerGroup,
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { divIcon } from 'leaflet';
import type { GeoJsonObject } from 'geojson';
import type { RiskAssessment, RiskLevel } from '../types/risk';
import { formatCoordinates, formatHazardLabel, formatRiskScorePercent, isRiskLevel } from '../types/risk';
import type { WeatherGPTAlert } from '../types/alert';
import { EMPTY_SPATIAL_LAYERS, hasSpatialFeatures } from '../types/spatial';
import type { GeoJsonFeatureCollection } from '../types/spatial';

/** Prototype visual aid only — not a physical flood or hazard boundary. */
export const RISK_VISUALIZATION_RADIUS_METERS = 5000;
const DEFAULT_ZOOM = 11;

const LEVEL_MARKER: Record<RiskLevel, { fill: string; border: string; label: string }> = {
  LOW: { fill: '#064e3b', border: '#34d399', label: 'LOW' },
  MODERATE: { fill: '#78350f', border: '#fbbf24', label: 'MODERATE' },
  HIGH: { fill: '#7c2d12', border: '#fb923c', label: 'HIGH' },
  EXTREME: { fill: '#881337', border: '#fb7185', label: 'EXTREME' },
};

export interface GeoSpatialMapProps {
  lat: number;
  lon: number;
  risk: RiskAssessment | null;
  loading: boolean;
  error: string | null;
  spatialLayers?: GeoJsonFeatureCollection;
  alert?: WeatherGPTAlert | null;
}

const RecenterOnLocation: React.FC<{ lat: number; lon: number }> = ({ lat, lon }) => {
  const map = useMap();
  const previous = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const changed =
      previous.current === null || previous.current.lat !== lat || previous.current.lon !== lon;
    if (changed) {
      map.setView([lat, lon], DEFAULT_ZOOM, { animate: true });
      previous.current = { lat, lon };
    }
  }, [lat, lon, map]);

  return null;
};

function buildMarkerIcon(riskLevel: RiskLevel | null, loading: boolean) {
  const styles = riskLevel ? LEVEL_MARKER[riskLevel] : { fill: '#0e7490', border: '#22d3ee', label: 'LOCATION' };
  const text = loading ? 'UPDATING' : styles.label;
  return divIcon({
    className: 'weathergpt-risk-marker',
    iconSize: [96, 48],
    iconAnchor: [48, 40],
    popupAnchor: [0, -36],
    html: `<div class="weathergpt-risk-marker-inner" role="img" aria-label="Selected location, ${text}">
      <span class="weathergpt-risk-marker-pin" style="background:${styles.fill};border-color:${styles.border}"></span>
      <span class="weathergpt-risk-marker-label" style="background:${styles.fill};border-color:${styles.border};color:${styles.border}">${text}</span>
    </div>`,
  });
}

function buildAlertMarkerIcon(alert: WeatherGPTAlert) {
  const isEmergency = alert.severity === 'EMERGENCY';
  const isWarning = alert.severity === 'WARNING';
  const isAdvisory = alert.severity === 'ADVISORY' || alert.severity === 'WATCH';
  const color = isEmergency ? '#f43f5e' : isWarning ? '#f97316' : isAdvisory ? '#f59e0b' : '#10b981';
  return divIcon({
    className: 'weathergpt-alert-marker',
    iconSize: [110, 48],
    iconAnchor: [55, 46],
    popupAnchor: [0, -40],
    html: `<div class="weathergpt-risk-marker-inner cursor-pointer" role="img" aria-label="Alert: ${alert.severity}">
      <span class="weathergpt-risk-marker-pin animate-pulse" style="background:${color};border-color:#ffffff;box-shadow:0 0 10px ${color}"></span>
      <span class="weathergpt-risk-marker-label font-bold tracking-wide" style="background:#020617;border-color:${color};color:${color}">⚠ [${alert.severity}]</span>
    </div>`,
  });
}

export const GeoSpatialMap: React.FC<GeoSpatialMapProps> = ({
  lat,
  lon,
  risk,
  loading,
  error,
  spatialLayers = EMPTY_SPATIAL_LAYERS,
  alert,
}) => {
  const showRiskOverlay = Boolean(risk) && !loading && !error;
  const riskLevel = showRiskOverlay && isRiskLevel(risk?.risk_level) ? risk.risk_level : null;
  const markerIcon = useMemo(() => buildMarkerIcon(riskLevel, loading), [riskLevel, loading]);
  const alertIcon = useMemo(() => (alert ? buildAlertMarkerIcon(alert) : null), [alert]);
  const scorePct = showRiskOverlay ? formatRiskScorePercent(risk?.risk_score) : null;
  const circleColor = riskLevel ? LEVEL_MARKER[riskLevel].border : '#22d3ee';
  const showFutureLayers = hasSpatialFeatures(spatialLayers);

  return (
    <div
      className="relative w-full h-[360px] sm:h-[440px] min-h-[320px] rounded-lg overflow-hidden border border-slate-800 bg-slate-950"
      role="region"
      aria-label="Interactive geospatial hazard map"
    >
      <MapContainer
        center={[lat, lon]}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%', minHeight: 320 }}
        attributionControl
      >
        <RecenterOnLocation lat={lat} lon={lon} />

        {/* Base tile layer — OpenStreetMap only, no API key required */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          subdomains={['a', 'b', 'c']}
        />

        {/* Overlay controls — risk location and optional GeoJSON */}
        <LayersControl position="topright">
          <LayersControl.Overlay checked name="Risk location">
            <LayerGroup>
              {showRiskOverlay && (
                <Circle
                  center={[lat, lon]}
                  radius={RISK_VISUALIZATION_RADIUS_METERS}
                  pathOptions={{
                    color: circleColor,
                    weight: 2,
                    dashArray: '8 6',
                    fillColor: circleColor,
                    fillOpacity: 0.12,
                  }}
                >
                  <Tooltip sticky>
                    Risk visualization radius — prototype overlay, not a flood boundary
                  </Tooltip>
                </Circle>
              )}
              <Marker position={[lat, lon]} icon={markerIcon} alt="Selected location risk marker">
                <Popup>
                  <div className="weathergpt-map-popup text-xs space-y-1.5">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Hazard</div>
                      <div className="font-semibold">
                        {showRiskOverlay ? formatHazardLabel(risk!.hazard) : 'Risk data unavailable'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Risk</div>
                      <div className="font-semibold">{riskLevel ?? 'Risk data unavailable'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Risk Score</div>
                      <div className="font-mono font-semibold">{scorePct ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Forecast Window</div>
                      <div className="font-mono">
                        {showRiskOverlay ? `${risk!.forecast_window_hours} hours` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">Coordinates</div>
                      <div className="font-mono">{formatCoordinates(lat, lon)}</div>
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Early Warning Alert Marker */}
              {alert && alertIcon && (
                <Marker position={[lat, lon]} icon={alertIcon} alt={`WeatherGPT Alert: ${alert.severity}`}>
                  <Popup>
                    <div className="weathergpt-map-popup text-xs space-y-2 max-w-[240px]">
                      <div className="flex items-center justify-between border-b border-slate-700/60 pb-1">
                        <span className="font-bold text-amber-400">WeatherGPT Alert</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                          {alert.severity}
                        </span>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Hazard</div>
                        <div className="font-semibold text-slate-100">{alert.hazard}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Risk Score</div>
                        <div className="font-mono font-bold text-slate-100">
                          {Math.round(alert.risk_score * 100)}% ({alert.risk_level})
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-slate-400">Assessment</div>
                        <p className="text-[11px] text-slate-300 leading-snug">{alert.description}</p>
                      </div>
                      {alert.recommended_actions?.[0] && (
                        <div>
                          <div className="text-[10px] uppercase text-amber-300">Action</div>
                          <p className="text-[11px] text-slate-300 italic">{alert.recommended_actions[0]}</p>
                        </div>
                      )}
                      <div className="pt-1 border-t border-slate-800 text-[9px] text-slate-500 font-mono">
                        Issued: {new Date(alert.issued_at).toLocaleTimeString()} • {alert.source}
                      </div>
                      <div className="text-[9px] text-amber-400/80 italic">
                        ⚠ AI-generated risk assessment, not an official government warning.
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}
            </LayerGroup>
          </LayersControl.Overlay>
          {showFutureLayers ? (
            <LayersControl.Overlay name="Spatial layers (GeoJSON)">
              <GeoJSON data={spatialLayers as GeoJsonObject} />
            </LayersControl.Overlay>
          ) : null}
        </LayersControl>
      </MapContainer>

      {loading && (
        <div
          className="absolute inset-0 z-[400] flex items-center justify-center bg-slate-950/70 pointer-events-none"
          aria-live="polite"
        >
          <div className="px-4 py-2 rounded-lg border border-cyan-800/50 bg-slate-900/90 text-sm text-cyan-200">
            Updating risk map...
          </div>
        </div>
      )}

      {!loading && error && (
        <div
          className="absolute top-3 left-3 z-[400] max-w-[min(100%-1.5rem,18rem)] px-3 py-2 rounded-lg border border-rose-800/60 bg-rose-950/85 text-xs text-rose-200"
          role="status"
          aria-live="polite"
        >
          Risk data unavailable
        </div>
      )}
    </div>
  );
};
