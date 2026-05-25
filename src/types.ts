/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OBDData {
  timestamp: number;
  rpm: number;         // RPM (0-8000+)
  coolantTemp: number; // °C (0-150)
  speed: number;       // km/h (0-240)
  engineLoad: number;  // % (0-100)
  throttle: number;    // % (0-100)
  boost: number;       // psi or bar (e.g., -14.7 to 30 psi)
  intakeTemp: number;  // °C (0-100)
  sparkAdvance: number;// degrees
  voltage: number;     // V (10-15)
  afr: number;         // Air-Fuel Ratio (10.0 - 20.0, lambda)
  injector: number;    // Injector pulse width in ms (0-25)
  map: number;         // Manifold Absolute Pressure in mbar or kPa (0-2500)
}

export interface DTC {
  code: string;
  description: string;
  system: 'Motor' | 'Transmisión' | 'Tracción' | 'Emisiones' | 'Eléctrico';
  severity: 'Baja' | 'Media' | 'Alta';
}

export interface LogEntry {
  id: string;
  name: string;
  date: string;
  duration: number; // in seconds
  dataPoints: OBDData[];
}

export interface CustomWidget {
  id: string;
  type: 'gauge-round' | 'gauge-bar' | 'numeric' | 'graph-line';
  pid: keyof OBDData;
  label: string;
  min: number;
  max: number;
  unit: string;
  warnThreshold?: number;
  criticalThreshold?: number;
  visible: boolean;
  color?: string; // custom custom overrides
}

export interface DashboardTheme {
  id: string;
  name: string;
  bgClass: string;
  cardClass: string;
  accentColor: string;
  textColor: string;
  glowClass: string;
}
