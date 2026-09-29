# WeatherGPT Alerts & Early Warning Engine (Step 6)

## 1. Architecture Overview

The Alerts & Early Warning Engine forms the 6th layer of WeatherGPT's modular disaster intelligence pipeline:

```
Real-Time Weather Engine (Open-Meteo Current & Forecast)
              ↓
Historical Climate Engine (ERA5 Baseline & Comparison)
              ↓
Impact-Based Risk Engine (Transparent Risk Classifier)
              ↓
Alerts & Early Warning Engine (Deduplicated System Alerts)
              ↓
Frontend Presentation & Browser Notification Dispatch
```

The Alert Engine consumes strictly verified, calculated outputs from the Risk Engine (`risk_score`, `risk_level`, `features`, and `drivers`). It never fabricates meteorological numbers or invents warning declarations.

---

## 2. Alert Data Model & Schema

Each WeatherGPT alert adheres to the standardized contract:

| Field | Type | Description |
|---|---|---|
| `alert_id` | string | Deterministic hash/fingerprint for deduplication |
| `hazard` | string | `Heavy Rain / Flood Risk` |
| `severity` | string | `INFO`, `WATCH`, `ADVISORY`, `WARNING`, `EMERGENCY` |
| `title` | string | Headline of the early warning |
| `description` | string | Grounded narrative explanation of why alert was triggered |
| `latitude` | number | Target coordinate |
| `longitude` | number | Target coordinate |
| `location_name` | string | Regional or timezone identifier |
| `risk_score` | number | Composite score in [0.0 - 1.0] from Risk Engine |
| `risk_level` | string | Categorical risk (`LOW`, `MODERATE`, `HIGH`, `EXTREME`) |
| `evidence` | list[str] | Verifiable meteorological and climate metrics |
| `recommended_actions` | list[str] | Actionable preparedness recommendations |
| `issued_at` | ISO 8601 | Evaluation timestamp |
| `valid_from` | ISO 8601 | Start of validity period |
| `valid_until` | ISO 8601 | Expiry timestamp (typically 24 hours) |
| `source` | string | `WeatherGPT Risk Engine` |
| `source_type` | string | `system_generated` |
| `prototype` | boolean | `true` |
| `alert_status` | string | `ACTIVE`, `EXPIRED`, `RESOLVED` |

---

## 3. Severity Levels & Threshold Mappings

WeatherGPT system alert severities are distinct from official government warning codes (e.g. IMD colour warnings):

* **INFO** (Risk < 0.25): Normal baseline conditions. Routine monitoring recommended.
* **WATCH** (Risk 0.25 - 0.49): Moderate rainfall or soil saturation observed. Localized monitoring advised.
* **ADVISORY** (Risk 0.25 - 0.49 with Anomaly > 40%): Significant deviation from historical baseline requiring civic vigilance.
* **WARNING** (Risk 0.50 - 0.74): Elevated heavy rain or waterlogging risk requiring precautionary avoidance of flood-prone roads.
* **EMERGENCY** (Risk ≥ 0.75): Torrential downpour or critical inundation hazard requiring immediate adherence to civic directives.

---

## 4. Alert Generation & Evidence Synthesis

Alerts are grounded strictly in the Risk Engine's feature vector:
* `forecast_precipitation`: Sum of hourly rainfall across the forecast window (mm).
* `historical_rainfall_baseline`: 30-day historical mean precipitation (mm/day).
* `rainfall_anomaly`: Relative percentage deviation from normal baseline.
* `recent_rainfall`: 7-day cumulative precipitation from reanalysis records (mm).
* `precipitation_persistence`: Proportion of forecast intervals experiencing active rainfall.

---

## 5. Deduplication & Lifecycle

To prevent alert flooding and database thrashing:
* **Fingerprint**: Deterministic identifier derived from `hazard + round(lat, 2) + round(lon, 2) + severity`.
* **State Management**: If an active alert exists for a location with an identical fingerprint, it is refreshed rather than duplicated.
* **Resolution**: When a location's risk level transitions (e.g. from HIGH to LOW), the previous `ACTIVE` alert is marked as `RESOLVED`.

---

## 6. Multi-Channel Notification Abstraction & Browser Push

* **NotificationProvider**: Abstract interface enabling extensibility for Email (SMTP/SES) and SMS (Twilio/CDAC).
* **Browser Push (Client)**: Leverages the HTML5 Web Notification API.
  * Requests explicit user permission.
  * Filters alerts to notify only on high-severity events (`WARNING`, `EMERGENCY`).
  * Deduplicates notifications using `alert_id` in memory to prevent repeated desktop notifications.

---

## 7. Polling & Auto-Refresh

* The frontend `AlertPanel` safely polls `GET /api/v1/alerts/current` every 60 seconds (configurable via `VITE_ALERT_POLL_INTERVAL_MS`).
* Includes a manual refresh button for instant validation upon coordinate selection.

---

## 8. API Endpoints

### `GET /api/v1/alerts`
* Parameters: `lat`, `lon`, optional `severity`, optional `active_only`.
* Description: Returns collection of system-generated alerts matching criteria.

### `GET /api/v1/alerts/current`
* Parameters: `lat`, `lon`.
* Description: Retrieves current active alert status and active alert record.

### `POST /api/v1/alerts/evaluate`
* Body: `{"lat": number, "lon": number, "forecast_hours": number}`
* Description: Executes full risk assessment pipeline, evaluates rules, updates deduplication store, and returns generated alert.

---

## 9. Official Warning Distinction & Provenance

> **CRITICAL DISCLAIMER:**  
> The current alert engine is a transparent prototype that converts WeatherGPT risk assessments into system-generated alerts. **It is NOT an official government warning service.** Official weather and disaster warnings in India are exclusively issued by the India Meteorological Department (IMD) and National Disaster Management Authority (NDMA).

Every alert and UI view clearly states:
- `source: WeatherGPT Risk Engine`
- `source_type: system_generated`
- `prototype: true`

---

## 10. Known Limitations

* **Hydrological Models**: Soil absorption and river basin drainage models are based on ERA5 reanalysis and Open-Meteo forecasts rather than physical river-gauge networks.
* **Civic Topography**: Urban micro-drainage features (culverts, stormwater blockages) are estimated via statistical wetness rather than LIDAR elevation maps.
