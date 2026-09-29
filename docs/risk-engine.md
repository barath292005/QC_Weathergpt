# WeatherGPT Impact-Based Risk Engine

## 1. Architecture

The risk engine is a new domain layered **on top of** the existing weather and climate engines. It does not call Open-Meteo (or any other provider) directly.

```
React RiskPanel
      ↓
GET /api/v1/risk/assess?lat&lon&forecast_hours
      ↓
RiskService
      ↓
WeatherService + ClimateService
      ↓
FeatureEngine
      ↓
HazardRiskModel (TransparentRiskModel v0.1)
      ↓
Risk classification + explainability + recommendations
      ↓
RiskResponse → RiskPanel
```

`HazardRiskModel` is the swap-point for a future `MLFloodRiskModel`. The HTTP contract (`RiskResponse`) and `RiskPanel` are not coupled to the scoring implementation.

## 2. Data flow

1. Validate `lat`, `lon`, and `forecast_hours`.
2. Fetch current weather and forecast via `WeatherService`.
3. Fetch 30-day climate summary, current-vs-baseline comparison, and 7-day history via `ClimateService`.
4. Climate failures are logged and treated as missing optional inputs; they do not abort the assessment.
5. If **both** current weather and forecast fail, the API returns HTTP 503.
6. Features are assembled; missing source values remain `null`.
7. `TransparentRiskModel.predict` returns a score in `[0, 1]` and a level.
8. Drivers and recommended actions are attached and returned.

## 3. Input sources

| Input | Service method | Role |
|---|---|---|
| Current precipitation, humidity, wind | `WeatherService.get_current_weather` | Instantaneous rainfall and atmosphere |
| Forecast precipitation series | `WeatherService.get_forecast` | Windowed rainfall, persistence, intensity |
| Daily rainfall baseline | `ClimateService.get_summary` (30 days) | Historical mm/day |
| Comparison fallback | `ClimateService.get_comparison` | Anomaly if forecast-based anomaly cannot be computed |
| Recent rainfall | `ClimateService.get_history` (7 days) | Antecedent wetness |

## 4. Features

| Feature | Unit | Null when |
|---|---|---|
| `current_precipitation` | mm (provider-reported) | current weather missing |
| `forecast_precipitation` | mm (sum over window) | no forecast steps with precip |
| `historical_rainfall_baseline` | mm/day | climate summary missing or empty |
| `rainfall_anomaly` | dimensionless ratio | baseline missing/zero and no comparison fallback |
| `recent_rainfall` | mm (7-day sum) | history missing |
| `humidity` | % | current weather missing |
| `wind_speed` | km/h | current weather missing |
| `forecast_daily_equivalent` | mm/day | forecast precip missing |
| `forecast_rainfall_excess` | mm/day | baseline or daily equivalent missing |
| `precipitation_persistence` | 0–1 | no forecast precip values |
| `precipitation_intensity_indicator` | mm / step | no forecast precip values |

## 5. Feature calculations

- **current_precipitation**: `WeatherResponse.current.precipitation`.
- **forecast_precipitation**: sum of `ForecastItem.precipitation` for items in `[now − 1h, now + forecast_hours]`. If timestamps do not overlap “now” (tests/mocks), the first item is treated as `t0`.
- **historical_rainfall_baseline**: `ClimateSummaryResponse.rainfall_avg`. Empty summaries (`total_observations == 0`) yield `null`, not `0`.
- **forecast_daily_equivalent**: `forecast_precipitation * (24 / forecast_hours)`.
- **rainfall_anomaly**: `(forecast_daily_equivalent − baseline) / baseline` when `baseline > 0`. Otherwise `comparison.rainfall.percentage_difference / 100` if present.
- **forecast_rainfall_excess**: `forecast_daily_equivalent − baseline`.
- **recent_rainfall**: sum of historical precipitation on records within 7 days of the latest record timestamp.
- **precipitation_persistence**: fraction of window steps with precipitation `> 0.1 mm`.
- **precipitation_intensity_indicator**: max step precipitation in the window.
- **humidity / wind_speed**: copied from current weather.

No scientific constants are presented as validated flood thresholds.

## 6. Risk scoring

**Name:** WeatherGPT Transparent Risk Model  
**Version:** 0.1  
**Type:** `rule_based_prototype`

This is **not** a trained machine-learning model and **not** a scientifically validated flood prediction model.

Component scores (each saturated into `[0, 1]`):

| Component | Mapping |
|---|---|
| `rain_score` | `current_precipitation / 20 mm` (fallback: `recent_rainfall / 100 mm`) |
| `forecast_score` | `forecast_daily_equivalent / 50 mm` |
| `anomaly_score` | `max(rainfall_anomaly, 0) / 2.0` |
| `persistence_score` | `precipitation_persistence` |

Default weights (configurable in `thresholds.py`):

- rain 0.20, forecast 0.35, anomaly 0.25, persistence 0.20

Missing components are dropped and remaining weights are **renormalized**. The composite is clamped to `[0.0, 1.0]`.

Saturation caps and weights are **engineering conveniences** so the prototype produces a bounded score. They are easy to replace and are not calibrated against flood damage or inundation observations.

## 7. Thresholds

Risk levels (initial configurable engineering thresholds for prototype decision support — **not** official IMD, government, or hydrological warning thresholds):

| Level | Score range |
|---|---|
| LOW | `[0.00, 0.25)` |
| MODERATE | `[0.25, 0.50)` |
| HIGH | `[0.50, 0.75)` |
| EXTREME | `[0.75, 1.00]` |

## 8. Explainability

`explainability.py` emits a driver only when the corresponding feature is present and the condition holds, for example:

- Forecast daily equivalent above baseline → “Forecast rainfall is elevated relative to the historical baseline.”
- `rainfall_anomaly > 0` → “Rainfall is above the historical baseline.”
- Recent 7-day rain above `7 × baseline` → “Recent rainfall indicates increased wetness.”

Drivers include `feature`, `value`, `direction` (`increases_risk` / `decreases_risk`), and `message`.

## 9. API

```http
GET /api/v1/risk/assess?lat=12.8342&lon=79.7036&forecast_hours=24
```

- `lat`: −90 to 90  
- `lon`: −180 to 180  
- `forecast_hours`: 1 to 168 (default 24)

Errors: 400 invalid coordinates/window; 503 both weather sources unavailable or provider config; 504/502 mapped from existing weather/climate provider errors when they abort the whole assessment.

## 10. Frontend integration

`App.tsx` passes the same `coords.lat` / `coords.lon` used by `WeatherDashboard` and `ClimatePanel` into `RiskPanel`. Changing location refetches weather, climate, and risk without a full reload.

`RiskPanel` calls `/api/v1/risk/assess` via `VITE_API_BASE_URL` (default `http://localhost:8000`) and the Vite `/api` proxy. Loading, error, and success states are handled. The UI states that this is a **prototype risk assessment — not an official warning**, and that scores are **elevated flood-related risk indicators**, not a statement that a flood will occur.

## 11. Limitations

The current implementation is a prototype decision-support risk assessment. It uses transparent engineering rules rather than a scientifically validated flood prediction model. Production validation requires historical flood-event observations and appropriate hydrological/contextual data.

The system currently has meteorological and climate data. That does **not** automatically mean it can predict actual flooding. Language in the API and UI is therefore:

- “Heavy-rain / flood risk assessment”
- “Elevated flood-related risk indicators”

and **not** “Flood will happen.”

Additional gaps: no terrain, drainage, land-use, or river-gauge inputs; Open-Meteo current precipitation is not a catchment accumulation; other hazards (cyclone, landslide, heat, drought) are not implemented.

## 12. Future ML architecture

Keep:

- `GET /api/v1/risk/assess`
- `RiskResponse`
- `RiskPanel`

Replace scoring by implementing `HazardRiskModel`:

- `calculate_score(features)`
- `predict(features)`
- `explain(features)`

Inject the new class into `RiskService(model=MLFloodRiskModel(...))`. Train only on labelled flood-event observations plus hydrology/exposure features; never report fabricated accuracy.
