# WeatherGPT Geospatial Hazard Map

## 1. Architecture

Step 5 visualizes the **existing** impact-based risk assessment at the shared dashboard location. The map does not calculate risk.

```
Location Engine (lat, lon)
      ↓
GET /api/v1/risk/assess?lat&lon&forecast_hours=24
      ↓
App (shared risk state)
      ├── RiskPanel
      └── GeoSpatialMap / MapPanel
            ↓
      Visual risk representation (marker, popup, visualization radius, legend)
```

The backend geospatial package (`backend/app/services/geospatial/`) remains a placeholder. Step 5 does not add fake spatial endpoints or a second scoring system.

**The current map visualizes the selected location's WeatherGPT risk assessment. It does not represent an observed or predicted physical flood boundary.**

## 2. Map library

- **Leaflet** `1.9.x` with **React Leaflet** `5.x` (compatible with the React 19 + Vite frontend)
- **Tiles:** OpenStreetMap (default) and optional Carto Dark
- No paid tile API key is required for this baseline

## 3. Risk API integration

The map consumes the same Risk API as RiskPanel:

```http
GET /api/v1/risk/assess?lat={lat}&lon={lon}&forecast_hours=24
```

`App.tsx` performs **one** request per location change and passes the response to:

- `RiskPanel` (analytics)
- `MapPanel` / `GeoSpatialMap` (map)

The frontend does not re-implement feature engineering, scoring, or classification.

## 4. Location synchronization

The Location & Coordinates Engine owns `coords` in `App`. Changing location:

1. Refetches weather
2. Refetches climate (existing `ClimatePanel` lat/lon props)
3. Refetches shared risk
4. Recenters the map and moves the marker
5. Updates popup and side-panel risk fields after the new assessment arrives

No page reload is required. The map does **not** recenter while the user pans or zooms unless the selected coordinates change.

While the new assessment is in flight, the map shows **Updating risk map...** and does not present the previous location’s risk as if it belonged to the new point.

## 5. Map layers

Implemented:

| Layer | Type | Source |
|---|---|---|
| OpenStreetMap | Base | OSM raster tiles |
| Carto Dark | Base | Carto OSM-compatible tiles |
| Risk location | Overlay | Selected point + optional visualization radius from Risk API |

Not implemented (no legitimate project data yet):

- Satellite imagery
- Weather radar
- Rainfall raster
- Administrative boundaries
- Flood-prone polygons
- Population exposure

Frontend GeoJSON contract is ready (`EMPTY_SPATIAL_LAYERS` in `frontend/src/types/spatial.ts`):

```json
{
  "type": "FeatureCollection",
  "features": []
}
```

A future backend may expose `GET /api/v1/geospatial/layers`. That endpoint is **not** implemented now and must not return fabricated features.

## 6. Risk visualization

- Marker at the selected latitude/longitude
- Risk **level as text** on the marker (`LOW` / `MODERATE` / `HIGH` / `EXTREME`), plus color and shape in the legend
- Popup: hazard, risk level, risk score (%), forecast window, coordinates
- Dashed **risk visualization radius** (~5 km prototype overlay) only when a current assessment exists
- Legend and detail cards repeat level, score, hazard, forecast, and coordinates

The radius is a **visualization aid**. It is not a flood extent, inundation polygon, or official warning.

## 7. Current limitations

- Point-based visualization only (one selected coordinate)
- No observed flood boundaries, satellite scenes, or radar mosaics
- Radius is not hydrologically derived
- Prototype scoring remains the Risk Engine’s transparent model (see `docs/risk-engine.md`)
- Tile usage follows public OSM/Carto terms; no custom basemap cache

## 8. Future satellite / radar integration

When real sources exist, add them as Leaflet overlays fed by GeoJSON or raster tiles, for example:

- Satellite imagery (configured tile URL / env, never a hard-coded secret)
- Weather radar
- Rainfall layer
- Administrative boundaries
- Flood-prone areas (authoritative datasets)
- Population exposure

Each layer should remain optional, documented, and empty until real data is available.
