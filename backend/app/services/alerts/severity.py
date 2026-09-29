"""Alert severity levels and classifications for WeatherGPT.

NOTE: These are WeatherGPT system-generated categories for decision support
and are NOT official government warning categories (such as IMD color codes).
"""

from enum import Enum
from typing import Dict, Tuple

class AlertSeverity(str, Enum):
    INFO = "INFO"
    WATCH = "WATCH"
    ADVISORY = "ADVISORY"
    WARNING = "WARNING"
    EMERGENCY = "EMERGENCY"

# Configurable mapping guidelines from risk level
DEFAULT_RISK_TO_SEVERITY: Dict[str, AlertSeverity] = {
    "LOW": AlertSeverity.INFO,
    "MODERATE": AlertSeverity.WATCH,
    "HIGH": AlertSeverity.WARNING,
    "EXTREME": AlertSeverity.EMERGENCY,
}
