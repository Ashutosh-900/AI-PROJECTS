/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Crosshair,
  Compass,
  Satellite,
  Navigation,
  Globe,
  Radio,
  MapPin,
} from 'lucide-react';
import { TelemetryPacket, SatelliteInfo, ConnectionMode, CONFIG } from '../../types/telemetry';
import { toDMS, calculateDistanceAndAzEl } from '../../utils/telemetryMath';

interface GpsTrackingTabProps {
  packet: TelemetryPacket;
  packetHistory: TelemetryPacket[];
  satellites: SatelliteInfo[];
  connectionMode: ConnectionMode;
}

export const GpsTrackingTab: React.FC<GpsTrackingTabProps> = ({
  packet,
  packetHistory,
  satellites,
  connectionMode,
}) => {
  const [coordFormat, setCoordFormat] = useState<'DECIMAL' | 'DMS'>('DECIMAL');

  // Ground station anchor
  const gsLat = CONFIG.GS_LAT;
  const gsLon = CONFIG.GS_LON;
  const gsAlt = CONFIG.GS_ALT;

  // CubeSat position
  const satLat = packet.lat ?? gsLat;
  const satLon = packet.lon ?? gsLon;
  const satAlt = packet.galt ?? 102.0;

  // Geometry calculations
  const geom = calculateDistanceAndAzEl(gsLat, gsLon, gsAlt, satLat, satLon, satAlt);

  // Ground track canvas ref
  const groundTrackCanvasRef = useRef<HTMLCanvasElement>(null);
  // Polar scope canvas ref
  const polarScopeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Render Polar Radar Scope
  useEffect(() => {
    const canvas = polarScopeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 24;

    ctx.clearRect(0, 0, width, height);

    // Radar Background Circle
    ctx.fillStyle = '#060c18';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Concentric Elevation Rings (0° horizon at edge, 30°, 60°, 90° center)
    const rings = [0.33, 0.66, 1.0];
    rings.forEach((rFactor, idx) => {
      ctx.strokeStyle = idx === 2 ? 'rgba(34, 211, 238, 0.4)' : 'rgba(30, 58, 95, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * rFactor, 0, 2 * Math.PI);
      ctx.stroke();

      // Ring elevation labels
      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '9px monospace';
      const elLabel = idx === 0 ? '60°' : idx === 1 ? '30°' : '0°';
      ctx.fillText(elLabel, cx + 4, cy - radius * rFactor + 10);
    });

    // Azimuth axes lines (N-S, E-W, diagonals)
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.35)';
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    // Cardinal Labels
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('N (000°)', cx - 22, cy - radius - 8);
    ctx.fillText('S (180°)', cx - 22, cy + radius + 16);
    ctx.fillText('E (090°)', cx + radius + 6, cy + 4);
    ctx.fillText('W (270°)', cx - radius - 50, cy + 4);

    // Ground Station Center marker
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fill();

    // Draw Constellation Satellites
    satellites.forEach((sat) => {
      // Elevation: 90° is center (r=0), 0° is horizon (r=radius)
      const elNorm = Math.max(0, 90 - sat.elevation) / 90;
      const r = elNorm * radius;
      // Azimuth: 0° is North (top), 90° is East (right)
      const azRad = ((sat.azimuth - 90) * Math.PI) / 180;
      const x = cx + r * Math.cos(azRad);
      const y = cy + r * Math.sin(azRad);

      ctx.fillStyle = sat.system === 'NavIC' ? '#a855f7' : '#10b981';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.fillText(`P${sat.prn}`, x + 5, y - 2);
    });

    // Draw CubeSat Position (ORBITRA-1)
    const satElNorm = Math.max(0, 90 - geom.elevationDeg) / 90;
    const satR = satElNorm * radius;
    const satAzRad = ((geom.azimuthDeg - 90) * Math.PI) / 180;
    const sx = cx + satR * Math.cos(satAzRad);
    const sy = cy + satR * Math.sin(satAzRad);

    // Bearing line from GS to CubeSat
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    // CubeSat marker
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // CubeSat label
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`ORBITRA-1 (${geom.azimuthDeg}°, ${geom.elevationDeg}°)`, sx + 8, sy - 4);
  }, [satellites, geom]);

  // Render Ground Track 20km Airspace Canvas
  useEffect(() => {
    const canvas = groundTrackCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;

    ctx.clearRect(0, 0, width, height);

    // Background tactical grid
    ctx.fillStyle = '#060b16';
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(30, 58, 95, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 20 km local radius scale: 1 km = ~12 pixels
    const kmScale = 12;

    // Range rings (5km, 10km, 15km, 20km)
    [5, 10, 15, 20].forEach((km) => {
      ctx.strokeStyle = km === 20 ? 'rgba(34, 211, 238, 0.35)' : 'rgba(30, 58, 95, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, km * kmScale, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.font = '9px monospace';
      ctx.fillText(`${km} km`, cx + 4, cy - km * kmScale + 12);
    });

    // Gorakhpur Landmarks
    // Ramgarh Tal Lake (east of city center)
    ctx.fillStyle = 'rgba(14, 116, 144, 0.3)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
    ctx.beginPath();
    ctx.ellipse(cx + 45, cy - 15, 30, 18, 0.4, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#22d3ee';
    ctx.font = '9px monospace';
    ctx.fillText('RAMGARH TAL', cx + 25, cy - 15);

    // Rapti River course (curving southwest)
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 120, cy - 80);
    ctx.bezierCurveTo(cx - 60, cy - 30, cx - 80, cy + 50, cx - 140, cy + 90);
    ctx.stroke();
    ctx.fillStyle = '#60a5fa';
    ctx.font = '8px monospace';
    ctx.fillText('RAPTI RIVER', cx - 110, cy + 40);

    // Gorakhpur Airport GOP
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText('✈ GORAKHPUR AIRPORT (GOP)', cx + 70, cy + 40);

    // MMMUT Ground Station Anchor Center
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('GS-1: MMMUT CAMPUS', cx + 10, cy + 14);

    // CubeSat Path Trail
    if (packetHistory.length > 1) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      packetHistory.forEach((p, idx) => {
        const dLat = (p.lat ?? gsLat) - gsLat;
        const dLon = (p.lon ?? gsLon) - gsLon;
        // 1 deg lat ~ 111 km
        const px = cx + dLon * 111 * kmScale * Math.cos((gsLat * Math.PI) / 180);
        const py = cy - dLat * 111 * kmScale;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // Current CubeSat Position
    const curDLat = satLat - gsLat;
    const curDLon = satLon - gsLon;
    const satX = cx + curDLon * 111 * kmScale * Math.cos((gsLat * Math.PI) / 180);
    const satY = cy - curDLat * 111 * kmScale;

    // Line from GS to CubeSat
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(satX, satY);
    ctx.stroke();
    ctx.setLineDash([]);

    // CubeSat Marker
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(satX, satY, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Callout Box
    ctx.fillStyle = 'rgba(11, 19, 37, 0.9)';
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
    ctx.lineWidth = 1;
    ctx.fillRect(satX + 8, satY - 26, 175, 24);
    ctx.strokeRect(satX + 8, satY - 26, 175, 24);

    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`CUBESAT AGL: ${packet.alt?.toFixed(1) || '103.8'}m`, satX + 14, satY - 14);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '8px monospace';
    ctx.fillText(`DIST: ${geom.groundDistKm} km // AZ: ${geom.azimuthDeg}°`, satX + 14, satY - 5);
  }, [packetHistory, satLat, satLon, gsLat, gsLon, geom, packet.alt]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#060b14] min-h-[calc(100vh-140px)]">
      {/* Top Banner: GPS Engine Info & Anchor */}
      <div className="w-full bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center">
            <Crosshair className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold tracking-wider text-white">
                NEO-6M HIGH PRECISION GPS ENGINE
              </span>
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
            <p className="text-[11px] font-mono text-slate-400">
              Ground Anchor: <strong className="text-cyan-300">MMMUT Gorakhpur</strong> (26.7324° N, 83.4332° E, 102m MSL)
            </p>
          </div>
        </div>

        {/* Decimal Degrees / DMS Toggle */}
        <div className="flex items-center gap-1 bg-[#070e1c] p-1 rounded-lg border border-cyan-500/20">
          <button
            type="button"
            onClick={() => setCoordFormat('DECIMAL')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
              coordFormat === 'DECIMAL'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            DECIMAL DEGREES
          </button>
          <button
            type="button"
            onClick={() => setCoordFormat('DMS')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
              coordFormat === 'DMS'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(34,211,238,0.3)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            DEG MIN SEC (DMS)
          </button>
        </div>
      </div>

      {/* Grid: Left Polar Radar Scope (6 cols) & Right Ephemeris + Locked Sats (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* ================= LEFT: POLAR AZ/EL RADAR SCOPE (6 cols) ================= */}
        <div className="lg:col-span-6 bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-semibold tracking-wider text-slate-200">
                POLAR AZIMUTH / ELEVATION RADAR SCOPE
              </span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300">
              AZ: {geom.azimuthDeg}° // EL: {geom.elevationDeg}°
            </span>
          </div>

          <div className="relative w-full h-[280px] my-2 flex items-center justify-center">
            <canvas ref={polarScopeCanvasRef} width={420} height={280} className="w-full h-full max-w-[420px]" />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-cyan-500/10 pt-2">
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">● GPS (Navstar)</span>
              <span className="text-purple-400">● NavIC (IRNSS)</span>
              <span className="text-cyan-400">● ORBITRA-1</span>
            </div>
            <span>SWEPT REAL-TIME</span>
          </div>
        </div>

        {/* ================= RIGHT: EPHEMERIS & LOCKED SATS (6 cols) ================= */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* Top: Telemetry Ephemeris & Spatial Vectors */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10 mb-3">
              <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
                TELEMETRY EPHEMERIS & SPATIAL VECTORS
              </span>
              <span className="text-[10px] font-mono text-cyan-400">DATUM: WGS-84</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="bg-[#070e1c] p-2.5 rounded-lg border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">LATITUDE (GORAKHPUR)</span>
                <span className="text-sm font-bold text-slate-100">
                  {coordFormat === 'DECIMAL'
                    ? (packet.lat !== undefined ? `${packet.lat.toFixed(5)}° N` : '--')
                    : (packet.lat !== undefined ? toDMS(packet.lat, true) : '--')}
                </span>
              </div>

              <div className="bg-[#070e1c] p-2.5 rounded-lg border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">LONGITUDE (GORAKHPUR)</span>
                <span className="text-sm font-bold text-slate-100">
                  {coordFormat === 'DECIMAL'
                    ? (packet.lon !== undefined ? `${packet.lon.toFixed(5)}° E` : '--')
                    : (packet.lon !== undefined ? toDMS(packet.lon, false) : '--')}
                </span>
              </div>

              <div className="bg-[#070e1c] p-2.5 rounded-lg border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">GPS ALTITUDE (MSL)</span>
                <span className="text-sm font-bold text-slate-100">
                  {packet.galt !== undefined ? `${packet.galt.toFixed(1)} m` : '--'}
                </span>
              </div>

              <div className="bg-[#070e1c] p-2.5 rounded-lg border border-cyan-500/10">
                <span className="text-[9px] text-slate-400 block uppercase">GROUND DISTANCE TO GS</span>
                <span className="text-sm font-bold text-cyan-300">
                  {geom.groundDistKm} km{' '}
                  <span className="text-xs font-normal text-slate-400">
                    (Slant: {geom.slantDistKm} km)
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Bottom: Locked Satellites in View */}
          <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10 mb-2">
              <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
                LOCKED SATELLITES ({satellites.length} SATS IN VIEW)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {connectionMode === 'SIM' ? 'SIMULATED GSV' : 'LIVE NMEA GSV'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
              {satellites.map((sat) => (
                <div
                  key={`${sat.system}-${sat.prn}`}
                  className="bg-[#070e1c] p-2 rounded border border-cyan-500/10 flex items-center justify-between text-[11px] font-mono"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span className={sat.system === 'NavIC' ? 'text-purple-400' : 'text-emerald-400'}>
                        ●
                      </span>
                      <span>
                        {sat.system} PRN-{sat.prn}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400">
                      Az: {sat.azimuth}° | El: {sat.elevation}°
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold text-cyan-300">{sat.snr} dB-Hz</span>
                    <div className="w-12 bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-emerald-400 rounded-full"
                        style={{ width: `${Math.min(100, (sat.snr / 50) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= BOTTOM: ORBITAL GROUND TRACK AIRSPACE (20 KM RADIUS) ================= */}
      <div className="w-full bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-200">
              ORBITAL GROUND TRACK // GORAKHPUR LOCAL AIRSPACE (20 KM RADIUS)
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            OFFLINE TACTICAL MAP • NO INTERNET TILES REQUIRED
          </span>
        </div>

        <div className="relative w-full h-[220px] my-2 bg-[#060b16] rounded-lg overflow-hidden border border-cyan-500/10">
          <canvas ref={groundTrackCanvasRef} width={1200} height={220} className="w-full h-full" />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-cyan-300">
              <MapPin className="w-3 h-3" /> MMMUT CAMPUS GROUND STATION (GS-1)
            </span>
            <span>• RAMGARH TAL LAKE AREA</span>
            <span>• AIRSPACE RADIUS: 20 KM</span>
          </div>
          <span>MAP DATUM: WGS-84</span>
        </div>
      </div>
    </div>
  );
};
