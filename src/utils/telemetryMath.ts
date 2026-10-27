/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import { TelemetryPacket } from '../types/telemetry';

/**
 * Parses an incoming serial line into a TelemetryPacket.
 * Safely ignores non-JSON lines and corrupt fragments.
 */
/**
 * Parses an incoming serial line into a TelemetryPacket.
 * Supports:
 * 1. JSON objects: {"id":4895,"t":24.5,"h":48.1,"p":1012.94,...}
 * 2. Key-Value pairs: id=4895 t=24.5 h=48.1 p=1012.94 ax=0.0 ... or id:4895, t:24.5...
 * 3. Comma-separated values (CSV): 4895,24.5,48.1,1012.94,93,0,-0.01,9.82,0,0,0,4.5,-2,128.5,...
 */
export function parseTelemetryLine(line: string): Partial<TelemetryPacket> | null {
  if (!line || typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (trimmed.length < 3) return null;

  // 1. Try JSON object between first '{' and last '}'
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSnippet = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      const data = JSON.parse(jsonSnippet);
      if (typeof data === 'object' && data !== null) {
        return extractFieldsFromObject(data);
      }
    } catch {
      // Fall through to other formats
    }
  }

  // 2. Try Key-Value pairs (e.g. t=24.5 h=48.1 or temp:24.5, hum:48.1)
  if (trimmed.includes('=') || (trimmed.includes(':') && !trimmed.startsWith('{'))) {
    const kvPairs = trimmed.split(/[\s,]+/);
    const obj: Record<string, number> = {};
    for (const pair of kvPairs) {
      const parts = pair.split(/[=:]/);
      if (parts.length === 2) {
        const k = parts[0].trim().toLowerCase();
        const v = parseFloat(parts[1].trim());
        if (!isNaN(v)) {
          obj[k] = v;
        }
      }
    }
    if (Object.keys(obj).length >= 2) {
      return extractFieldsFromObject(obj);
    }
  }

  // 3. Try CSV (comma or semicolon separated numbers)
  if (trimmed.includes(',') || trimmed.includes(';')) {
    const parts = trimmed.split(/[,;]+/).map((s) => parseFloat(s.trim()));
    const validNums = parts.filter((n) => !isNaN(n));
    if (validNums.length >= 6) {
      // Mapping order: [id, t, h, p, alt, ax, ay, az, gx, gy, gz, r, pt, y, lat, lon, galt, sats, fix]
      let idx = 0;
      let id: number | undefined;
      // If first number looks like an integer ID (> 1)
      if (Number.isInteger(validNums[0]) && validNums[0] > 0) {
        id = validNums[idx++];
      }

      const t = validNums[idx++];
      const h = validNums[idx++];
      const p = validNums[idx++];
      const alt = validNums[idx++];
      const ax = validNums[idx++];
      const ay = validNums[idx++];
      const az = validNums[idx++];
      const gx = validNums[idx++];
      const gy = validNums[idx++];
      const gz = validNums[idx++];
      const r = validNums[idx++];
      const pt = validNums[idx++];
      const y = validNums[idx++];
      const lat = validNums[idx++];
      const lon = validNums[idx++];
      const galt = validNums[idx++];
      const sats = validNums[idx++];
      const fix = validNums[idx++];

      const obj: Record<string, any> = {
        id, t, h, p, alt, ax, ay, az, gx, gy, gz, r, pt, y, lat, lon, galt, sats, fix
      };
      return extractFieldsFromObject(obj);
    }
  }

  return null;
}

function extractFieldsFromObject(data: Record<string, any>): Partial<TelemetryPacket> {
  const num = (keys: string[]): number | undefined => {
    for (const k of keys) {
      if (typeof data[k] === 'number' && !isNaN(data[k])) {
        return data[k];
      }
      if (typeof data[k] === 'string') {
        const parsed = parseFloat(data[k]);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return undefined;
  };

  const id = num(['id', 'pkt', 'packet', 'seq']);
  const t = num(['t', 'temp', 'temperature', 'dht_t', 'bmp_t']);
  const h = num(['h', 'hum', 'humidity', 'dht_h']);
  const p = num(['p', 'press', 'pressure', 'bmp_p', 'baro_p']);
  const alt = num(['alt', 'altitude', 'baro_alt', 'bmp_alt', 'baroAltitude']);
  
  let ax = num(['ax', 'acc_x', 'accel_x', 'aX', 'accelX', 'accX']);
  let ay = num(['ay', 'acc_y', 'accel_y', 'aY', 'accelY', 'accY']);
  let az = num(['az', 'acc_z', 'accel_z', 'aZ', 'accelZ', 'accZ']);

  // If accelerometer is reported in Gs (e.g. az ~ 1.0 instead of 9.81 m/s²), normalize to m/s²
  if (az !== undefined && Math.abs(az) <= 2.5 && Math.abs(ax ?? 0) <= 2.5 && Math.abs(ay ?? 0) <= 2.5) {
    if (ax !== undefined) ax = Number((ax * 9.80665).toFixed(2));
    if (ay !== undefined) ay = Number((ay * 9.80665).toFixed(2));
    az = Number((az * 9.80665).toFixed(2));
  }

  // Gyroscope / Zyro aliases (in °/s)
  const gx = num(['gx', 'gyro_x', 'gyrox', 'gyroX', 'gX', 'zyro_x', 'zyrox', 'zyroX', 'zX', 'wx', 'w_x', 'omega_x']);
  const gy = num(['gy', 'gyro_y', 'gyroy', 'gyroY', 'gY', 'zyro_y', 'zyroy', 'zyroY', 'zY', 'wy', 'w_y', 'omega_y']);
  const gz = num(['gz', 'gyro_z', 'gyroz', 'gyroZ', 'gZ', 'zyro_z', 'zyroz', 'zyroZ', 'zZ', 'wz', 'w_z', 'omega_z']);

  // Explicit attitude angles
  let r = num(['r', 'roll', 'roll_deg', 'rollDeg', 'phi']);
  let pt = num(['pt', 'pitch', 'pitch_deg', 'pitchDeg', 'theta']);
  let y = num(['y', 'yaw', 'yaw_deg', 'yawDeg', 'psi', 'heading']);

  // If explicit attitude angles not supplied, compute initial tilt from gravity vector
  if (r === undefined && ay !== undefined && az !== undefined) {
    r = Number(((Math.atan2(ay, az) * 180) / Math.PI).toFixed(1));
  }
  if (pt === undefined && ax !== undefined && ay !== undefined && az !== undefined) {
    pt = Number(((Math.atan2(-ax, Math.sqrt(ay * ay + az * az)) * 180) / Math.PI).toFixed(1));
  }

  const lat = num(['lat', 'latitude', 'gps_lat']);
  const lon = num(['lon', 'lng', 'longitude', 'gps_lon', 'gps_lng']);
  const galt = num(['galt', 'gps_alt', 'gps_altitude', 'gpsAltitude']);
  const sats = num(['sats', 'sat', 'satellites', 'sats_in_view']) ?? 0;
  const fix = num(['fix', 'gps_fix', 'status_fix']) ?? (lat !== undefined && lon !== undefined ? 1 : 0);

  const packet: Partial<TelemetryPacket> = {
    id: id !== undefined ? Math.round(id) : undefined,
    t: t !== undefined ? Number(t.toFixed(1)) : undefined,
    h: h !== undefined ? Number(h.toFixed(1)) : undefined,
    p: p !== undefined ? Number(p.toFixed(2)) : undefined,
    alt: alt !== undefined ? Number(alt.toFixed(1)) : undefined,
    ax: ax !== undefined ? Number(ax.toFixed(2)) : undefined,
    ay: ay !== undefined ? Number(ay.toFixed(2)) : undefined,
    az: az !== undefined ? Number(az.toFixed(2)) : undefined,
    gx: gx !== undefined ? Number(gx.toFixed(2)) : undefined,
    gy: gy !== undefined ? Number(gy.toFixed(2)) : undefined,
    gz: gz !== undefined ? Number(gz.toFixed(2)) : undefined,
    r: r !== undefined ? Number(r.toFixed(1)) : undefined,
    pt: pt !== undefined ? Number(pt.toFixed(1)) : undefined,
    y: y !== undefined ? Number(y.toFixed(1)) : undefined,
    lat: lat !== undefined ? Number(lat.toFixed(5)) : undefined,
    lon: lon !== undefined ? Number(lon.toFixed(5)) : undefined,
    galt: galt !== undefined ? Number(galt.toFixed(1)) : undefined,
    sats: Math.round(sats),
    fix: Math.round(fix),
    timestamp: Date.now(),
  };

  return packet;
}

/**
 * Calculates Dew Point in °C using Magnus-Tetens formula.
 */
export function calculateDewPoint(tempC: number, humPct: number): number {
  if (tempC === undefined || humPct === undefined || humPct <= 0) return 0;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humPct / 100);
  const dew = (b * alpha) / (a - alpha);
  return Number(dew.toFixed(1));
}

/**
 * Calculates net dynamic jitter displacement in m/s² relative to 1G earth gravity (9.81 m/s²).
 */
export function calculateNetJitter(ax: number, ay: number, az: number): number {
  if (ax === undefined || ay === undefined || az === undefined) return 0;
  const mag = Math.sqrt(ax * ax + ay * ay + az * az);
  const jitter = Math.abs(mag - 9.80665);
  return Number(jitter.toFixed(2));
}

/**
 * Converts decimal degrees to Degree-Minute-Second (DMS) string.
 */
export function toDMS(val: number, isLat: boolean): string {
  if (val === undefined || isNaN(val)) return '--';
  const hemisphere = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
  const absVal = Math.abs(val);
  const deg = Math.floor(absVal);
  const minFloat = (absVal - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Number(((minFloat - min) * 60).toFixed(1));
  return `${deg}° ${min}' ${sec}" ${hemisphere}`;
}

/**
 * Computes haversine ground distance (km), slant distance (km),
 * azimuth (deg 0..360), and elevation (deg -90..+90) relative to ground station.
 */
export function calculateDistanceAndAzEl(
  gsLat: number,
  gsLon: number,
  gsAltM: number,
  satLat: number,
  satLon: number,
  satAltM: number
): { groundDistKm: number; slantDistKm: number; azimuthDeg: number; elevationDeg: number } {
  const R = 6371; // Earth radius in km
  const dLat = ((satLat - gsLat) * Math.PI) / 180;
  const dLon = ((satLon - gsLon) * Math.PI) / 180;
  const lat1 = (gsLat * Math.PI) / 180;
  const lat2 = (satLat * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const groundDistKm = R * c;

  const altDiffKm = (satAltM - gsAltM) / 1000;
  const slantDistKm = Math.sqrt(groundDistKm * groundDistKm + altDiffKm * altDiffKm);

  // Bearing / Azimuth
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let az = (Math.atan2(y, x) * 180) / Math.PI;
  if (az < 0) az += 360;

  // Elevation angle
  let el = 0;
  if (slantDistKm > 0.0001) {
    el = (Math.atan2(altDiffKm, groundDistKm) * 180) / Math.PI;
  }

  return {
    groundDistKm: Number(groundDistKm.toFixed(2)),
    slantDistKm: Number(slantDistKm.toFixed(2)),
    azimuthDeg: Math.round(az),
    elevationDeg: Math.round(el),
  };
}

/**
 * Calculates packet loss percentage from total packets vs highest/lowest ID.
 */
export function calculatePacketLoss(totalReceived: number, highestId: number, lowestId: number): number {
  if (totalReceived <= 1 || highestId <= lowestId) return 0;
  const expected = highestId - lowestId + 1;
  if (expected <= 0) return 0;
  const missing = Math.max(0, expected - totalReceived);
  const lossPct = (missing / expected) * 100;
  return Number(lossPct.toFixed(2));
}

/**
 * Generates raw CSV string from packets array.
 */
export function exportTelemetryToCSV(packets: TelemetryPacket[]): string {
  const headers = [
    'UTC_ISO',
    'Packet_ID',
    'DHT11_Temp_C',
    'DHT11_Humidity_Pct',
    'BMP280_Pressure_hPa',
    'BMP280_Altitude_m',
    'MPU6050_Ax_ms2',
    'MPU6050_Ay_ms2',
    'MPU6050_Az_ms2',
    'MPU6050_Gx_degs',
    'MPU6050_Gy_degs',
    'MPU6050_Gz_degs',
    'Roll_deg',
    'Pitch_deg',
    'Yaw_deg',
    'GPS_Lat',
    'GPS_Lon',
    'GPS_Alt_m',
    'GPS_Sats',
    'GPS_Fix',
  ];

  const rows = packets.map((p) => [
    p.timestamp ? new Date(p.timestamp).toISOString() : new Date().toISOString(),
    p.id ?? '',
    p.t ?? '',
    p.h ?? '',
    p.p ?? '',
    p.alt ?? '',
    p.ax ?? '',
    p.ay ?? '',
    p.az ?? '',
    p.gx ?? '',
    p.gy ?? '',
    p.gz ?? '',
    p.r ?? '',
    p.pt ?? '',
    p.y ?? '',
    p.lat ?? '',
    p.lon ?? '',
    p.galt ?? '',
    p.sats ?? 0,
    p.fix ?? 0,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
