"""Configurable alert rules and evidence generation."""

from typing import List, Tuple
from app.services.alerts.severity import AlertSeverity

HAZARD_NAME = "Heavy Rain / Flood Risk"

def determine_severity_and_content(
    score: float,
    level: str,
    rainfall_anomaly: float | None = None,
    forecast_precip: float | None = None,
) -> Tuple[AlertSeverity, str, str, List[str]]:
    """Determine system alert severity, title, explanation, and recommendations based on real risk outputs."""
    if level == "EXTREME" or score >= 0.75:
        severity = AlertSeverity.EMERGENCY
        title = "Extreme Heavy Rain & Flood Hazard Alert"
        desc = (
            f"WeatherGPT estimates severe rainfall-induced risk (score: {int(score * 100)}%). "
            f"Forecast precipitation ({forecast_precip or 0.0} mm) and high antecedent wetness indicate severe inundation potential."
        )
        actions = [
            "Follow instructions from official emergency authorities immediately.",
            "Avoid flood-prone and low-lying sectors.",
            "Prepare emergency provisions and move to higher ground if advised by local administration.",
            "Keep emergency communications and local helplines on standby.",
        ]
    elif level == "HIGH" or score >= 0.50:
        severity = AlertSeverity.WARNING
        title = "Elevated Heavy Rain & Waterlogging Risk"
        desc = (
            f"WeatherGPT estimates elevated rainfall risk (score: {int(score * 100)}%) because forecast rainfall "
            f"({forecast_precip or 0.0} mm) and soil wetness significantly exceed local baseline capacity."
        )
        actions = [
            "Avoid unnecessary travel through known flood-prone or waterlogged corridors.",
            "Monitor official weather alerts and drainage updates from civic authorities.",
            "Prepare for possible localized waterlogging and transport disruptions.",
            "Keep backup emergency contacts accessible.",
        ]
    elif level == "MODERATE" or score >= 0.25:
        is_anomalous = rainfall_anomaly is not None and rainfall_anomaly > 0.4
        severity = AlertSeverity.ADVISORY if is_anomalous else AlertSeverity.WATCH
        title = "Rainfall Anomaly Advisory" if is_anomalous else "Localized Precipitation Watch"
        desc = (
            f"WeatherGPT identifies moderate weather activity (score: {int(score * 100)}%). "
            f"Observed and forecast rainfall parameters suggest potential for localized surface ponding."
        )
        actions = [
            "Monitor updated forecasts and local sky conditions.",
            "Check official weather advisories before scheduling outdoor transit.",
            "Be aware of localized water accumulation in low-lying roads.",
        ]
    else:
        severity = AlertSeverity.INFO
        title = "Normal Baseline Conditions"
        desc = "WeatherGPT meteorological indicators indicate stable conditions consistent with normal regional baselines."
        actions = [
            "Continue routine weather monitoring.",
            "No immediate heavy rainfall or flood hazard detected.",
        ]

    return severity, title, desc, actions
