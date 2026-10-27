/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

export interface TelemetryPacket {
  id: number;           // Packet sequence number
  t: number;            // DHT11 Temperature in °C
  h: number;            // DHT11 Humidity in %
  p: number;            // BMP280 Pressure in hPa
  alt: number;          // BMP280 Barometric Altitude in m
  ax: number;           // MPU6050 Accel X in m/s²
  ay: number;           // MPU6050 Accel Y in m/s²
  az: number;           // MPU6050 Accel Z in m/s²
  gx: number;           // MPU6050 Gyro X in °/s
  gy: number;           // MPU6050 Gyro Y in °/s
  gz: number;           // MPU6050 Gyro Z in °/s
  r: number;            // Roll in degrees
  pt: number;           // Pitch in degrees
  y: number;            // Yaw in degrees
  lat: number;          // NEO-6M GPS Latitude in degrees
  lon: number;          // NEO-6M GPS Longitude in degrees
  galt: number;         // NEO-6M GPS Altitude in m
  sats: number;         // Satellites used
  fix: number;          // GPS fix: 0 (No Fix) or 1 (3D DGPS Fix)
  timestamp?: number;   // Local arrival timestamp (ms epoch)
}

export interface DisturbanceEvent {
  id: string;
  timestamp: string;
  name: string;
  peakJitter: number;
  status: string;
  durationMs: number;
}

export interface SatelliteInfo {
  prn: number;
  system: 'GPS' | 'NavIC' | 'GLONASS';
  azimuth: number;
  elevation: number;
  snr: number;          // dB-Hz
  locked: boolean;
}

export type ConnectionState = 'DISCONNECTED' | 'CONNECTED' | 'DEMO' | 'STALE';
export type ConnectionMode = 'SERIAL' | 'WEBSOCKET' | 'SIM';
export type ActiveTab = 'primary' | 'motion' | 'diagnostics' | 'gps' | 'controls';

export const CONFIG = {
  TEAM_NAME: 'COSMIC ERA',
  EVENT_NAME: "ORBITRA'26",
  INSTITUTION: 'MMMUT Gorakhpur',
  CUBESAT_NAME: 'ORBITRA-1 (MMMUT)',
  GS_LAT: 26.7324,
  GS_LON: 83.4332,
  GS_ALT: 102.0, // meters MSL
  DEFAULT_BAUD: 115200,
  DEFAULT_JITTER_LIMIT: 1.40,
  DEFAULT_WS_URL: 'ws://localhost:8081',
};
