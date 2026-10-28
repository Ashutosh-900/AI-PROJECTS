/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Thermometer,
  Droplets,
  Gauge,
  Mountain,
  Crosshair,
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
  Activity,
  Layers,
  Satellite,
  Wifi,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { TelemetryPacket, ConnectionState, CONFIG } from '../../types/telemetry';
import { calculateDewPoint, calculateDistanceAndAzEl } from '../../utils/telemetryMath';
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
  jitterLimit: _jitterLimit,
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

  // Dynamic barometric altitude AGL (relative to ground baseline)
  const baroAgl = packet.alt !== undefined ? Number((packet.alt - groundBaselineAlt).toFixed(1)) : 0.0;

  // Pressure calculation
  const pressPct = Math.min(100, Math.max(0, (((packet.p || 1013.25) - 980) / (1040 - 980)) * 100));

  // Dynamic ephemeris and radar geometry relative to MMMUT Ground Station
  const geom = calculateDistanceAndAzEl(
    CONFIG.GS_LAT,
    CONFIG.GS_LON,
    CONFIG.GS_ALT,
    packet.lat ?? CONFIG.GS_LAT,
    packet.lon ?? CONFIG.GS_LON,
    packet.galt ?? CONFIG.GS_ALT
  );

  // Dynamic Doppler shift estimate from vertical rate
  const dopplerShiftKHz = Number(((-verticalSpeed * 433.0) / 300000).toFixed(2));

  // Dynamic Temperature stats from real packet history
  const tempHistory = packetHistory.map((p) => p.t).filter((v) => v !== undefined && !isNaN(v));
  const maxTemp = tempHistory.length > 0 ? Math.max(...tempHistory) : (packet.t ?? 24.5);
  const minTemp = tempHistory.length > 0 ? Math.min(...tempHistory) : (packet.t ?? 24.5);

  // Mini Radar polar coordinates (max radius: 46px within 128px container)
  const elNorm = Math.max(0, 90 - geom.elevationDeg) / 90;
  const radarRadius = elNorm * 44;
  const azRad = ((geom.azimuthDeg - 90) * Math.PI) / 180;
  const radarDotX = radarRadius * Math.cos(azRad);
  const radarDotY = radarRadius * Math.sin(azRad);

  // Advanced Oscilloscope state: Channel selector & Time buffer
  const [graphMode, setGraphMode] = useState<'accel' | 'gyro' | 'baro' | 'composite'>('accel');
  const [timeBufferSecs, setTimeBufferSecs] = useState<number>(30);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Canvas ref for Modern Real-Time Waveform
  const mpuCanvasRef = useRef<HTMLCanvasElement>(null);
  // Canvas ref for Temp sparkline
  const tempSparklineRef = useRef<HTMLCanvasElement>(null);

  // Render Modern Advanced Telemetry Oscilloscope
  useEffect(() => {
    const canvas = mpuCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark high-contrast aerospace grid backdrop
    ctx.fillStyle = '#050a14';
    ctx.fillRect(0, 0, width, height);

    // Grid styling
    ctx.strokeStyle = 'rgba(14, 116, 144, 0.25)';
    ctx.lineWidth = 1;

    // Horizontal grid divisions (5 rows)
    const rows = 4;
    for (let r = 1; r <= rows; r++) {
      const y = (height / (rows + 1)) * r;
      ctx.beginPath();
      ctx.setLineDash([3, 4]);
      ctx.moveTo(35, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical time division grid lines (8 columns)
    const cols = 7;
    for (let c = 1; c <= cols; c++) {
      const x = 35 + ((width - 35) / (cols + 1)) * c;
      ctx.beginPath();
      ctx.setLineDash([2, 5]);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Y-Axis zero/nominal baseline
    const yCenter = height / 2;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(35, yCenter);
    ctx.lineTo(width, yCenter);
    ctx.stroke();

    // Axis scale labels column on the left
    ctx.fillStyle = '#64748b';
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    if (graphMode === 'accel') {
      ctx.fillText('+15', 30, height * 0.16);
      ctx.fillText('+1G', 30, height * 0.32);
      ctx.fillText('0', 30, yCenter + 3);
      ctx.fillText('-15', 30, height * 0.84);
    } else if (graphMode === 'gyro') {
      ctx.fillText('+40°', 30, height * 0.18);
      ctx.fillText('0°', 30, yCenter + 3);
      ctx.fillText('-40°', 30, height * 0.82);
    } else if (graphMode === 'baro') {
      ctx.fillText('MAX', 30, height * 0.18);
      ctx.fillText('MID', 30, yCenter + 3);
      ctx.fillText('BASE', 30, height * 0.82);
    } else {
      ctx.fillText('+MAX', 30, height * 0.18);
      ctx.fillText('REF', 30, yCenter + 3);
      ctx.fillText('-MIN', 30, height * 0.82);
    }

    if (packetHistory.length < 2) return;

    // Filter buffer based on time window (sample count approx timeBufferSecs * 2 packets/s or slice)
    const maxSamples = Math.min(packetHistory.length, timeBufferSecs * 3);
    const dataSlice = packetHistory.slice(-maxSamples);
    const len = dataSlice.length;
    const chartWidth = width - 40;
    const step = chartWidth / Math.max(len - 1, 15);

    // Advanced Signal Drawer with Luminous Stroke and Gradient Fill
    const drawStream = (
      getVal: (p: TelemetryPacket, index: number) => number,
      strokeColor: string,
      glowColor: string,
      fillColorTop: string,
      scale: number,
      baselineY: number,
      offsetVal: number = 0
    ) => {
      // First pass: Translucent Area Fill below curve
      const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
      areaGrad.addColorStop(0, fillColorTop);
      areaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.fillStyle = areaGrad;
      for (let i = 0; i < len; i++) {
        const item = dataSlice[i];
        if (!item) continue;
        const x = 38 + i * step;
        const rawVal = getVal(item, i);
        const v = (isNaN(rawVal) ? 0 : rawVal) - offsetVal;
        const y = Math.min(height - 4, Math.max(4, baselineY - v * scale));
        if (i === 0) {
          ctx.moveTo(x, baselineY);
          ctx.lineTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(38 + (len - 1) * step, baselineY);
      ctx.closePath();
      ctx.fill();

      // Second pass: Luminous neon stroke
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;

      let lastX = 38;
      let lastY = baselineY;

      for (let i = 0; i < len; i++) {
        const item = dataSlice[i];
        if (!item) continue;
        const x = 38 + i * step;
        const rawVal = getVal(item, i);
        const v = (isNaN(rawVal) ? 0 : rawVal) - offsetVal;
        const y = Math.min(height - 4, Math.max(4, baselineY - v * scale));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        lastX = x;
        lastY = y;
      }
      ctx.stroke();
      ctx.restore();

      // Glowing current-point reticle at head (T=0)
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 10;
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    if (graphMode === 'accel') {
      // Ax (Cyan), Ay (Blue), Az (Sky) - Triaxial Acceleration
      drawStream((p) => p.ax, '#22d3ee', 'rgba(34, 211, 238, 0.8)', 'rgba(34, 211, 238, 0.15)', 4.2, yCenter);
      drawStream((p) => p.ay, '#60a5fa', 'rgba(96, 165, 250, 0.8)', 'rgba(96, 165, 250, 0.12)', 4.2, yCenter);
      drawStream((p) => p.az, '#38bdf8', 'rgba(56, 189, 248, 0.8)', 'rgba(56, 189, 248, 0.12)', 3.2, yCenter, 9.81);
    } else if (graphMode === 'gyro') {
      // Gx (Emerald), Gy (Cyan), Gz (Purple) - Angular Velocity
      drawStream((p) => p.gx, '#34d399', 'rgba(52, 211, 153, 0.8)', 'rgba(52, 211, 153, 0.15)', 1.8, yCenter);
      drawStream((p) => p.gy, '#22d3ee', 'rgba(34, 211, 238, 0.8)', 'rgba(34, 211, 238, 0.12)', 1.8, yCenter);
      drawStream((p) => p.gz, '#c084fc', 'rgba(192, 132, 252, 0.8)', 'rgba(192, 132, 252, 0.12)', 1.8, yCenter);
    } else if (graphMode === 'baro') {
      // Baro Altitude & Dynamic Vertical Speed
      drawStream((p) => p.alt - groundBaselineAlt, '#38bdf8', 'rgba(56, 189, 248, 0.8)', 'rgba(56, 189, 248, 0.18)', 1.5, height * 0.75);
      drawStream(
        (p, i) => {
          if (typeof i !== 'number' || i <= 0 || !dataSlice[i - 1]) return verticalSpeed;
          const prevP = dataSlice[i - 1];
          const pTime = p?.timestamp ?? 0;
          const prevTime = prevP?.timestamp ?? 0;
          const dt = (pTime > 0 && prevTime > 0) ? (pTime - prevTime) / 1000 : 0.1;
          return (dt > 0.02 && p.alt !== undefined && prevP.alt !== undefined)
            ? (p.alt - prevP.alt) / dt
            : verticalSpeed;
        },
        '#f59e0b',
        'rgba(245, 158, 11, 0.8)',
        'rgba(245, 158, 11, 0.15)',
        8.0,
        yCenter
      );
    } else {
      // Composite Multi-Stream View
      drawStream((p) => p.ax, '#22d3ee', 'rgba(34, 211, 238, 0.8)', 'rgba(34, 211, 238, 0.12)', 3.5, yCenter);
      drawStream((p) => p.gx, '#a855f7', 'rgba(168, 85, 247, 0.8)', 'rgba(168, 85, 247, 0.12)', 1.2, yCenter);
      drawStream((p) => (p.alt - groundBaselineAlt) * 0.5, '#38bdf8', 'rgba(56, 189, 248, 0.8)', 'rgba(56, 189, 248, 0.1)', 0.8, yCenter);
    }

    // Hover inspection cursor crosshair if active
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < len) {
      const hoverX = 38 + hoverIndex * step;
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [packetHistory, graphMode, timeBufferSecs, groundBaselineAlt, verticalSpeed, hoverIndex]);

  // Render Temp Sparkline (Dynamically scaled to historical min & max)
  useEffect(() => {
    const canvas = tempSparklineRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (tempHistory.length < 2) return;

    const len = tempHistory.length;
    const step = width / Math.max(len - 1, 20);

    const minT = Math.min(...tempHistory);
    const maxT = Math.max(...tempHistory);
    const rangeT = maxT === minT ? 2.0 : maxT - minT;

    ctx.beginPath();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;

    for (let i = 0; i < len; i++) {
      const x = i * step;
      const t = tempHistory[i];
      const normY = height - 4 - ((t - minT) / rangeT) * (height - 8);
      if (i === 0) ctx.moveTo(x, normY);
      else ctx.lineTo(x, normY);
    }
    ctx.stroke();
  }, [tempHistory]);

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
                <div>MAX: <span className="text-slate-200">{maxTemp.toFixed(1)}°C</span></div>
                <div>MIN: <span className="text-slate-200">{minTemp.toFixed(1)}°C</span></div>
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
                DEW PT: {dewPoint !== 0 || packet.h > 0 ? `${dewPoint.toFixed(1)}°C` : '--'}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-[#070d1a] h-2 rounded-full overflow-hidden border border-cyan-500/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, packet.h || 0))}%` }}
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
                {packet.p !== undefined ? `${(packet.p / 1000).toFixed(3)} BAR` : 'MSLP 1.01 BAR'}
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
                {packet.alt !== undefined ? baroAgl.toFixed(1) : '--'}
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

          {/* ================= ADVANCED MODERN TELEMETRY OSCILLOSCOPE ================= */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_25px_rgba(0,0,0,0.4)]">
            {/* Header: Mode Switches, Channel Toggles, and Live Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-cyan-500/15">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold tracking-wider text-cyan-300">
                  ADVANCED TELEMETRY OSCILLOSCOPE
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                  50 Hz REAL-TIME
                </span>
              </div>

              {/* Channel Mode Buttons */}
              <div className="flex items-center gap-1 bg-[#060b16] p-0.5 rounded-lg border border-cyan-500/20 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setGraphMode('accel')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    graphMode === 'accel'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ACCEL [Ax,Ay,Az]
                </button>
                <button
                  type="button"
                  onClick={() => setGraphMode('gyro')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    graphMode === 'gyro'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  GYRO [Gx,Gy,Gz]
                </button>
                <button
                  type="button"
                  onClick={() => setGraphMode('baro')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    graphMode === 'baro'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  BARO [Alt,Vz]
                </button>
                <button
                  type="button"
                  onClick={() => setGraphMode('composite')}
                  className={`px-2 py-0.5 rounded transition-all ${
                    graphMode === 'composite'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  COMPOSITE
                </button>
              </div>

              {/* Time Buffer Selector */}
              <div className="flex items-center gap-1 bg-[#060b16] p-0.5 rounded-lg border border-cyan-500/20 text-[9px] font-mono">
                {[15, 30, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setTimeBufferSecs(sec)}
                    className={`px-1.5 py-0.5 rounded ${
                      timeBufferSecs === sec
                        ? 'bg-slate-700 text-cyan-300 font-semibold'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {sec}S
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Value Readout Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono py-1.5 px-2 bg-[#060c18]/80 rounded-md border border-cyan-500/10 my-1.5">
              {graphMode === 'accel' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    <span className="text-slate-400">Ax:</span>
                    <strong className="text-cyan-300">{packet.ax !== undefined ? `${packet.ax.toFixed(2)} m/s²` : '--'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
                    <span className="text-slate-400">Ay:</span>
                    <strong className="text-blue-300">{packet.ay !== undefined ? `${packet.ay.toFixed(2)} m/s²` : '--'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-300 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                    <span className="text-slate-400">Az (1G Ref):</span>
                    <strong className="text-sky-200">{packet.az !== undefined ? `${packet.az.toFixed(2)} m/s²` : '--'}</strong>
                  </div>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    CALIBRATED 1G OFFSET
                  </span>
                </>
              )}
              {graphMode === 'gyro' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                    <span className="text-slate-400">Gx:</span>
                    <strong className="text-emerald-300">{packet.gx !== undefined ? `${packet.gx.toFixed(2)}°/s` : '--'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                    <span className="text-slate-400">Gy:</span>
                    <strong className="text-cyan-300">{packet.gy !== undefined ? `${packet.gy.toFixed(2)}°/s` : '--'}</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
                    <span className="text-slate-400">Gz:</span>
                    <strong className="text-purple-300">{packet.gz !== undefined ? `${packet.gz.toFixed(2)}°/s` : '--'}</strong>
                  </div>
                  <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                    MPU6050 DMP SYNC
                  </span>
                </>
              )}
              {graphMode === 'baro' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                    <span className="text-slate-400">ALT AGL:</span>
                    <strong className="text-sky-300">{(packet.alt - groundBaselineAlt).toFixed(1)} m</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
                    <span className="text-slate-400">VERT SPEED:</span>
                    <strong className="text-amber-300">{verticalSpeed >= 0 ? `+${verticalSpeed.toFixed(1)}` : verticalSpeed.toFixed(1)} m/s</strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">PRESSURE:</span>
                    <strong className="text-slate-200">{packet.p.toFixed(1)} hPa</strong>
                  </div>
                  <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                    BMP280 HYPSOMETRIC
                  </span>
                </>
              )}
              {graphMode === 'composite' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-slate-400">ACCEL</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-slate-400">GYRO</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <span className="text-slate-400">ALTITUDE</span>
                  </div>
                  <span className="text-[10px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                    NORMALIZED TELEMETRY BUS
                  </span>
                </>
              )}
            </div>

            {/* Canvas Oscilloscope Waveform */}
            <div
              className="relative w-full h-[120px] bg-[#050a14] rounded-lg overflow-hidden border border-cyan-500/25 shadow-inner cursor-crosshair"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left - 38;
                const maxSamples = Math.min(packetHistory.length, timeBufferSecs * 3);
                if (maxSamples > 1) {
                  const chartW = rect.width - 40;
                  const idx = Math.round((x / chartW) * (maxSamples - 1));
                  setHoverIndex(Math.max(0, Math.min(maxSamples - 1, idx)));
                }
              }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <canvas ref={mpuCanvasRef} width={640} height={120} className="w-full h-full" />

              {/* Hover Inspection Dynamic Readout Pill */}
              {hoverIndex !== null && packetHistory.length > 0 && (() => {
                const maxSamples = Math.min(packetHistory.length, timeBufferSecs * 3);
                const dataSlice = packetHistory.slice(-maxSamples);
                const sample = dataSlice[hoverIndex];
                if (!sample) return null;
                return (
                  <div className="absolute top-2 right-2 bg-[#050d1e]/95 border border-cyan-500/40 px-2.5 py-1 rounded-md text-[10px] font-mono text-slate-200 shadow-[0_0_12px_rgba(0,0,0,0.8)] pointer-events-none z-10 flex items-center gap-2">
                    <span className="text-cyan-400 font-bold">PKT #{sample.id ?? hoverIndex}:</span>
                    {graphMode === 'accel' && (
                      <span>
                        Ax: <strong className="text-cyan-300">{sample.ax?.toFixed(2)}</strong> Ay: <strong className="text-blue-300">{sample.ay?.toFixed(2)}</strong> Az: <strong className="text-sky-200">{sample.az?.toFixed(2)}</strong> m/s²
                      </span>
                    )}
                    {graphMode === 'gyro' && (
                      <span>
                        Gx: <strong className="text-emerald-300">{sample.gx?.toFixed(2)}</strong> Gy: <strong className="text-cyan-300">{sample.gy?.toFixed(2)}</strong> Gz: <strong className="text-purple-300">{sample.gz?.toFixed(2)}</strong> °/s
                      </span>
                    )}
                    {graphMode === 'baro' && (
                      <span>
                        AGL: <strong className="text-sky-300">{(sample.alt - groundBaselineAlt).toFixed(1)}m</strong> P: <strong className="text-slate-200">{sample.p?.toFixed(1)}hPa</strong>
                      </span>
                    )}
                    {graphMode === 'composite' && (
                      <span>
                        Ax: <strong className="text-cyan-300">{sample.ax?.toFixed(1)}</strong> Gx: <strong className="text-purple-300">{sample.gx?.toFixed(1)}</strong> Alt: <strong className="text-sky-300">{(sample.alt - groundBaselineAlt).toFixed(1)}m</strong>
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Bottom Aerospace Status Readout */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2 px-1">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>-{timeBufferSecs}s SLIDING WINDOW</span>
              </span>
              <span>SAMPLING: 50 Hz ODR // DMA BUFFERED</span>
              <span className="text-cyan-300 font-semibold">T=0 (LIVE VECTOR HEAD)</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: NEO-6M GPS & GROUND STATION TRACKING LINK (3 cols) ================= */}
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

              {/* CubeSat Dynamic Position Dot based on live Azimuth & Elevation */}
              <div
                className="absolute z-10 flex items-center gap-1 transition-all duration-300"
                style={{
                  transform: `translate(${radarDotX}px, ${radarDotY}px)`,
                }}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                <span className="text-[9px] font-mono text-indigo-300 font-bold bg-[#070e1c]/90 px-1 py-0.5 rounded border border-indigo-500/30 whitespace-nowrap">
                  CUBESAT ({geom.azimuthDeg}°, {geom.elevationDeg}°)
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

          {/* Card 2: ORBITAL VECTOR & GROUND STATION TRACKING LINK (Replaces Motion Tracker) */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
              <div className="flex items-center gap-2 text-cyan-400">
                <Satellite className="w-4 h-4" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-300">
                  GS TRACKING & LINK TELEMETRY
                </span>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {connectionState === 'CONNECTED' ? 'CARRIER LOCK' : connectionState === 'DEMO' ? 'SIM LOCK' : 'AWAITING LOCK'}
              </span>
            </div>

            {/* GS Anchor Info */}
            <div className="my-2 p-2 bg-[#060c18] rounded-lg border border-cyan-500/10 text-xs font-mono">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>GROUND STATION:</span>
                <span className="text-cyan-300 font-bold">MMMUT GORAKHPUR (GS-1)</span>
              </div>
              <div className="flex items-center justify-between text-[9px] text-slate-500">
                <span>DATUM: WGS-84</span>
                <span>26.7324° N, 83.4332° E</span>
              </div>
            </div>

            {/* Ephemeris Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">AZIMUTH / ELEV</span>
                <span className="font-bold text-cyan-300">{geom.azimuthDeg}° // {geom.elevationDeg}°</span>
              </div>
              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">SLANT RANGE</span>
                <span className="font-bold text-slate-100">{geom.slantDistKm} km</span>
              </div>
              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">DOPPLER SHIFT</span>
                <span className="font-bold text-emerald-400">
                  {dopplerShiftKHz >= 0 ? `+${dopplerShiftKHz}` : dopplerShiftKHz} kHz
                </span>
              </div>
              <div className="bg-[#070e1c]/80 p-2 rounded border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">LINK SNR</span>
                <span className="font-bold text-cyan-300">
                  {connectionState === 'CONNECTED' ? '32.4 dB (100%)' : connectionState === 'DEMO' ? '28.4 dB (99.8%)' : '0.0 dB (OFFLINE)'}
                </span>
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
