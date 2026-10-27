/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useEffect, useRef } from 'react';
import {
  Thermometer,
  Droplets,
  Gauge,
  Mountain,
  Crosshair,
  ShieldAlert,
  Radio,
  Download,
  Play,
  Pause,
  Compass,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Zap,
  RefreshCw,
  Power,
} from 'lucide-react';
import { TelemetryPacket, ConnectionState } from '../../types/telemetry';
import { calculateDewPoint, calculateNetJitter } from '../../utils/telemetryMath';
import { ThreeCubeSat } from '../ThreeCubeSat';

interface PrimaryHudTabProps {
  packet: TelemetryPacket;
  packetHistory: TelemetryPacket[];
  connectionState: ConnectionState;
  groundBaselineAlt: number;
  maxApogee: number;
  verticalSpeed: number;
  jitterLimit: number;
  isPaused: boolean;
  setIsPaused: (p: boolean) => void;
  connectSerial: () => void;
  calibrateBaseline: () => void;
  exportCSV: () => void;
  forceResetSerial?: () => void;
  pulseDTR?: () => void;
  rebootESP32?: () => void;
  injectTestPacket?: () => void;
}

export const PrimaryHudTab: React.FC<PrimaryHudTabProps> = ({
  packet,
  packetHistory,
  connectionState,
  groundBaselineAlt,
  maxApogee,
  verticalSpeed,
  jitterLimit,
  isPaused,
  setIsPaused,
  connectSerial,
  calibrateBaseline,
  exportCSV,
  forceResetSerial,
  pulseDTR,
  rebootESP32,
  injectTestPacket,
}) => {
  const dewPoint = calculateDewPoint(packet.t, packet.h);
  const netJitter = calculateNetJitter(packet.ax, packet.ay, packet.az);

  // Pressure range 980 to 1040 hPa
  const pressPct = Math.min(100, Math.max(0, ((packet.p - 980) / (1040 - 980)) * 100));

  // Canvas ref for MPU6050 real-time waveform
  const mpuCanvasRef = useRef<HTMLCanvasElement>(null);
  // Canvas ref for Temp sparkline
  const tempSparklineRef = useRef<HTMLCanvasElement>(null);

  // Render MPU6050 Inertial Chart
  useEffect(() => {
    const canvas = mpuCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.4)';
    ctx.lineWidth = 1;

    // Horizontal zero/nominal lines
    const yCenter = height / 2;
    const yOneG = height * 0.25; // 1G line (~9.8 m/s²)

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, yOneG);
    ctx.lineTo(width, yOneG);
    ctx.moveTo(0, yCenter);
    ctx.lineTo(width, yCenter);
    ctx.stroke();
    ctx.setLineDash([]);

    if (packetHistory.length < 2) return;

    const len = packetHistory.length;
    const step = width / Math.max(len - 1, 30);

    // Helper to draw a signal line
    const drawSignal = (
      getValue: (p: TelemetryPacket) => number,
      color: string,
      scale: number,
      baselineY: number
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;

      for (let i = 0; i < len; i++) {
        const x = i * step;
        const val = getValue(packetHistory[i]);
        const y = baselineY - val * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    // Draw Ax (Cyan), Ay (Blue), Az (Green/Orange)
    // Scale: ~4 pixels per m/s²
    drawSignal((p) => p.ax, '#22d3ee', 4, yCenter);
    drawSignal((p) => p.ay, '#60a5fa', 4, yCenter);
    drawSignal((p) => p.az, '#38bdf8', 2.5, yCenter + 20);
  }, [packetHistory]);

  // Render Temp Sparkline
  useEffect(() => {
    const canvas = tempSparklineRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (packetHistory.length < 2) return;

    const len = packetHistory.length;
    const step = width / Math.max(len - 1, 20);

    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < len; i++) {
      const x = i * step;
      // Normalize temp between 20°C and 30°C
      const t = packetHistory[i].t;
      const normY = height - ((t - 20) / 10) * height;
      if (i === 0) ctx.moveTo(x, normY);
      else ctx.lineTo(x, normY);
    }
    ctx.stroke();
  }, [packetHistory]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#060b14] min-h-[calc(100vh-140px)]">
      {/* Stale Recovery Quick Actions Banner */}
      {connectionState === 'STALE' && (
        <div className="bg-amber-950/80 border-2 border-amber-500/60 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-[0_0_16px_rgba(245,158,11,0.25)]">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <div>
              <span className="font-bold text-amber-300">PORT STATUS: STALE (AWAITING DATA)</span>
              <span className="text-slate-300 ml-2 hidden sm:inline text-[11px]">
                ESP32 is connected via USB, but no telemetry packets have arrived.
              </span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {pulseDTR && (
              <button
                type="button"
                onClick={pulseDTR}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded text-[11px] flex items-center gap-1 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
              >
                <Zap className="w-3 h-3" />
                <span>PULSE DTR (WAKE CDC)</span>
              </button>
            )}
            {rebootESP32 && (
              <button
                type="button"
                onClick={rebootESP32}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[11px] flex items-center gap-1"
              >
                <Power className="w-3 h-3" />
                <span>REBOOT ESP32</span>
              </button>
            )}
            {forceResetSerial && (
              <button
                type="button"
                onClick={forceResetSerial}
                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded text-[11px] flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>RESET PORT LOCKS</span>
              </button>
            )}
            {injectTestPacket && (
              <button
                type="button"
                onClick={injectTestPacket}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[11px] flex items-center gap-1"
              >
                <span>TEST PACKET</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* ================= LEFT COLUMN: 4 SENSOR CARDS (3 cols) ================= */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Card 1: DHT11 TEMP */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400">
                <Thermometer className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
                  DHT11 TEMP
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                NOMINAL
              </span>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <div className="text-3xl font-bold font-mono tracking-tight text-white">
                {packet.t !== undefined ? `${packet.t.toFixed(1)}°C` : '--'}
              </div>
              <div className="text-right text-[10px] font-mono text-slate-400">
                <div>MAX: 26.1°C</div>
                <div>MIN: 22.8°C</div>
              </div>
            </div>

            {/* Sparkline Canvas */}
            <div className="w-full h-8 bg-[#070d1a] rounded overflow-hidden p-1 border border-cyan-500/10">
              <canvas ref={tempSparklineRef} width={260} height={32} className="w-full h-full" />
            </div>
          </div>

          {/* Card 2: DHT11 HUMIDITY */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400">
                <Droplets className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
                  DHT11 HUMIDITY
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/30">
                STABLE
              </span>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <div className="text-3xl font-bold font-mono tracking-tight text-white">
                {packet.h !== undefined ? `${packet.h.toFixed(1)}%` : '--'}
              </div>
              <div className="text-right text-[10px] font-mono text-cyan-400">
                DEW PT: {dewPoint}°C
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#070d1a] h-2 rounded-full overflow-hidden border border-cyan-500/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${packet.h || 0}%` }}
              />
            </div>
          </div>

          {/* Card 3: BMP280 PRESSURE */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400">
                <Gauge className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
                  BMP280 PRESSURE
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                MSLP 1.01 BAR
              </span>
            </div>

            <div className="my-2 text-3xl font-bold font-mono tracking-tight text-white">
              {packet.p !== undefined ? `${packet.p.toFixed(2)}` : '--'}{' '}
              <span className="text-sm font-normal text-slate-400">hPa</span>
            </div>

            {/* Range bar 980 - 1040 hPa */}
            <div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>980 hPa</span>
                <span>1040 hPa</span>
              </div>
              <div className="w-full bg-[#070d1a] h-1.5 rounded-full overflow-hidden border border-cyan-500/10">
                <div
                  className="h-full bg-cyan-400 transition-all duration-300"
                  style={{ width: `${pressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 4: BARO ALTITUDE (AGL) */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400">
                <Mountain className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
                  BARO ALTITUDE (AGL)
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">REL OM GORAKHPUR</span>
            </div>

            <div className="my-2 flex items-baseline justify-between">
              <div className="text-3xl font-bold font-mono tracking-tight text-cyan-300">
                {packet.alt !== undefined ? `${packet.alt.toFixed(1)}` : '--'}
                <span className="text-sm font-normal text-slate-400 ml-1">m</span>
              </div>
              <div className="flex items-center gap-1 text-xs font-mono text-emerald-400">
                {verticalSpeed >= 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                <span>
                  {verticalSpeed >= 0 ? `+${verticalSpeed.toFixed(1)}` : verticalSpeed.toFixed(1)} m/s
                </span>
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-400 border-t border-cyan-500/10 pt-1.5">
              <span>BASELINE GROUND: {groundBaselineAlt.toFixed(1)} m</span>
              <span>MAX APOGEE: {maxApogee.toFixed(1)} m</span>
            </div>
          </div>
        </div>

        {/* ================= CENTER COLUMN: 3D DIGITAL TWIN + ATTITUDE TILES + MPU CHART (6 cols) ================= */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* 3D Attitude Digital Twin Panel */}
          <ThreeCubeSat
            roll={packet.r || 0}
            pitch={packet.pt || 0}
            yaw={packet.y || 0}
            gx={packet.gx || 0}
            gy={packet.gy || 0}
            gz={packet.gz || 0}
            isSynced={!isPaused}
          />

          {/* 3 Tiles: Roll [X], Pitch [Y], Yaw [Z] */}
          <div className="grid grid-cols-3 gap-3">
            {/* Roll [X] */}
            <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-red-400 block mb-1">
                ROLL [X]
              </span>
              <span className="text-2xl font-bold font-mono text-white block">
                {packet.r !== undefined ? `${packet.r > 0 ? '+' : ''}${packet.r.toFixed(1)}°` : '--'}
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                VEL: {packet.gx !== undefined ? `${packet.gx > 0 ? '+' : ''}${packet.gx.toFixed(2)}°/s` : '--'}
              </span>
            </div>

            {/* Pitch [Y] */}
            <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-1">
                PITCH [Y]
              </span>
              <span className="text-2xl font-bold font-mono text-white block">
                {packet.pt !== undefined ? `${packet.pt > 0 ? '+' : ''}${packet.pt.toFixed(1)}°` : '--'}
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                VEL: {packet.gy !== undefined ? `${packet.gy > 0 ? '+' : ''}${packet.gy.toFixed(2)}°/s` : '--'}
              </span>
            </div>

            {/* Yaw [Z] */}
            <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3 text-center">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 block mb-1">
                YAW [Z]
              </span>
              <span className="text-2xl font-bold font-mono text-white block">
                {packet.y !== undefined ? `${packet.y.toFixed(1)}°` : '--'}
              </span>
              <span className="text-[10px] font-mono text-slate-400 mt-1 block">
                VEL: {packet.gz !== undefined ? `${packet.gz > 0 ? '+' : ''}${packet.gz.toFixed(2)}°/s` : '--'}
              </span>
            </div>
          </div>

          {/* MPU6050 Inertial Dynamics Real-Time Chart */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold tracking-wider text-cyan-300">
                  MPU6050 INERTIAL MOTION DYNAMICS
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-cyan-400">
                  — Ax: {packet.ax !== undefined ? `${packet.ax.toFixed(2)} m/s²` : '--'}
                </span>
                <span className="text-blue-400">
                  — Ay: {packet.ay !== undefined ? `${packet.ay.toFixed(2)} m/s²` : '--'}
                </span>
                <span className="text-sky-300">
                  — Az: {packet.az !== undefined ? `${packet.az.toFixed(2)} m/s² (1G)` : '--'}
                </span>
              </div>
            </div>

            <div className="relative w-full h-[95px] my-2 bg-[#060c18] rounded overflow-hidden border border-cyan-500/10">
              <canvas ref={mpuCanvasRef} width={580} height={95} className="w-full h-full" />
            </div>

            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span>-30s TIME BUFFER</span>
              <span>BUFFER FREQ: 50Hz ODR</span>
              <span>LIVE CURRENT (T=0)</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: NEO-6M GPS & MOTION THRESHOLD (3 cols) ================= */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Card 1: NEO-6M GPS ENGINE */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400">
                <Crosshair className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
                  NEO-6M GPS ENGINE
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  packet.fix === 1
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30'
                    : 'bg-rose-950/80 text-rose-300 border-rose-500/30'
                }`}
              >
                {packet.fix === 1 ? '3D DGPS FIX' : 'NO FIX'}
              </span>
            </div>

            {/* Mini Radar Scope Display */}
            <div className="relative w-full h-32 bg-[#060b14] rounded-lg border border-cyan-500/20 flex items-center justify-center overflow-hidden">
              {/* Radar concentric rings */}
              <div className="absolute inset-2 rounded-full border border-cyan-500/20" />
              <div className="absolute inset-8 rounded-full border border-cyan-500/30" />
              <div className="absolute inset-14 rounded-full border border-cyan-500/40" />

              {/* Crosshair lines */}
              <div className="absolute inset-x-0 top-1/2 h-[1px] bg-cyan-500/20" />
              <div className="absolute inset-y-0 left-1/2 w-[1px] bg-cyan-500/20" />

              {/* Sweeping Radar Wedge */}
              <div className="absolute inset-0 animate-radar pointer-events-none">
                <div className="w-1/2 h-1/2 origin-bottom-right bg-gradient-to-br from-cyan-400/30 via-cyan-500/10 to-transparent" />
              </div>

              {/* Ground Station Center Marker */}
              <div className="absolute z-10 flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <span className="text-[8px] font-mono text-cyan-300 mt-0.5">GS: MMMUT</span>
              </div>

              {/* CubeSat Position Dot */}
              <div className="absolute top-6 right-10 z-10 flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
                <span className="text-[9px] font-mono text-indigo-300 font-bold bg-[#070e1c]/80 px-1 py-0.5 rounded">
                  CUBESAT (AZ: 54°)
                </span>
              </div>
            </div>

            {/* GPS Metrics 2x2 Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block">LATITUDE</span>
                <span className="font-semibold text-slate-100">
                  {packet.lat !== undefined ? `${packet.lat.toFixed(4)}° N` : '--'}
                </span>
              </div>

              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block">LONGITUDE</span>
                <span className="font-semibold text-slate-100">
                  {packet.lon !== undefined ? `${packet.lon.toFixed(4)}° E` : '--'}
                </span>
              </div>

              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block">GPS ALTITUDE</span>
                <span className="font-semibold text-slate-100">
                  {packet.galt !== undefined ? `${packet.galt.toFixed(1)} m` : '--'}
                </span>
              </div>

              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block">SATS IN VIEW</span>
                <span className="font-semibold text-cyan-400">
                  {packet.sats !== undefined ? `${packet.sats} LOCKED` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: MOTION THRESHOLD MONITOR */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400">
                <ShieldAlert className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
                  MOTION THRESHOLD MONITOR
                </span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  netJitter > jitterLimit
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30'
                }`}
              >
                {netJitter > jitterLimit ? 'ALERT' : 'NOMINAL'}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 my-2 leading-relaxed">
              Tri-axial dynamic deviation remains within nominal bounds (&lt; {jitterLimit.toFixed(2)} m/s²). Internal damping and gyroscopic orientation stabilized.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono border-t border-cyan-500/10 pt-2">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase">CURRENT NET JITTER</span>
                <span
                  className={`text-lg font-bold ${
                    netJitter > jitterLimit ? 'text-rose-400' : 'text-slate-100'
                  }`}
                >
                  {netJitter.toFixed(2)} m/s²
                </span>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-slate-500 block uppercase">DISPLACEMENT LIMIT</span>
                <span className="text-lg font-bold text-cyan-300">{jitterLimit.toFixed(2)} m/s²</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM BAR: GROUND STATION UPLINK & TELEMETRY CONTROLS ================= */}
      <div className="w-full bg-[#0a1224]/90 border border-cyan-500/20 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase font-bold tracking-wider text-cyan-300">
            GROUND STATION UPLINK & TELEMETRY CONTROLS
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={connectSerial}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold tracking-wider shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-all"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>CONNECT SERIAL PORT</span>
          </button>

          {forceResetSerial && (
            <button
              type="button"
              onClick={forceResetSerial}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-500/50 hover:bg-rose-950/30 text-slate-300 hover:text-rose-200 text-xs font-mono transition-colors"
              title="Clears hung ports and releases locked streams"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
              <span>RESET SERIAL</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-white text-xs font-mono transition-colors"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isPaused ? 'RESUME STREAM' : 'PAUSE STREAM'}</span>
          </button>

          <button
            type="button"
            onClick={calibrateBaseline}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-white text-xs font-mono transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>CALIBRATE BASELINE</span>
          </button>

          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-white text-xs font-mono transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>EXPORT CSV (RAW)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
