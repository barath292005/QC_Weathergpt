export type AlertSeverity = 'INFO' | 'WATCH' | 'ADVISORY' | 'WARNING' | 'EMERGENCY';
export type AlertStatus = 'ACTIVE' | 'EXPIRED' | 'RESOLVED';

export interface WeatherGPTAlert {
  alert_id: string;
  hazard: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  risk_score: number;
  risk_level: string;
  evidence: string[];
  recommended_actions: string[];
  issued_at: string;
  valid_from: string;
  valid_until: string;
  source: string;
  source_type: string;
  prototype: boolean;
  alert_status: AlertStatus;
}

export interface AlertResponse {
  location: {
    latitude: number;
    longitude: number;
  };
  alerts: WeatherGPTAlert[];
  status?: string;
  last_evaluated?: string;
}
