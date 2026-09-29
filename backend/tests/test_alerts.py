"""Unit and integration test suite for WeatherGPT Alerts & Early Warning Engine."""

import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.alerts.service import AlertService
from app.services.alerts.severity import AlertSeverity
from app.services.alerts.exceptions import (
    InvalidCoordinatesError,
    InvalidForecastWindowError,
    RiskInputsUnavailableError,
)

def create_mock_risk_result(score=0.15, level="LOW", forecast_precip=2.0, anomaly=0.0, recent=5.0):
    mock = MagicMock()
    mock.risk_score = score
    mock.risk_level = level
    mock.location = MagicMock()
    mock.location.latitude = 12.83
    mock.location.longitude = 79.70
    mock.location.timezone = "Asia/Kolkata"
    mock.features = MagicMock()
    mock.features.forecast_precipitation = forecast_precip
    mock.features.current_precipitation = 0.5
    mock.features.historical_rainfall_baseline = 4.0
    mock.features.rainfall_anomaly = anomaly
    mock.features.recent_rainfall = recent
    mock.features.precipitation_persistence = 0.2
    mock.features.precipitation_intensity_indicator = 1.0
    return mock

@pytest.mark.asyncio
async def test_low_risk_maps_to_info():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(return_value=create_mock_risk_result(0.12, "LOW"))
    service = AlertService(risk_service=mock_risk)

    alert = await service.evaluate_alert(12.83, 79.70)
    assert alert.severity == AlertSeverity.INFO
    assert alert.risk_level == "LOW"
    assert alert.risk_score == 0.12

@pytest.mark.asyncio
async def test_moderate_risk_maps_to_watch_or_advisory():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(return_value=create_mock_risk_result(0.35, "MODERATE", anomaly=0.1))
    service = AlertService(risk_service=mock_risk)

    alert = await service.evaluate_alert(12.83, 79.70)
    assert alert.severity in (AlertSeverity.WATCH, AlertSeverity.ADVISORY)

@pytest.mark.asyncio
async def test_high_risk_maps_to_warning():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(return_value=create_mock_risk_result(0.65, "HIGH", forecast_precip=35.0))
    service = AlertService(risk_service=mock_risk)

    alert = await service.evaluate_alert(12.83, 79.70)
    assert alert.severity == AlertSeverity.WARNING
    assert "35.0 mm" in alert.evidence[0]

@pytest.mark.asyncio
async def test_extreme_risk_maps_to_emergency():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(return_value=create_mock_risk_result(0.88, "EXTREME", forecast_precip=90.0))
    service = AlertService(risk_service=mock_risk)

    alert = await service.evaluate_alert(12.83, 79.70)
    assert alert.severity == AlertSeverity.EMERGENCY

@pytest.mark.asyncio
async def test_alert_contains_actual_risk_score_and_provenance():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(return_value=create_mock_risk_result(0.72, "HIGH"))
    service = AlertService(risk_service=mock_risk)

    alert = await service.evaluate_alert(12.83, 79.70)
    assert alert.risk_score == 0.72
    assert alert.source == "WeatherGPT Risk Engine"
    assert alert.source_type == "system_generated"
    assert alert.prototype is True
    assert len(alert.recommended_actions) > 0
    assert len(alert.evidence) > 0

@pytest.mark.asyncio
async def test_invalid_coordinates_rejected():
    service = AlertService()
    with pytest.raises(InvalidCoordinatesError):
        await service.evaluate_alert(95.0, 79.70)
    with pytest.raises(InvalidCoordinatesError):
        await service.evaluate_alert(12.83, 200.0)

@pytest.mark.asyncio
async def test_invalid_forecast_hours_rejected():
    service = AlertService()
    with pytest.raises(InvalidForecastWindowError):
        await service.evaluate_alert(12.83, 79.70, forecast_hours=0)
    with pytest.raises(InvalidForecastWindowError):
        await service.evaluate_alert(12.83, 79.70, forecast_hours=200)

@pytest.mark.asyncio
async def test_risk_service_failure_handled():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(side_effect=Exception("Upstream weather timeout"))
    service = AlertService(risk_service=mock_risk)

    with pytest.raises(RiskInputsUnavailableError):
        await service.evaluate_alert(12.83, 79.70)

@pytest.mark.asyncio
async def test_alert_deduplication():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(return_value=create_mock_risk_result(0.68, "HIGH"))
    service = AlertService(risk_service=mock_risk)

    alert1 = await service.evaluate_alert(12.834, 79.701)
    alert2 = await service.evaluate_alert(12.832, 79.704)
    # Same rounded location (12.83, 79.70) and severity
    assert alert1.alert_id == alert2.alert_id

@pytest.mark.asyncio
async def test_different_locations_have_separate_alerts():
    mock_risk = MagicMock()
    mock_risk.assess = AsyncMock(return_value=create_mock_risk_result(0.68, "HIGH"))
    service = AlertService(risk_service=mock_risk)

    alert_chennai = await service.evaluate_alert(13.08, 80.27)
    alert_delhi = await service.evaluate_alert(28.61, 77.20)
    assert alert_chennai.alert_id != alert_delhi.alert_id
