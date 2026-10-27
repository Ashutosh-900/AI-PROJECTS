/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Zap,
  RotateCw,
  Scale,
  Activity,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { TelemetryPacket, DisturbanceEvent, ConnectionMode } from '../../types/telemetry';
import { calculateNetJitter } from '../../utils/telemetryMath';

interface MotionAlertTabProps {
  packet: TelemetryPacket;
  packetHistory: TelemetryPacket[];
  connectionMode: ConnectionMode;
  jitterLimit: number;
  setJitterLimit: (v: number) => void;
  incidentLog: DisturbanceEvent[];
  isAlertState: boolean;
  tareZero: () => void;
  injectShock: () => void;
  tumbleImpulse: () => void;
}

export const MotionAlertTab: React.FC<MotionAlertTabProps> = ({
  packet,
  packetHistory,
  connectionMode,
  jitterLimit,
  setJitterLimit,
  incidentLog,
  isAlertState,
  tareZero,
  injectShock,
  tumbleImpulse,
}) => {
  const netJitter = calculateNetJitter(packet.ax, packet.ay, packet.az);
  const isTrip = netJitter > jitterLimit;

  // Chart canvas refs
  const accelCanvasRef = useRef<HTMLCanvasElement>(null);
  const gyroCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render Linear Acceleration Chart (Ax, Ay, Az)
  useEffect(() => {
    const canvas = accelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.4)';
    ctx.lineWidth = 1;

    // Zero line & 9.8m/s² 1G nominal line
    const yCenter = height * 0.75; // 0 m/s²
    const yOneG = height * 0.28;   // ~9.8 m/s²
    const yTrip = yOneG - (jitterLimit * 4.5); // Trip limit line

    // Draw horizontal grid lines
    ctx.beginPath();
    ctx.moveTo(0, yCenter);
    ctx.lineTo(width, yCenter);
    ctx.moveTo(0, yOneG);
    ctx.lineTo(width, yOneG);
    ctx.stroke();

    // Dotted amber trip threshold line
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.8)';
    ctx.setLineDash([6, 4]);
    ctx.moveTo(0, yTrip);
    ctx.lineTo(width, yTrip);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label on trip line
    ctx.fillStyle = '#f59e0b';
    ctx.font = '9px monospace';
    ctx.fillText(`+${jitterLimit.toFixed(2)} m/s² THRESHOLD`, width - 130, yTrip - 4);

    if (packetHistory.length < 2) return;

    const len = packetHistory.length;
    const step = width / Math.max(len - 1, 40);

    // Draw signals
    const drawLine = (getVal: (p: TelemetryPacket) => number, color: string, baselineY: number, scale: number) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < len; i++) {
        const x = i * step;
        const v = getVal(packetHistory[i]);
        const y = baselineY - v * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    // Scale: ~4.5 pixels per m/s²
    drawLine((p) => p.ax, '#22d3ee', yCenter, 4.5); // Ax Cyan
    drawLine((p) => p.ay, '#60a5fa', yCenter, 4.5); // Ay Blue
    drawLine((p) => p.az, '#38bdf8', yCenter, 4.5); // Az Sky
  }, [packetHistory, jitterLimit]);

  // Render Gyroscope Chart (Gx, Gy, Gz)
  useEffect(() => {
    const canvas = gyroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const yCenter = height / 2; // 0 °/s

    // Horizontal center zero line
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yCenter);
    ctx.lineTo(width, yCenter);
    ctx.stroke();

    if (packetHistory.length < 2) return;

    const len = packetHistory.length;
    const step = width / Math.max(len - 1, 40);

    const drawLine = (getVal: (p: TelemetryPacket) => number, color: string) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < len; i++) {
        const x = i * step;
        const v = getVal(packetHistory[i]);
        const y = yCenter - v * 2.0; // 2 pixels per deg/s
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawLine((p) => p.gx, '#22d3ee');
    drawLine((p) => p.gy, '#60a5fa');
    drawLine((p) => p.gz, '#a855f7');
  }, [packetHistory]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#060b14] min-h-[calc(100vh-140px)]">
      {/* Top Banner: Inertial Stability Envelope */}
      <div
        className={`w-full rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 border transition-all ${
          isTrip || isAlertState
            ? 'bg-rose-950/40 border-rose-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
            : 'bg-[#0a1326]/90 border-cyan-500/20'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
              isTrip || isAlertState
                ? 'bg-rose-950 text-rose-300 border-rose-500/50'
                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
            }`}
          >
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold tracking-wider text-white">
                INERTIAL STABILITY ENVELOPE:{' '}
                <span className={isTrip ? 'text-rose-400' : 'text-cyan-300'}>
                  {isTrip ? 'ALERT (LIMIT EXCEEDED)' : 'NOMINAL'}
                </span>
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isTrip
                    ? 'bg-rose-950 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isTrip ? 'TRIPPED' : 'STABLE'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400">
              MPU6050 Dynamic Jitter: <strong className="text-cyan-300">{netJitter.toFixed(2)} m/s²</strong> // Configured Trip Limit: <strong className="text-slate-300">{jitterLimit.toFixed(2)} m/s²</strong>
            </p>
          </div>
        </div>

        {/* Action Buttons: Shock, Tumble, Tare */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            disabled={connectionMode !== 'SIM'}
            onClick={injectShock}
            title={connectionMode !== 'SIM' ? 'Disabled in Live HW mode' : 'Inject 1.6G simulated impulse'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>INJECT SHOCK (1.6G)</span>
          </button>

          <button
            type="button"
            disabled={connectionMode !== 'SIM'}
            onClick={tumbleImpulse}
            title={connectionMode !== 'SIM' ? 'Disabled in Live HW mode' : 'Inject tumble impulse'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCw className="w-3.5 h-3.5 text-rose-400" />
            <span>TUMBLE IMPULSE</span>
          </button>

          <button
            type="button"
            onClick={tareZero}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-mono font-semibold transition-colors"
          >
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
            <span>TARE ZERO</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Charts (8 cols) & Right Displacement / Incident Log (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* ================= LEFT CHARTS (8 cols) ================= */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {/* Card 1: MPU6050 LINEAR ACCELERATION */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-200">
                  MPU6050 LINEAR ACCELERATION (M/S²)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-cyan-400">
                  Ax: {packet.ax !== undefined ? `${packet.ax.toFixed(2)}` : '--'}
                </span>
                <span className="text-blue-400">
                  Ay: {packet.ay !== undefined ? `${packet.ay.toFixed(2)}` : '--'}
                </span>
                <span className="text-sky-300">
                  Az: {packet.az !== undefined ? `${packet.az.toFixed(2)} (1G)` : '--'}
                </span>
              </div>
            </div>

            <div className="relative w-full h-[180px] my-2 bg-[#060c18] rounded-lg overflow-hidden border border-cyan-500/10">
              <canvas ref={accelCanvasRef} width={800} height={180} className="w-full h-full" />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>18:54:23</span>
              <span>18:54:33</span>
              <span>18:54:43</span>
              <span>18:54:53</span>
              <span>LIVE CURRENT</span>
            </div>
          </div>

          {/* Card 2: GYROSCOPE ANGULAR VELOCITY */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
              <div className="flex items-center gap-2">
                <RotateCw className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-200">
                  GYROSCOPE ANGULAR VELOCITY (°/S)
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="text-cyan-400">
                  Gx: {packet.gx !== undefined ? `${packet.gx.toFixed(2)}°/s` : '--'}
                </span>
                <span className="text-blue-400">
                  Gy: {packet.gy !== undefined ? `${packet.gy.toFixed(2)}°/s` : '--'}
                </span>
                <span className="text-purple-400">
                  Gz: {packet.gz !== undefined ? `${packet.gz.toFixed(2)}°/s` : '--'}
                </span>
              </div>
            </div>

            <div className="relative w-full h-[140px] my-2 bg-[#060c18] rounded-lg overflow-hidden border border-cyan-500/10">
              <canvas ref={gyroCanvasRef} width={800} height={140} className="w-full h-full" />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
              <span>18:54:23</span>
              <span>18:54:33</span>
              <span>18:54:43</span>
              <span>18:54:53</span>
              <span>LIVE CURRENT</span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: JITTER DISPLACEMENT & LOG (4 cols) ================= */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          {/* Card 1: DYNAMIC JITTER DISPLACEMENT */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
              <span className="uppercase tracking-wider">DYNAMIC JITTER DISPLACEMENT</span>
              <span className="text-slate-400">TRIP: {jitterLimit.toFixed(2)} m/s²</span>
            </div>

            <div className="my-2">
              <span
                className={`text-4xl font-bold font-mono tracking-tight ${
                  isTrip ? 'text-rose-400 glow-red' : 'text-cyan-300'
                }`}
              >
                {netJitter.toFixed(2)}
              </span>
              <span className="text-sm font-mono text-slate-400 ml-1.5">m/s²</span>
            </div>

            {/* Gauge Bar with Trip Marker */}
            <div className="relative w-full bg-[#070d1a] h-3 rounded-full overflow-hidden border border-cyan-500/20 my-3">
              <div
                className={`h-full transition-all duration-200 rounded-full ${
                  isTrip ? 'bg-rose-500' : 'bg-cyan-400'
                }`}
                style={{ width: `${Math.min(100, (netJitter / 3.0) * 100)}%` }}
              />
              {/* Trip limit red vertical marker line */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,1)]"
                style={{ left: `${(jitterLimit / 3.0) * 100}%` }}
              />
            </div>

            {/* Sensitivity Slider */}
            <div className="mt-4 pt-3 border-t border-cyan-500/10">
              <div className="flex justify-between items-center text-xs font-mono text-slate-300 mb-1">
                <span>Sensitivity Limit:</span>
                <span className="text-cyan-300 font-bold">{jitterLimit.toFixed(2)} m/s²</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.05"
                value={jitterLimit}
                onChange={(e) => setJitterLimit(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mt-1">
                <span>0.5 m/s² (Tight)</span>
                <span>3.0 m/s² (Loose)</span>
              </div>
            </div>
          </div>

          {/* Card 2: DISTURBANCE INCIDENT LOG */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
              <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
                DISTURBANCE INCIDENT LOG
              </span>
              <span className="text-[10px] font-mono text-slate-400">LAST 15 EVENTS</span>
            </div>

            <div className="mt-3 flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
              {incidentLog.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-[#070e1c] p-2.5 rounded-lg border border-cyan-500/10 flex items-center justify-between text-xs font-mono"
                >
                  <div>
                    <div className="font-semibold text-slate-200">{evt.name}</div>
                    <div className="text-[10px] text-amber-400 mt-0.5">
                      Peak: {evt.peakJitter.toFixed(2)} m/s²
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">{evt.timestamp}</div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 mt-0.5 inline-block">
                      {evt.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
