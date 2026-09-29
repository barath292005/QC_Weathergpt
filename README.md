# WeatherGPT - AI-Powered Impact-Based Weather Intelligence Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org)

WeatherGPT is an enterprise-grade AI-powered impact-based weather intelligence platform designed for Smart India Hackathon (SIH). It integrates real-time meteorological data engines, Provider Abstraction layers, Numerical Weather Prediction (NWP/GFS/WRF) ingestion, ML-driven hazard prediction models, Retrieval-Augmented Generation (RAG) over disaster protocols, and an explainable AI conversational assistant to deliver actionable risk insights.

---

## 🌤️ Weather Service Engine Architecture

The real-time weather service is built around a pluggable **Provider Abstraction** layer located in `backend/app/services/weather/`.

```
backend/app/services/weather/
├── __init__.py          # Domain package interface & exports
├── provider.py          # BaseWeatherProvider abstract base class
├── service.py           # WeatherService main orchestration & caching logic
├── schemas.py           # Pydantic normalized schemas (Location, CurrentWeather, ForecastItem)
├── exceptions.py        # Weather domain exception hierarchy
├── cache.py             # Thread-safe in-memory TTL cache (5 min TTL)
└── providers/
    ├── __init__.py
    ├── openmeteo.py     # Open-Meteo API provider (Active Default, no API key required)
    └── openweather.py    # OpenWeatherMap API provider (Requires OPENWEATHER_API_KEY)
```

### 🔌 Selected Weather Providers

1. **Open-Meteo API (`openmeteo`) — Default Active Provider**
   - **API Key:** Not required (Free for non-commercial & dev use)
   - **Features:** High-precision real-time meteorological telemetry, WMO weather codes, surface pressure, apparent temperature, wind vectors, and hourly forecasts.
   
2. **OpenWeatherMap API (`openweather`) — Pluggable Secondary Provider**
   - **API Key:** Required (`OPENWEATHER_API_KEY` in `backend/.env`)
   - **Features:** Current weather & 5-day / 3-hour forecasts normalized into WeatherGPT schema.

---

## ⚙️ Environment Variable Setup

Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

### Environment Configuration Options (`backend/.env`)

```env
# Weather Engine Provider Settings
WEATHER_PROVIDER=openmeteo              # Provider options: 'openmeteo' or 'openweather'
OPENWEATHER_API_KEY=your_api_key_here    # Required ONLY if WEATHER_PROVIDER=openweather
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1
WEATHER_CACHE_TTL_SECONDS=300            # Cache TTL in seconds
```

---

## 🔌 Weather API Endpoints & Verification

### 1. Real-Time Current Weather

```http
GET /api/v1/weather/current?lat=12.8342&lon=79.7036
```

#### Query Parameters:
- `lat` (float, required): Latitude coordinate between `-90.0` and `90.0`.
- `lon` (float, required): Longitude coordinate between `-180.0` and `180.0`.

#### Example Response (`HTTP 200 OK`):

```json
{
  "location": {
    "latitude": 12.8342,
    "longitude": 79.7036,
    "city": null,
    "country": null,
    "timezone": "Asia/Kolkata"
  },
  "current": {
    "latitude": 12.8342,
    "longitude": 79.7036,
    "temperature": 28.1,
    "feels_like": 33.4,
    "humidity": 82.0,
    "pressure": 1000.0,
    "wind_speed": 9.0,
    "wind_direction": 154.0,
    "precipitation": 0.0,
    "condition": "Mainly Clear",
    "visibility": null,
    "observation_time": "2026-09-28T14:15",
    "data_source": "Open-Meteo API"
  }
}
```

---

### 2. Weather Forecast

```http
GET /api/v1/weather/forecast?lat=12.8342&lon=79.7036
```

#### Example Response (`HTTP 200 OK`):

```json
{
  "location": {
    "latitude": 12.8342,
    "longitude": 79.7036,
    "timezone": "Asia/Kolkata"
  },
  "forecast": [
    {
      "timestamp": "2026-09-28T15:00",
      "temperature": 28.5,
      "feels_like": 33.8,
      "precipitation_probability": 10.0,
      "precipitation": 0.0,
      "humidity": 80.0,
      "wind_speed": 8.5,
      "condition": "Mainly Clear"
    }
  ]
}
```

---

### 3. Error Responses

- **Invalid Coordinates (`HTTP 400 Bad Request`)**:
  ```json
  {
    "detail": "Invalid latitude 95.0. Latitude must be between -90 and 90 degrees."
  }
  ```
- **Missing API Key (`HTTP 503 Service Unavailable`)**:
  ```json
  {
    "detail": "OpenWeather API key is not configured. Please set OPENWEATHER_API_KEY in backend/.env"
  }
  ```
- **Provider Timeout (`HTTP 504 Gateway Timeout`)**:
  ```json
  {
    "detail": "Open-Meteo API request timed out after 8.0 seconds"
  }
  ```

---

## 🧪 Testing Instructions

Run automated pytest unit test suite (with all external API calls mocked):

```bash
cd backend
.\venv\Scripts\pytest
```

#### Test Suite Highlights:
- `test_successful_normalization`: Validates response transformation to WeatherGPT schema.
- `test_invalid_coordinates`: Asserts HTTP 400 error rejection for out-of-bound lat/lon.
- `test_provider_failure_handling`: Asserts HTTP 502 error mapping on upstream provider failures.
- `test_provider_timeout_handling`: Asserts HTTP 504 error mapping on provider timeout.
- `test_missing_configuration`: Asserts HTTP 503 configuration error when API key is missing.
- `test_current_weather_endpoint_success`: Validates `GET /api/v1/weather/current`.
- `test_forecast_endpoint_success`: Validates `GET /api/v1/weather/forecast`.

---

## 🚀 How to Run WeatherGPT

### 1. Start FastAPI Backend

```bash
cd backend
.\venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Start React Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser. Select preset locations or input custom latitude and longitude coordinates to query live weather metrics.

Geospatial mapping (Step 5) is documented in [`docs/geospatial-engine.md`](docs/geospatial-engine.md). The map visualizes the selected location’s Risk API assessment; it is not an official flood boundary.

---

## 🤖 Gemini-Powered Conversational AI (Step 8)

WeatherGPT uses meteorological data and its impact-based risk engine to estimate hazard risk, while Google Gemini generates grounded conversational explanations.

### Environment Setup for Gemini
Set the following variables in `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.8-flash
```

For complete architectural details, tool registries, intent classification, and deterministic fallback behavior, see [`docs/conversational-ai.md`](docs/conversational-ai.md).

