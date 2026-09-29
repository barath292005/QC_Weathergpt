import type { WeatherGPTAlert } from '../types/alert';

const notifiedAlertIds = new Set<string>();

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return 'denied';
  }
}

export function triggerBrowserAlertNotification(alert: WeatherGPTAlert): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  // Deduplicate: do not alert if already notified for this alert_id
  if (notifiedAlertIds.has(alert.alert_id)) return false;

  // Only notify for notable severity (ADVISORY, WARNING, EMERGENCY)
  if (alert.severity === 'INFO') return false;

  try {
    const notification = new Notification(`[${alert.severity}] ${alert.title}`, {
      body: `${alert.description}\nRisk Score: ${Math.round(alert.risk_score * 100)}% • WeatherGPT Early Warning`,
      icon: '/favicon.svg',
      tag: alert.alert_id,
    });

    notifiedAlertIds.add(alert.alert_id);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch (err) {
    console.warn('Failed to show notification:', err);
    return false;
  }
}
