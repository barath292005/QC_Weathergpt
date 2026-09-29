import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Bell,
  BellRing,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Info,
  RefreshCw,
  Clock,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import type { WeatherGPTAlert, AlertResponse, AlertSeverity } from '../types/alert';
import { getApiBaseUrl } from '../utils/api';
import {
  getNotificationPermission,
  requestNotificationPermission,
  triggerBrowserAlertNotification,
  isNotificationSupported,
} from '../utils/notifications';

interface AlertPanelProps {
  lat: number;
  lon: number;
  onAlertChange?: (alert: WeatherGPTAlert | null) => void;
}

const SEVERITY_STYLES: Record<
  AlertSeverity,
  {
    badge: string;
    border: string;
    bg: string;
    icon: React.ReactNode;
    titleColor: string;
  }
> = {
  INFO: {
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    border: 'border-emerald-800/40',
    bg: 'bg-emerald-950/20',
    icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    titleColor: 'text-emerald-200',
  },
  WATCH: {
    badge: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    border: 'border-amber-800/50',
    bg: 'bg-amber-950/25',
    icon: <Radio className="w-5 h-5 text-amber-400 animate-pulse" />,
    titleColor: 'text-amber-200',
  },
  ADVISORY: {
    badge: 'bg-amber-900/80 text-amber-200 border-amber-600/70',
    border: 'border-amber-700/60',
    bg: 'bg-amber-950/30',
    icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    titleColor: 'text-amber-100',
  },
  WARNING: {
    badge: 'bg-orange-950/90 text-orange-200 border-orange-700/80',
    border: 'border-orange-800/70',
    bg: 'bg-orange-950/30',
    icon: <AlertOctagon className="w-5 h-5 text-orange-400 animate-bounce" />,
    titleColor: 'text-orange-100',
  },
  EMERGENCY: {
    badge: 'bg-rose-950 text-rose-200 border-rose-600 animate-pulse',
    border: 'border-rose-700',
    bg: 'bg-rose-950/40',
    icon: <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />,
    titleColor: 'text-rose-100',
  },
};

export const AlertPanel: React.FC<AlertPanelProps> = ({ lat, lon, onAlertChange }) => {
  const [activeAlert, setActiveAlert] = useState<WeatherGPTAlert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');

  const onAlertChangeRef = useRef(onAlertChange);
  useEffect(() => {
    onAlertChangeRef.current = onAlertChange;
  }, [onAlertChange]);

  // Read configured poll interval or default to 60000ms
  const pollIntervalMs = Number(import.meta.env.VITE_ALERT_POLL_INTERVAL_MS) || 60000;

  // Initialize notification permission status
  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/v1/alerts/current?lat=${lat}&lon=${lon}`);
      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.detail || `Alerts API error! HTTP ${response.status}`);
      }

      const data: AlertResponse & { active_alert?: WeatherGPTAlert } = await response.json();
      const alert = data.active_alert || (data.alerts && data.alerts.length > 0 ? data.alerts[0] : null);
      setActiveAlert(alert);
      setLastChecked(new Date().toLocaleTimeString());

      if (onAlertChangeRef.current) {
        onAlertChangeRef.current(alert);
      }

      // Check for browser notification if severe
      if (alert && (alert.severity === 'WARNING' || alert.severity === 'EMERGENCY')) {
        triggerBrowserAlertNotification(alert);
      }
    } catch (err: any) {
      console.error('Alerts retrieval failed:', err);
      setError(err.message || 'Unable to retrieve alert feed.');
    } finally {
      setLoading(false);
    }
  }, [lat, lon]);

  useEffect(() => {
    fetchAlerts();

    // Auto-refresh interval (safe 60s polling)
    const interval = setInterval(() => {
      fetchAlerts();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [fetchAlerts, pollIntervalMs]);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted' && activeAlert) {
      triggerBrowserAlertNotification(activeAlert);
    }
  };

  const isCritical = activeAlert && activeAlert.severity !== 'INFO';
  const severityStyle = activeAlert ? SEVERITY_STYLES[activeAlert.severity] : SEVERITY_STYLES.INFO;

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-amber-950/80 border border-amber-500/30 rounded-lg text-amber-400">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-slate-100">WeatherGPT Early Warning Engine</h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Step 6
              </span>
            </div>
            <p className="text-xs text-slate-400">Dynamic Risk-to-Alert Ingestion & Impact Advisory Pipeline</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Notification Permission Toggle */}
          {isNotificationSupported() && (
            <button
              onClick={handleEnableNotifications}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition ${
                notifPermission === 'granted'
                  ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title={
                notifPermission === 'granted'
                  ? 'Browser push notifications active for high-priority alerts'
                  : 'Enable browser notifications for high-priority risk warnings'
              }
            >
              <BellRing className="w-3.5 h-3.5 text-amber-400" />
              <span>{notifPermission === 'granted' ? 'Alerts Active' : 'Enable Notifications'}</span>
            </button>
          )}

          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs transition"
            title="Refresh alert feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !activeAlert && (
        <div className="py-8 flex flex-col items-center justify-center space-y-2 bg-slate-950/40 rounded-lg border border-slate-800">
          <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
          <span className="text-xs text-slate-400">Evaluating meteorological alert thresholds...</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-lg space-y-2">
          <div className="flex items-center space-x-2 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAlerts}
            className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-rose-100 rounded text-xs transition"
          >
            Retry Alert Check
          </button>
        </div>
      )}

      {/* Active Alert Display */}
      {!error && activeAlert && (
        <div className="space-y-4">
          {/* Main Alert Card */}
          <div className={`p-4 rounded-xl border ${severityStyle.border} ${severityStyle.bg} space-y-3`}>
            {/* Severity & Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                {severityStyle.icon}
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${severityStyle.badge}`}>
                  [{activeAlert.severity}]
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Score: <strong className="text-slate-200">{Math.round(activeAlert.risk_score * 100)}%</strong> ({activeAlert.risk_level})
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                Status: <strong className="text-emerald-400">{activeAlert.alert_status}</strong>
              </span>
            </div>

            {/* Title & Description */}
            <div>
              <h4 className={`text-sm font-bold ${severityStyle.titleColor}`}>
                {activeAlert.hazard}: {activeAlert.title}
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {activeAlert.description}
              </p>
            </div>

            {/* Evidence Section */}
            {activeAlert.evidence && activeAlert.evidence.length > 0 && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-400 flex items-center space-x-1">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Calculated Risk Evidence</span>
                </span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  {activeAlert.evidence.map((item, idx) => (
                    <li key={idx} className="leading-snug">
                      <span className="font-mono text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Actions */}
            {activeAlert.recommended_actions && activeAlert.recommended_actions.length > 0 && (
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-amber-300 flex items-center space-x-1">
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Recommended Preparedness Actions</span>
                </span>
                <ul className="text-xs text-slate-300 space-y-1">
                  {activeAlert.recommended_actions.map((act, idx) => (
                    <li key={idx} className="flex items-start space-x-2">
                      <span className="text-amber-400 shrink-0 font-bold">•</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Timestamps & Validity */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/70 gap-2">
              <div className="flex items-center space-x-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Issued: {new Date(activeAlert.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-slate-600">|</span>
                <span>Valid 24h</span>
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                ID: {activeAlert.alert_id.substring(0, 36)}...
              </div>
            </div>
          </div>

          {/* Official Warning Distinction Notice (Required by SIH Guidelines) */}
          <div className="bg-slate-950/70 border border-amber-900/50 p-3 rounded-xl flex items-start space-x-2.5 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-amber-300">
                WeatherGPT System-Generated Risk Assessment
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                This is an automated decision-support risk alert generated by WeatherGPT's computational hazard pipeline.
                <strong> It is NOT an official government warning issued by IMD, NDMA, or local disaster authorities.</strong> Always verify with official civic emergency bulletins for evacuation directives.
              </p>
              <div className="pt-1 flex items-center space-x-3 text-[10px] text-slate-500 font-mono">
                <span>Source: {activeAlert.source}</span>
                <span>•</span>
                <span>Type: {activeAlert.source_type}</span>
                <span>•</span>
                <span>Prototype: {String(activeAlert.prototype)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
        <span>Auto-polling: Every {Math.round(pollIntervalMs / 1000)}s</span>
        {lastChecked && <span>Last verified: {lastChecked}</span>}
      </div>
    </div>
  );
};
