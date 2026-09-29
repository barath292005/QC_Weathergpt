"""Notification delivery provider abstractions."""

from abc import ABC, abstractmethod
from typing import Dict, Any
from app.services.alerts.schemas import WeatherGPTAlert

class NotificationProvider(ABC):
    """Abstract interface for multi-channel alert delivery."""

    @abstractmethod
    async def send_alert(self, alert: WeatherGPTAlert, recipient: str) -> bool:
        """Deliver alert to destination."""
        pass

class BrowserNotificationProvider(NotificationProvider):
    """Web push / browser notification provider."""

    async def send_alert(self, alert: WeatherGPTAlert, recipient: str = "broadcast") -> bool:
        # Client-side Notification API handles browser dispatch
        return True

class EmailNotificationProvider(NotificationProvider):
    """Email delivery provider placeholder (SMTP/SES/SendGrid)."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key

    async def send_alert(self, alert: WeatherGPTAlert, recipient: str) -> bool:
        if not self.api_key:
            return False
        # External provider dispatch logic when credentials configured
        return True

class SMSNotificationProvider(NotificationProvider):
    """SMS delivery provider placeholder (Twilio/CDAC/NIC)."""

    def __init__(self, account_sid: str | None = None, auth_token: str | None = None):
        self.account_sid = account_sid
        self.auth_token = auth_token

    async def send_alert(self, alert: WeatherGPTAlert, recipient: str) -> bool:
        if not self.account_sid or not self.auth_token:
            return False
        # External provider dispatch logic when credentials configured
        return True
