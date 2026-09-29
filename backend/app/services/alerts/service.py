"""Main Alert & Early Warning Domain Service.

Consumes real outputs from RiskService, evaluates rules, performs deduplication,
and manages lifecycle without inventing weather numbers or official warnings.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
import hashlib

from app.services.alerts.schemas import WeatherGPTAlert, AlertResponse, AlertLocation
from app.services.alerts.severity import AlertSeverity
from app.services.alerts.rules import HAZARD_NAME, determine_severity_and_content
from app.services.alerts.exceptions import (
    InvalidCoordinatesError,
    InvalidForecastWindowError,
    RiskInputsUnavailableError,
)

class AlertService:
    def __init__(self, risk_service=None):
        self.risk_service = risk_service
        self._alerts_store: Dict[str, WeatherGPTAlert] = {}

    def _validate_coordinates(self, lat: float, lon: float) -> None:
        if not (-90.0 <= lat <= 90.0):
            raise InvalidCoordinatesError(f"Invalid latitude {lat}. Latitude must be between -90 and 90.")
        if not (-180.0 <= lon <= 180.0):
            raise InvalidCoordinatesError(f"Invalid longitude {lon}. Longitude must be between -180 and 180.")

    def _compute_fingerprint(self, hazard: str, lat: float, lon: float, severity: AlertSeverity) -> str:
        rounded_lat = round(lat, 2)
        rounded_lon = round(lon, 2)
        raw = f"{hazard.lower()}_{rounded_lat}_{rounded_lon}_{severity.value.lower()}"
        return f"alert_{hashlib.sha256(raw.encode()).hexdigest()[:16]}"

    async def evaluate_alert(self, lat: float, lon: float, forecast_hours: int = 24, db=None) -> WeatherGPTAlert:
        self._validate_coordinates(lat, lon)
        if forecast_hours < 1 or forecast_hours > 168:
            raise InvalidForecastWindowError("forecast_hours must be between 1 and 168.")

        if not self.risk_service:
            from app.services.risk.service import RiskService
            self.risk_service = RiskService()

        try:
            risk_res = await self.risk_service.assess(lat, lon, forecast_hours, db)
        except Exception as e:
            raise RiskInputsUnavailableError(f"Risk assessment failed: {str(e)}") from e

        score = risk_res.risk_score
        level = risk_res.risk_level
        features = risk_res.features

        forecast_precip = features.forecast_precipitation
        current_precip = features.current_precipitation
        baseline = features.historical_rainfall_baseline
        anomaly = features.rainfall_anomaly
        recent = features.recent_rainfall

        severity, title, desc, actions = determine_severity_and_content(
            score=score,
            level=level,
            rainfall_anomaly=anomaly,
            forecast_precip=forecast_precip,
        )

        evidence: List[str] = []
        if forecast_precip is not None:
            evidence.append(f"Forecast rainfall: {forecast_precip:.1f} mm expected over {forecast_hours}h window")
        if current_precip is not None:
            evidence.append(f"Current precipitation rate: {current_precip:.1f} mm/hr")
        if baseline is not None and baseline > 0:
            evidence.append(f"Historical rainfall baseline: {baseline:.1f} mm/day (30-day lookback)")
        if anomaly is not None:
            sign = "+" if anomaly > 0 else ""
            evidence.append(f"Rainfall anomaly: {sign}{int(anomaly * 100)}% relative to historical baseline")
        if recent is not None:
            evidence.append(f"Recent rainfall: {recent:.1f} mm accumulated over past 7 days")

        fingerprint = self._compute_fingerprint(HAZARD_NAME, lat, lon, severity)
        now = datetime.now(timezone.utc)
        issued_at = now.isoformat()
        valid_until = (now + timedelta(hours=24)).isoformat()

        # Deduplication check
        existing = self._alerts_store.get(fingerprint)
        if existing and existing.alert_status == "ACTIVE":
            existing.risk_score = score
            existing.risk_level = level
            existing.evidence = evidence
            existing.recommended_actions = actions
            existing.valid_until = valid_until
            return existing

        alert = WeatherGPTAlert(
            alert_id=fingerprint,
            hazard=HAZARD_NAME,
            severity=severity,
            title=title,
            description=desc,
            latitude=lat,
            longitude=lon,
            location_name=risk_res.location.timezone if hasattr(risk_res.location, "timezone") else None,
            risk_score=score,
            risk_level=level,
            evidence=evidence,
            recommended_actions=actions,
            issued_at=issued_at,
            valid_from=issued_at,
            valid_until=valid_until,
            source="WeatherGPT Risk Engine",
            source_type="system_generated",
            prototype=True,
            alert_status="ACTIVE",
        )

        self._alerts_store[fingerprint] = alert
        return alert

    async def get_current_alerts(self, lat: float, lon: float, db=None) -> AlertResponse:
        self._validate_coordinates(lat, lon)
        alert = await self.evaluate_alert(lat, lon, 24, db)
        alerts_list = [alert] if alert.severity != AlertSeverity.INFO else []
        return AlertResponse(
            location=AlertLocation(latitude=lat, longitude=lon),
            alerts=alerts_list,
            status="active_alerts" if alerts_list else "no_active_alerts",
            last_evaluated=datetime.now(timezone.utc).isoformat(),
        )
