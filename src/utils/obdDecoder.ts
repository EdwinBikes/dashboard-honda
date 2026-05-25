/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OBDData } from '../types';

// Standard OBD-II PIDs and Crome QD3 variables (Service 01 and Crome OBD1 Datalogger)
export const OBD_PIDS = {
  ENGINE_LOAD: '0104',
  COOLANT_TEMP: '0105',
  FUEL_PRESSURE: '010A',
  MAP_PRESSURE: '010B', // Intake manifold relative or absolute pressure
  ENGINE_RPM: '010C',
  VEHICLE_SPEED: '010D',
  SPARK_ADVANCE: '010E',
  IAT_TEMP: '010F',     // Intake Air Temp
  MAF_FLOW: '0110',
  THROTTLE_POS: '0111', // TPS
  O2_VOLTAGE: '0114',
  CATALYST_TEMP: '013C',
  BAROMETRIC: '0133',
  // Crome QD3 Protocol Specific PIDs
  CROME_INJECTOR: 'C101', // Injector pulse width in ms
  CROME_MAP_ABS: 'C102',  // Absolute MAP in mbar
};

// Initial AT commands for ELM327 chip setup
export const ELM_INIT_COMMANDS = [
  'ATZ',   // Reset all
  'ATE0',  // Echo off
  'ATH0',  // Headers off
  'ATL0',  // Linefeeds off
  'ATSP0', // Auto-protocol detection
];

/**
 * Decodes hexadecimal string response from an OBD-II ECU ELM327 adapter.
 * For example:
 * - RPM response format "41 0C 1A F8"
 *   Formula: ((A * 256) + B) / 4
 *   Values: 41 0c is confirmation of Service 01, PID 0C. A is 1A (26), B is F8 (248) -> (26*256+248)/4 = 1726 RPM
 */
export function decodeOBDHex(hex: string, pid: string): number | null {
  // Clean string spaces and uppercase
  const cleanHex = hex.replace(/\s+/g, '').toUpperCase();
  
  // Verify response matches Service 01 response (41 + PID suffix)
  const pidSuffix = pid.substring(2); // e.g., '0C'
  const expectedPrefix = '41' + pidSuffix;
  
  if (!cleanHex.includes(expectedPrefix)) {
    return null; // Faulty data or not confirmation
  }
  
  const dataStartIdx = cleanHex.indexOf(expectedPrefix) + expectedPrefix.length;
  const dataPayload = cleanHex.substring(dataStartIdx);
  
  if (dataPayload.length < 2) return null;

  try {
    switch (pid) {
      case OBD_PIDS.ENGINE_RPM: { // PID 0C (4 hex chars: A & B)
        if (dataPayload.length < 4) return null;
        const a = parseInt(dataPayload.substring(0, 2), 16);
        const b = parseInt(dataPayload.substring(2, 4), 16);
        return Math.round(((a * 256) + b) / 4);
      }
      
      case OBD_PIDS.COOLANT_TEMP: { // PID 05 (2 hex chars: A)
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return a - 40; // °C
      }
      
      case OBD_PIDS.VEHICLE_SPEED: { // PID 0D (2 hex chars: A)
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return a; // km/h
      }

      case OBD_PIDS.ENGINE_LOAD: { // PID 04 (2 hex chars: A)
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return Math.round((a * 100) / 255); // %
      }

      case OBD_PIDS.THROTTLE_POS: { // PID 11 (2 hex chars: A)
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return Math.round((a * 100) / 255); // %
      }

      case OBD_PIDS.MAP_PRESSURE: { // PID 0B (2 hex chars: A)
        // Kept in kPa absolute, convert to relative boost in PSI
        // 100 kPa = Barometric (approx 14.5 PSI). Boost = (MAP - 101.3) kPa * 0.145038 PSI/kPa
        const a = parseInt(dataPayload.substring(0, 2), 16);
        const relativeBoostPsi = (a - 101.3) * 0.145038;
        return Number(relativeBoostPsi.toFixed(1));
      }

      case OBD_PIDS.IAT_TEMP: { // PID 0F (2 hex chars: A)
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return a - 40; // °C
      }

      case OBD_PIDS.SPARK_ADVANCE: { // PID 0E (2 hex chars: A)
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return Number(((a - 128) / 2).toFixed(1)); // degrees
      }

      case OBD_PIDS.O2_VOLTAGE: { // PID 14 (4 hex chars: A & B)
        // A is voltage, B is Short Term Fuel Trim
        if (dataPayload.length < 4) return null;
        const a = parseInt(dataPayload.substring(0, 2), 16);
        // AFR estimation: voltage * some scale or lambda. Let's return Voltage (0 to 1.0V) or lambda * 14.7 AFR
        const voltage = a / 200; // standard OBD O2 voltage ranges 0-1V
        // Assume narrow band sensor: 0.1V lean, 0.9V rich, let's convert to simulated AFR ratio (10.0 to 18.0)
        const afrValue = 18.0 - (voltage * 8.0);
        return Number(afrValue.toFixed(2));
      }

      case OBD_PIDS.CROME_INJECTOR: { // Custom QD3 Injector Byte
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return Number((a / 10).toFixed(2)); // e.g. 183 -> 18.3 ms
      }

      case OBD_PIDS.CROME_MAP_ABS: { // Custom QD3 MAP mbar
        const a = parseInt(dataPayload.substring(0, 2), 16);
        return a * 10; // e.g. 100 -> 1000 mbar (100 kPa)
      }

      default:
        return parseInt(dataPayload, 16);
    }
  } catch (err) {
    console.error('Error parsing OBD byte packet:', err);
    return null;
  }
}

/**
 * Encodes simulator telemetry data into ELM327 mock HEX codes, for educational visualization
 * and virtual bluetooth connection data streams.
 */
export function encodeMockOBDHex(pid: string, data: OBDData): string {
  const pidSuffix = pid.substring(2);
  const prefix = '41 ' + pidSuffix;

  switch (pid) {
    case OBD_PIDS.ENGINE_RPM: {
      const raw = data.rpm * 4;
      const a = Math.floor(raw / 256);
      const b = Math.floor(raw % 256);
      return `${prefix} ${a.toString(16).padStart(2, '0')} ${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.COOLANT_TEMP: {
      const a = data.coolantTemp + 40;
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.VEHICLE_SPEED: {
      const a = data.speed;
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.ENGINE_LOAD: {
      const a = Math.round((data.engineLoad * 255) / 100);
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.THROTTLE_POS: {
      const a = Math.round((data.throttle * 255) / 100);
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.CROME_INJECTOR: {
      const a = Math.max(0, Math.min(255, Math.round(data.injector * 10)));
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.CROME_MAP_ABS: {
      const a = Math.max(0, Math.min(255, Math.round(data.map / 10)));
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.MAP_PRESSURE: {
      // relative boost in PSI, back to absolute MAP kPa
      // kPa = (relativeBoostPsi / 0.145038) + 101.3
      const kPa = (data.boost / 0.145038) + 101.3;
      const a = Math.max(0, Math.min(255, Math.round(kPa)));
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.IAT_TEMP: {
      const a = data.intakeTemp + 40;
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.SPARK_ADVANCE: {
      // (a - 128) / 2 = spark
      // a = (spark * 2) + 128
      const a = Math.round((data.sparkAdvance * 2) + 128);
      return `${prefix} ${a.toString(16).padStart(2, '0')}`.toUpperCase();
    }
    case OBD_PIDS.O2_VOLTAGE: {
      // AFR (10.0 to 18.0) -> voltage (0 to 1V)
      // voltage = (18 - AFR) / 8
      const voltage = (18.0 - data.afr) / 8.0;
      const a = Math.max(0, Math.min(255, Math.round(voltage * 200)));
      return `${prefix} ${a.toString(16).padStart(2, '0')} FF`.toUpperCase(); // Dummy STFT Byte
    }
    default:
      return '41 00 00';
  }
}
