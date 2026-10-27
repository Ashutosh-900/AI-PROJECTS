/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTelemetryLine,
  calculateDewPoint,
  calculateNetJitter,
  toDMS,
  calculateDistanceAndAzEl,
  calculatePacketLoss,
} from './telemetryMath';

test('parseTelemetryLine correctly parses valid JSON line from prompt', () => {
  const line = '{"id":4895,"t":24.5,"h":48.1,"p":1012.94,"alt":93,"ax":0,"ay":-0.01,"az":9.82,"gx":0.0,"gy":0.0,"gz":0.0,"r":4.5,"pt":-2,"y":128.5,"lat":26.7324,"lon":83.4332,"galt":101.7,"sats":9,"fix":1}';
  const parsed = parseTelemetryLine(line);
  assert.notEqual(parsed, null);
  assert.equal(parsed?.id, 4895);
  assert.equal(parsed?.t, 24.5);
  assert.equal(parsed?.h, 48.1);
  assert.equal(parsed?.p, 1012.94);
  assert.equal(parsed?.alt, 93);
  assert.equal(parsed?.ax, 0);
  assert.equal(parsed?.ay, -0.01);
  assert.equal(parsed?.az, 9.82);
  assert.equal(parsed?.r, 4.5);
  assert.equal(parsed?.pt, -2);
  assert.equal(parsed?.y, 128.5);
  assert.equal(parsed?.lat, 26.7324);
  assert.equal(parsed?.lon, 83.4332);
  assert.equal(parsed?.galt, 101.7);
  assert.equal(parsed?.sats, 9);
  assert.equal(parsed?.fix, 1);
});

test('parseTelemetryLine ignores non-JSON and malformed lines safely without crashing', () => {
  assert.equal(parseTelemetryLine(''), null);
  assert.equal(parseTelemetryLine('ESP-NOW link connected'), null);
  assert.equal(parseTelemetryLine('{corrupted:true,'), null);
  assert.equal(parseTelemetryLine('{"id": 123'), null);
});

test('parseTelemetryLine parses JSON embedded within serial debug logs and handles key aliases', () => {
  const dirtyLine = '[RX-FRAME 12:44:02] {"pkt":5001,"temp":26.2,"hum":52.4,"press":1011.8,"altitude":104.2,"acc_x":0.02,"acc_y":-0.05,"acc_z":9.81,"gyro_x":1.2,"gyro_y":-0.4,"gyro_z":0.1,"roll":3.2,"pitch":-1.8,"yaw":95.4,"latitude":26.7324,"longitude":83.4332} (checksum OK)';
  const parsed = parseTelemetryLine(dirtyLine);
  assert.notEqual(parsed, null);
  assert.equal(parsed?.id, 5001);
  assert.equal(parsed?.t, 26.2);
  assert.equal(parsed?.h, 52.4);
  assert.equal(parsed?.p, 1011.8);
  assert.equal(parsed?.alt, 104.2);
  assert.equal(parsed?.ax, 0.02);
  assert.equal(parsed?.gx, 1.2);
  assert.equal(parsed?.r, 3.2);
  assert.equal(parsed?.pt, -1.8);
  assert.equal(parsed?.y, 95.4);
  assert.equal(parsed?.lat, 26.7324);
  assert.equal(parsed?.lon, 83.4332);
});

test('calculateDewPoint calculates accurate dew point', () => {
  // At 24.5°C and 48.1% RH, dew point is ~12.7°C - 13.0°C
  const dp = calculateDewPoint(24.5, 48.1);
  assert.ok(dp > 12.0 && dp < 14.5, `Dew point was ${dp}`);
});

test('calculateNetJitter computes deviation from 1G', () => {
  // Pure 1G down az=9.81
  const jitterZero = calculateNetJitter(0, 0, 9.80665);
  assert.equal(jitterZero, 0);

  // Disturbed accel
  const jitterDisturbed = calculateNetJitter(0, 0, 11.2);
  assert.ok(jitterDisturbed > 1.3 && jitterDisturbed < 1.5, `Jitter was ${jitterDisturbed}`);
});

test('toDMS formats coordinates properly with hemisphere', () => {
  const latDms = toDMS(26.7324, true);
  assert.ok(latDms.startsWith('26°'));
  assert.ok(latDms.endsWith('N'));

  const lonDms = toDMS(83.4332, false);
  assert.ok(lonDms.startsWith('83°'));
  assert.ok(lonDms.endsWith('E'));
});

test('calculateDistanceAndAzEl calculates geometry relative to MMMUT Ground Station', () => {
  const gsLat = 26.7324;
  const gsLon = 83.4332;
  const gsAlt = 102;

  // Same position, slight altitude increase
  const res = calculateDistanceAndAzEl(gsLat, gsLon, gsAlt, 26.7324, 83.4332, 202);
  assert.equal(res.groundDistKm, 0);
  assert.equal(res.slantDistKm, 0.1);
  assert.equal(res.elevationDeg, 90);

  // Position ~1km away
  const res2 = calculateDistanceAndAzEl(gsLat, gsLon, gsAlt, 26.7400, 83.4400, 150);
  assert.ok(res2.groundDistKm > 0.5 && res2.groundDistKm < 2.0);
  assert.ok(res2.azimuthDeg >= 0 && res2.azimuthDeg <= 360);
});

test('calculatePacketLoss computes correct loss percentage', () => {
  // 100 packets received out of 100 expected -> 0%
  assert.equal(calculatePacketLoss(100, 200, 101), 0);

  // 90 packets received out of 100 expected -> 10%
  assert.equal(calculatePacketLoss(90, 200, 101), 10);
});
