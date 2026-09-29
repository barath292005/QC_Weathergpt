"""Schemas for WeatherGPT Alerts & Early Warning Engine."""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from app.services.alerts.severity import AlertSeverity

class WeatherGPTAlert(BaseModel):
    alert_id: str = Field(..., description="Deterministic unique fingerprint for alert deduplication")
    hazard: str = Field(..., description="Specific hazard type, e.g. Heavy Rain / Flood Risk")
    severity: AlertSeverity = Field(..., description="WeatherGPT alert severity level")
    title: string = Field(..., description="Concise alert headline")
    description: str = Field(..., description="Detailed explanation grounded in observed metrics")
    latitude: float = Field(..., description="Target latitude coordinate")
    longitude: float = Field(..., description="Target longitude coordinate")
    location_name: Optional[str] = Field(None, description="Optional region or timezone label")
    risk_score: float = Field(..., description="Calculated composite risk score [0.0 - 1.0]")
    risk_level: str = Field(..., description="Risk level: LOW, MODERATE, HIGH, EXTREME")
    evidence: List[str] = Field(default_factory=list, description="List of actual empirical evidence points")
    recommended_actions: List[str] = Field(default_factory=list, description="Actionable safety preparedness guidance")
    issued_at: str = Field(..., description="Timestamp when alert was evaluated and issued")
    valid_from: str = Field(..., description="Start of validity period")
    valid_until: str = Field(..., description="End of validity period (default 24h)")
    source: str = Field(default="WeatherGPT Risk Engine", description="Generating system origin")
    source_type: str = Field(default="system_generated", description="Classification: system_generated vs official")
    prototype: bool = Field(default=True, description="Flag indicating transparent research prototype")
    alert_status: Literal["ACTIVE", "EXPIRED", "RESOLVED"] = Field(default="ACTIVE", description="Alert state")

class AlertLocation(BaseModel):
    latitude: float
    longitude: float

class AlertResponse(BaseModel):
    location: AlertLocation
    alerts: List[WeatherGPTAlert] = Field(default_factory=list)
    status: str = Field(..., description="Overall alert status summary")
    last_evaluated: Optional[str] = None

class AlertEvaluateRequest(BaseModel):
    lat: float
    lon: float
    forecast_hours: int = 24
