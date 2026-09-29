"""Exceptions for WeatherGPT Alerts Engine."""

class AlertServiceError(Exception):
    """Base exception for Alert Service."""
    pass

class InvalidCoordinatesError(AlertServiceError):
    """Raised when latitude or longitude is invalid."""
    pass

class InvalidForecastWindowError(AlertServiceError):
    """Raised when forecast window exceeds valid range."""
    pass

class RiskInputsUnavailableError(AlertServiceError):
    """Raised when upstream Risk Engine cannot provide assessment."""
    pass
