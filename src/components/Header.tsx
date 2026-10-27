/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useState, useEffect } from 'react';
import {
  Satellite,
  Radio,
  Maximize2,
  Minimize2,
  Sparkles,
  Wifi,
  Activity,
  Download,
  ExternalLink,
} from 'lucide-react';
import { ActiveTab, ConnectionMode, ConnectionState, CONFIG } from '../types/telemetry';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  connectionState: ConnectionState;
  connectionMode: ConnectionMode;
  packetCount: number;
  packetLoss: number;
  bitrateKbps: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  connectionState,
  connectionMode,
  packetCount,
  packetLoss,
  bitrateKbps,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');
  const [istTime, setIstTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      // UTC
      const utcStr = now.toISOString().substring(11, 19) + ' Z';
      setUtcTime(utcStr);

      // IST (UTC + 5:30)
      const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const istHours = String(istDate.getUTCHours()).padStart(2, '0');
      const istMins = String(istDate.getUTCMinutes()).padStart(2, '0');
      const istSecs = String(istDate.getUTCSeconds()).padStart(2, '0');
      setIstTime(`${istHours}:${istMins}:${istSecs} IST`);
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'primary', label: 'PRIMARY TELEMETRY HUD' },
    { id: 'motion', label: 'MOTION & DISPLACEMENT ALERT' },
    { id: 'diagnostics', label: 'SENSOR DIAGNOSTICS & GRAPHS' },
    { id: 'gps', label: 'GPS & ORBITAL TRACKING' },
    { id: 'controls', label: 'MISSION CONTROLS' },
  ];

  return (
    <header className="w-full bg-[#070d1a] border-b border-cyan-500/20 px-4 pt-3 pb-2 select-none">
      {/* Top Bar: Brand, Clocks & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
            <Satellite className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-wider text-white font-sans">
                {CONFIG.TEAM_NAME}
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800/90 text-cyan-300 border border-cyan-500/30">
                {CONFIG.INSTITUTION.toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase">
              ORBITRA 2026 // CUBESAT MISSION CONTROL
            </p>
          </div>
        </div>

        {/* Right Status Group */}
        <div className="flex items-center flex-wrap gap-4 font-mono text-xs">
          {/* UTC Clock */}
          <div className="text-right">
            <span className="text-[9px] text-slate-400 block tracking-wider uppercase">UTC CLOCK</span>
            <span className="text-slate-200 font-semibold">{utcTime || '12:00:00 Z'}</span>
          </div>

          {/* IST Clock */}
          <div className="text-right">
            <span className="text-[9px] text-slate-400 block tracking-wider uppercase">IST CLOCK</span>
            <span className="text-slate-200 font-semibold">{istTime || '17:30:00 IST'}</span>
          </div>

          {/* Connection Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-medium tracking-wide ${
              connectionState === 'CONNECTED'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : connectionState === 'DEMO'
                ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                : connectionState === 'STALE'
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'CONNECTED'
                  ? 'bg-emerald-400 animate-ping'
                  : connectionState === 'DEMO'
                  ? 'bg-purple-400'
                  : connectionState === 'STALE'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
            />
            <span>{connectionState}</span>
          </div>

          {/* RX Packets count */}
          <div className="text-right">
            <span className="text-[9px] text-slate-400 block tracking-wider uppercase">RX PACKETS</span>
            <span className="text-slate-200 font-bold">{packetCount.toLocaleString()} PKT</span>
          </div>

          {/* Live HW / SIM badge */}
          <div
            className={`px-2.5 py-1 rounded text-[11px] font-semibold border flex items-center gap-1.5 ${
              connectionMode === 'SIM'
                ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connectionMode === 'SIM' ? 'bg-indigo-400' : 'bg-cyan-400'}`} />
            <span>{connectionMode === 'SIM' ? 'SIM' : 'LIVE HW'}</span>
          </div>

          {/* Direct Window Launcher for USB Serial permissions */}
          <button
            type="button"
            onClick={() => window.open(window.location.href, '_blank')}
            title="Open in dedicated tab for direct Web Serial & USB permissions"
            className="flex items-center gap-1.5 px-3 py-1 text-cyan-200 hover:text-white bg-cyan-950/90 border border-cyan-400/50 rounded hover:border-cyan-300 transition-colors shadow-[0_0_10px_rgba(34,211,238,0.3)]"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider">DIRECT WINDOW (USB)</span>
          </button>

          {/* Download Project Zip Button */}
          <a
            href="/cosmic-era-ground-station.zip"
            download="cosmic-era-ground-station.zip"
            title="Download full project code (.zip)"
            className="flex items-center gap-1.5 px-3 py-1 text-slate-200 hover:text-white bg-slate-900 border border-slate-700 rounded hover:border-cyan-400 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-mono font-bold tracking-wider">DOWNLOAD ZIP</span>
          </a>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Toggle Fullscreen"
            className="p-1.5 text-slate-400 hover:text-cyan-300 bg-slate-900 border border-slate-700 rounded hover:border-cyan-500/40 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Tab Navigation Pill Bar */}
      <nav aria-label="Mission Tabs" className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-md font-mono text-[11px] font-semibold tracking-wider whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

export const Footer: React.FC<{
  packetLoss: number;
  bitrateKbps: number;
}> = ({ packetLoss, bitrateKbps }) => {
  return (
    <footer className="w-full bg-[#050914] border-t border-cyan-500/10 px-4 py-1.5 text-[10px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-cyan-400">GROUND STATION RUNTIME:</span>
        <span>COSMIC ERA | ORBITRA 2026 | MMMUT Gorakhpur</span>
      </div>
      <div className="flex items-center gap-4">
        <span>
          PKT LOSS: <strong className="text-cyan-300">{packetLoss.toFixed(2)}%</strong>
        </span>
        <span>
          BITRATE: <strong className="text-cyan-300">{bitrateKbps.toFixed(1)} KBPS</strong>
        </span>
        <span>
          HEALTH: <strong className="text-emerald-400">NOMINAL (99.8%)</strong>
        </span>
      </div>
    </footer>
  );
};
