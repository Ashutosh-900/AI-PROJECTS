/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Activity,
  Thermometer,
  Droplets,
  Gauge,
  Mountain,
  Compass,
  RotateCw,
  Satellite,
  Play,
  Pause,
  Clock,
} from 'lucide-react';
import { TelemetryPacket } from '../../types/telemetry';

interface DiagnosticsGraphsTabProps {
  packetHistory: TelemetryPacket[];
  currentPacket: TelemetryPacket;
  isPaused: boolean;
  setIsPaused: (p: boolean) => void;
}

interface MetricChartCardProps {
  title: string;
  icon: React.ReactNode;
  health: 'OK' | 'STALE' | 'NO DATA';
  min: number;
  max: number;
  avg: number;
  unit: string;
  lines: {
    label: string;
    color: string;
    data: number[];
  }[];
}

const MetricChartCard: React.FC<MetricChartCardProps> = ({
  title,
  icon,
  health,
  min,
  max,
  avg,
  unit,
  lines,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.25);
    ctx.lineTo(width, height * 0.25);
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();

    // Find all values to determine range
    let allVals: number[] = [];
    lines.forEach((l) => {
      allVals = allVals.concat(l.data.filter((v) => !isNaN(v)));
    });

    if (allVals.length === 0) return;

    let localMin = Math.min(...allVals);
    let localMax = Math.max(...allVals);
    if (localMax === localMin) {
      localMax += 1;
      localMin -= 1;
    }
    const range = localMax - localMin;

    lines.forEach((line) => {
      if (line.data.length < 2) return;
      const len = line.data.length;
      const step = width / Math.max(len - 1, 10);

      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 1.8;

      for (let i = 0; i < len; i++) {
        const x = i * step;
        const v = line.data[i];
        const norm = (v - localMin) / range;
        const y = height - 8 - norm * (height - 16);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
  }, [lines]);

  return (
    <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-3.5 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-mono font-semibold tracking-wider text-slate-200">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
              health === 'OK'
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/30'
                : health === 'STALE'
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/30'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/30'
            }`}
          >
            {health}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full h-[110px] my-2 bg-[#060c18] rounded overflow-hidden border border-cyan-500/10">
        <canvas ref={canvasRef} width={400} height={110} className="w-full h-full" />
      </div>

      {/* Legend & Stats */}
      <div className="flex items-center justify-between text-[10px] font-mono border-t border-cyan-500/10 pt-2">
        <div className="flex items-center gap-2">
          {lines.map((l) => (
            <span key={l.label} style={{ color: l.color }}>
              ● {l.label}
            </span>
          ))}
        </div>
        <div className="text-slate-400 flex items-center gap-2">
          <span>MIN: <strong className="text-slate-200">{min.toFixed(1)}</strong></span>
          <span>MAX: <strong className="text-slate-200">{max.toFixed(1)}</strong></span>
          <span>AVG: <strong className="text-cyan-300">{avg.toFixed(1)}{unit}</strong></span>
        </div>
      </div>
    </div>
  );
};

export const DiagnosticsGraphsTab: React.FC<DiagnosticsGraphsTabProps> = ({
  packetHistory,
  currentPacket,
  isPaused,
  setIsPaused,
}) => {
  const [timeWindow, setTimeWindow] = useState<'30s' | '2m' | '10m'>('30s');

  // Filter history based on time window
  const windowCount = timeWindow === '30s' ? 30 : timeWindow === '2m' ? 60 : 120;
  const filteredData = packetHistory.slice(-windowCount);

  // Helper stats computer
  const computeStats = (vals: number[]) => {
    if (vals.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { min, max, avg };
  };

  const tempVals = filteredData.map((p) => p.t);
  const humVals = filteredData.map((p) => p.h);
  const pressVals = filteredData.map((p) => p.p);
  const baroAltVals = filteredData.map((p) => p.alt);
  const gpsAltVals = filteredData.map((p) => p.galt);
  const rollVals = filteredData.map((p) => p.r);
  const pitchVals = filteredData.map((p) => p.pt);
  const yawVals = filteredData.map((p) => p.y);
  const axVals = filteredData.map((p) => p.ax);
  const ayVals = filteredData.map((p) => p.ay);
  const azVals = filteredData.map((p) => p.az);
  const gxVals = filteredData.map((p) => p.gx);
  const gyVals = filteredData.map((p) => p.gy);
  const gzVals = filteredData.map((p) => p.gz);
  const satsVals = filteredData.map((p) => p.sats);

  const tempStats = computeStats(tempVals);
  const humStats = computeStats(humVals);
  const pressStats = computeStats(pressVals);
  const altStats = computeStats(baroAltVals);
  const rollStats = computeStats(rollVals);
  const accelStats = computeStats(azVals);
  const gyroStats = computeStats(gxVals);
  const satsStats = computeStats(satsVals);

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#060b14] min-h-[calc(100vh-140px)]">
      {/* Control Bar: Time window selector and pause */}
      <div className="w-full bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            SENSOR DIAGNOSTICS & TELEMETRY TIME-SERIES
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
            50 Hz CAPABLE
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Window Buttons */}
          <div className="flex items-center gap-1 bg-[#070e1c] p-1 rounded-lg border border-cyan-500/20">
            {(['30s', '2m', '10m'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setTimeWindow(w)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  timeWindow === w
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 text-xs font-mono transition-colors"
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
            <span>{isPaused ? 'RESUME' : 'PAUSE'}</span>
          </button>
        </div>
      </div>

      {/* 2x4 Metric Graphs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* 1. Temperature */}
        <MetricChartCard
          title="DHT11 TEMPERATURE"
          icon={<Thermometer className="w-4 h-4 text-cyan-400" />}
          health="OK"
          min={tempStats.min}
          max={tempStats.max}
          avg={tempStats.avg}
          unit="°C"
          lines={[{ label: 'Temp', color: '#22d3ee', data: tempVals }]}
        />

        {/* 2. Humidity */}
        <MetricChartCard
          title="DHT11 HUMIDITY"
          icon={<Droplets className="w-4 h-4 text-blue-400" />}
          health="OK"
          min={humStats.min}
          max={humStats.max}
          avg={humStats.avg}
          unit="%"
          lines={[{ label: 'Humidity', color: '#60a5fa', data: humVals }]}
        />

        {/* 3. BMP280 Pressure */}
        <MetricChartCard
          title="BMP280 PRESSURE"
          icon={<Gauge className="w-4 h-4 text-cyan-400" />}
          health="OK"
          min={pressStats.min}
          max={pressStats.max}
          avg={pressStats.avg}
          unit=" hPa"
          lines={[{ label: 'Pressure', color: '#38bdf8', data: pressVals }]}
        />

        {/* 4. Altitude Comparison (BMP280 vs GPS) */}
        <MetricChartCard
          title="ALTITUDE: BARO VS GPS"
          icon={<Mountain className="w-4 h-4 text-emerald-400" />}
          health="OK"
          min={altStats.min}
          max={altStats.max}
          avg={altStats.avg}
          unit="m"
          lines={[
            { label: 'BMP Baro', color: '#10b981', data: baroAltVals },
            { label: 'GPS Alt', color: '#a855f7', data: gpsAltVals },
          ]}
        />

        {/* 5. Roll / Pitch / Yaw */}
        <MetricChartCard
          title="ATTITUDE: ROLL / PITCH / YAW"
          icon={<Compass className="w-4 h-4 text-indigo-400" />}
          health="OK"
          min={rollStats.min}
          max={rollStats.max}
          avg={rollStats.avg}
          unit="°"
          lines={[
            { label: 'Roll', color: '#ef4444', data: rollVals },
            { label: 'Pitch', color: '#10b981', data: pitchVals },
            { label: 'Yaw', color: '#22d3ee', data: yawVals },
          ]}
        />

        {/* 6. Accelerometer Dynamics */}
        <MetricChartCard
          title="MPU6050 ACCELEROMETER"
          icon={<Activity className="w-4 h-4 text-cyan-400" />}
          health="OK"
          min={accelStats.min}
          max={accelStats.max}
          avg={accelStats.avg}
          unit=" m/s²"
          lines={[
            { label: 'Ax', color: '#22d3ee', data: axVals },
            { label: 'Ay', color: '#60a5fa', data: ayVals },
            { label: 'Az', color: '#38bdf8', data: azVals },
          ]}
        />

        {/* 7. Gyroscope Velocity */}
        <MetricChartCard
          title="MPU6050 GYROSCOPE"
          icon={<RotateCw className="w-4 h-4 text-purple-400" />}
          health="OK"
          min={gyroStats.min}
          max={gyroStats.max}
          avg={gyroStats.avg}
          unit="°/s"
          lines={[
            { label: 'Gx', color: '#22d3ee', data: gxVals },
            { label: 'Gy', color: '#60a5fa', data: gyVals },
            { label: 'Gz', color: '#c084fc', data: gzVals },
          ]}
        />

        {/* 8. Satellites Count */}
        <MetricChartCard
          title="GPS SATELLITES TRACKED"
          icon={<Satellite className="w-4 h-4 text-cyan-400" />}
          health="OK"
          min={satsStats.min}
          max={satsStats.max}
          avg={satsStats.avg}
          unit=" Sats"
          lines={[{ label: 'Locked Sats', color: '#10b981', data: satsVals }]}
        />
      </div>
    </div>
  );
};
