/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React from 'react';
import { Satellite, Radio, CheckCircle, Wifi } from 'lucide-react';
import { ConnectionMode, ConnectionState, CONFIG } from '../types/telemetry';

interface StatusStripProps {
  connectionState: ConnectionState;
  connectionMode: ConnectionMode;
  missionElapsedSeconds: number;
  packetCount: number;
  packetLoss: number;
  linkAgeMs: number;
  toggleDemoMode: () => void;
}

export const StatusStrip: React.FC<StatusStripProps> = ({
  connectionState,
  connectionMode,
  missionElapsedSeconds,
  packetCount,
  packetLoss,
  linkAgeMs,
  toggleDemoMode,
}) => {
  // Format MET seconds to hh:mm:ss
  const hours = String(Math.floor(missionElapsedSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((missionElapsedSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(missionElapsedSeconds % 60).padStart(2, '0');
  const metString = `${hours}:${minutes}:${seconds}`;

  return (
    <div className="w-full bg-[#0a1224]/80 border-b border-cyan-500/10 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
      {/* Left Telemetry Link Statuses */}
      <div className="flex items-center flex-wrap gap-5">
        {/* Link Protocol & Status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionState === 'CONNECTED' || connectionState === 'DEMO'
                ? 'bg-cyan-400 animate-pulse'
                : connectionState === 'STALE'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-300 font-semibold tracking-wide">
            ESP32 ESP-NOW LINK •{' '}
            <span
              className={
                connectionState === 'CONNECTED' || connectionState === 'DEMO'
                  ? 'text-cyan-300'
                  : connectionState === 'STALE'
                  ? 'text-amber-400 font-bold'
                  : 'text-rose-400'
              }
            >
              {connectionState === 'DEMO'
                ? 'SIMULATED'
                : connectionState === 'STALE'
                ? 'STALE (AWAITING DATA)'
                : connectionState}
            </span>
          </span>
        </div>

        {/* Mission Elapsed Time */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">
            MISSION ELAPSED (MET)
          </span>
          <span className="text-cyan-300 font-bold tracking-widest">{metString}</span>
        </div>

        {/* RX Packets & Loss */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">RX PACKETS</span>
          <span className="text-slate-100 font-bold">
            {packetCount.toLocaleString()}{' '}
            <span className="text-cyan-400 font-normal">({packetLoss.toFixed(2)}% LOSS)</span>
          </span>
        </div>

        {/* Link Age / Latency */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">LINK AGE</span>
          <span className="text-emerald-400 font-semibold">{linkAgeMs}ms</span>
        </div>
      </div>

      {/* Right Controls: SIM / DEMO toggle & Satellite ID badge */}
      <div className="flex items-center gap-4">
        {/* SIM / DEMO Switch */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">SIM / DEMO:</span>
          <button
            type="button"
            role="switch"
            aria-checked={connectionMode === 'SIM'}
            onClick={toggleDemoMode}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400 ${
              connectionMode === 'SIM' ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 transition-transform ${
                connectionMode === 'SIM' ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* CubeSat Identity Chip */}
        <div className="flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-500/30 px-3 py-1 rounded text-cyan-300 text-[11px] font-medium shadow-[0_0_10px_rgba(34,211,238,0.15)]">
          <Satellite className="w-3.5 h-3.5" />
          <span>{CONFIG.CUBESAT_NAME}</span>
        </div>
      </div>
    </div>
  );
};
