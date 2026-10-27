/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useState, useEffect } from 'react';
import {
  Usb,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  Activity,
  Radio,
  RotateCw,
  RefreshCw,
  Power,
  Sliders,
  Check,
} from 'lucide-react';
import { ConnectionMode, ConnectionState, TelemetryPacket } from '../types/telemetry';

interface SerialDiagnosticsModalProps {
  connectionState: ConnectionState;
  connectionMode: ConnectionMode;
  baudRate: number;
  setBaudRate?: (baud: number) => void;
  rawBytesCount: number;
  validPacketCount: number;
  connectionError: string | null;
  currentPacket: TelemetryPacket;
  connectSerial: () => void;
  disconnectSerial: () => void;
  forceResetSerial?: () => void;
  pulseDTR?: () => void;
  rebootESP32?: () => void;
  injectTestPacket?: () => void;
  tareZero: () => void;
}

export const SerialDiagnosticsModal: React.FC<SerialDiagnosticsModalProps> = ({
  connectionState,
  connectionMode,
  baudRate,
  setBaudRate,
  rawBytesCount,
  validPacketCount,
  connectionError,
  currentPacket,
  connectSerial,
  disconnectSerial,
  forceResetSerial,
  pulseDTR,
  rebootESP32,
  injectTestPacket,
  tareZero,
}) => {
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [hasSerialSupport, setHasSerialSupport] = useState<boolean>(true);
  const [knownPortsCount, setKnownPortsCount] = useState<number>(0);
  const [pulseSuccess, setPulseSuccess] = useState<string | null>(null);

  useEffect(() => {
    setIsIframe(window.self !== window.top);
    const supported = 'serial' in navigator;
    setHasSerialSupport(supported);

    if (supported && (navigator as any).serial.getPorts) {
      (navigator as any).serial
        .getPorts()
        .then((ports: any[]) => {
          setKnownPortsCount(ports.length);
        })
        .catch(() => {});
    }
  }, []);

  const openDirectWindow = () => {
    window.open(window.location.href, '_blank');
  };

  const handlePulse = (actionName: string, fn?: () => void) => {
    if (fn) {
      fn();
      setPulseSuccess(actionName);
      setTimeout(() => setPulseSuccess(null), 2500);
    }
  };

  return (
    <div className="w-full bg-[#0b1325]/95 border border-cyan-500/30 rounded-xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-cyan-500/20 gap-2">
        <div className="flex items-center gap-2">
          <Usb className="w-5 h-5 text-cyan-400" />
          <span className="text-sm font-mono font-bold tracking-wider text-white uppercase">
            ESP32 TYPE-C & WEB SERIAL HARDWARE DIAGNOSTICS
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-mono px-2.5 py-0.5 rounded border font-semibold ${
              connectionState === 'CONNECTED'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : connectionState === 'STALE'
                ? 'bg-amber-950/90 text-amber-300 border-amber-500/60 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : connectionState === 'DEMO'
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
            }`}
          >
            STATUS: {connectionState} ({connectionMode})
          </span>
        </div>
      </div>

      {/* STALE OR ALREADY OPEN RESOLUTION BANNER */}
      {(connectionState === 'STALE' || connectionError?.includes('already open')) && (
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-2 border-amber-500/60 rounded-xl p-4 text-xs font-mono shadow-[0_0_20px_rgba(245,158,11,0.25)] flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-amber-300 text-sm tracking-wide">
                  PORT IS {connectionState === 'STALE' ? 'STALE (AWAITING DATA)' : 'ALREADY OPEN'} — TROUBLESHOOTING & RECOVERY
                </h4>
                <p className="text-slate-300 text-[11px] mt-0.5">
                  The USB serial port connection is established, but no active telemetry packet is reaching the parser.
                </p>
              </div>
            </div>

            {pulseSuccess && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-slate-950 rounded font-bold text-[11px] shrink-0 animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>{pulseSuccess} OK!</span>
              </div>
            )}
          </div>

          {/* Root cause bullets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded border border-amber-500/20">
            <div className="text-slate-300">
              <strong className="text-amber-400">1. Ground Station RX waiting for TX:</strong>
              <div className="text-slate-400 mt-0.5">
                The Ground Station ESP32 only sends serial lines when it receives ESP-NOW packets from the CubeSat TX. Ensure TX is powered ON.
              </div>
            </div>
            <div className="text-slate-300">
              <strong className="text-cyan-400">2. Type-C USB CDC Dormant:</strong>
              <div className="text-slate-400 mt-0.5">
                Native USB Type-C ESP32s (S2/S3/C3) require DTR/RTS lines High to begin UART streaming.
              </div>
            </div>
            <div className="text-slate-300">
              <strong className="text-purple-400">3. Conflicting App / Locked Port:</strong>
              <div className="text-slate-400 mt-0.5">
                If Arduino Serial Monitor or another window opened the port, click &quot;RELEASE LOCKS&quot; below.
              </div>
            </div>
          </div>

          {/* 4 Interactive One-Click Recovery Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handlePulse('PULSE DTR', pulseDTR)}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all"
            >
              <Zap className="w-4 h-4 text-cyan-200" />
              <span>1. PULSE DTR (WAKE CDC)</span>
            </button>

            <button
              type="button"
              onClick={() => handlePulse('REBOOT ESP32', rebootESP32)}
              className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.3)] transition-all"
            >
              <Power className="w-4 h-4 text-slate-950" />
              <span>2. REBOOT ESP32 (EN PIN)</span>
            </button>

            <button
              type="button"
              onClick={() => handlePulse('RELEASED LOCKS', forceResetSerial)}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(225,29,72,0.3)] transition-all"
            >
              <RefreshCw className="w-4 h-4 text-rose-200" />
              <span>3. RELEASE LOCKS & RESET</span>
            </button>

            <button
              type="button"
              onClick={() => handlePulse('TEST PACKET INJECTED', injectTestPacket)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all"
            >
              <Activity className="w-4 h-4 text-emerald-200" />
              <span>4. TEST PACKET (VERIFY ZYRO)</span>
            </button>
          </div>
        </div>
      )}

      {/* Iframe Warning Banner (if running in embedded iframe) */}
      {isIframe && (
        <div className="bg-amber-950/50 border border-amber-500/40 rounded-lg p-3 text-xs font-mono text-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>EMBEDDED IFRAME DETECTED:</strong> Browsers (Chrome/Edge) may restrict direct USB Serial communication inside embedded frames. Open the dashboard in a direct window for full hardware access.
            </span>
          </div>

          <button
            type="button"
            onClick={openDirectWindow}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded hover:bg-amber-400 transition-colors shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>OPEN IN DIRECT WINDOW</span>
          </button>
        </div>
      )}

      {/* Error message banner if any */}
      {connectionError && (
        <div className="bg-rose-950/60 border border-rose-500/50 rounded-lg p-3 text-xs font-mono text-rose-200 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 flex items-center justify-between">
            <div>
              <div className="font-bold text-rose-300">Connection Notice:</div>
              <div>{connectionError}</div>
            </div>
            {forceResetSerial && (
              <button
                type="button"
                onClick={forceResetSerial}
                className="ml-3 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[11px] shrink-0"
              >
                CLEAR & RESET PORT
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4-Step Hardware Connection Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs font-mono">
        <div className="bg-[#070e1c] p-2.5 rounded border border-cyan-500/10">
          <div className="text-cyan-400 font-bold mb-1">1. USB CABLE</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Ensure your Type-C cable supports <strong>data transfer</strong>, not power-only charging.
          </p>
        </div>

        <div className="bg-[#070e1c] p-2.5 rounded border border-cyan-500/10">
          <div className="text-cyan-400 font-bold mb-1">2. USB-UART DRIVER</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            CP210x, CH340, or native ESP32-S3 CDC driver installed in Windows Device Manager / macOS.
          </p>
        </div>

        <div className="bg-[#070e1c] p-2.5 rounded border border-cyan-500/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-cyan-400 font-bold">3. BAUD RATE</span>
            {setBaudRate && (
              <span className="text-[10px] text-slate-400">Quick Switch:</span>
            )}
          </div>
          <div className="text-slate-300 text-[11px]">
            Current: <strong className="text-cyan-300">{baudRate} baud</strong>
          </div>
          {setBaudRate && (
            <div className="flex gap-1.5 mt-1.5">
              {[115200, 9600, 57600].map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBaudRate(b)}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    baudRate === b
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#070e1c] p-2.5 rounded border border-cyan-500/10">
          <div className="text-cyan-400 font-bold mb-1">4. COM PORT ACCESS</div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Close Arduino Serial Monitor or PuTTY so the port is not locked by another app.
          </p>
        </div>
      </div>

      {/* Live Hardware Telemetry Diagnostic Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#070e1c] p-3 rounded-lg border border-cyan-500/20 text-xs font-mono">
        {/* Raw Bytes & Packets */}
        <div>
          <span className="text-[10px] text-slate-400 block uppercase">DATA FLOW COUNTERS</span>
          <div className="text-slate-200 mt-1">
            Raw Bytes: <strong className="text-cyan-300">{rawBytesCount.toLocaleString()} bytes</strong>
          </div>
          <div className="text-slate-200 mt-0.5">
            Valid JSON Packets: <strong className="text-emerald-400">{validPacketCount.toLocaleString()} PKT</strong>
          </div>
          {rawBytesCount > 0 && validPacketCount === 0 && (
            <div className="text-amber-400 text-[10px] mt-1 font-semibold">
              Bytes received but no packets parsed! Check baud rate (115200 vs 9600).
            </div>
          )}
        </div>

        {/* Gyro Real-Time Verification */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase">GYROSCOPE (ZYRO) STATUS</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              ACTIVE
            </span>
          </div>
          <div className="text-slate-200 mt-1 text-[11px]">
            Gx: <strong className="text-cyan-300">{currentPacket.gx?.toFixed(2)}°/s</strong> | Gy: <strong className="text-blue-300">{currentPacket.gy?.toFixed(2)}°/s</strong> | Gz: <strong className="text-purple-300">{currentPacket.gz?.toFixed(2)}°/s</strong>
          </div>
          <div className="text-slate-300 mt-0.5 text-[11px]">
            Attitude: <strong className="text-red-400">R:{currentPacket.r?.toFixed(1)}°</strong> <strong className="text-emerald-400">P:{currentPacket.pt?.toFixed(1)}°</strong> <strong className="text-cyan-400">Y:{currentPacket.y?.toFixed(1)}°</strong>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col justify-center gap-1.5">
          {connectionState === 'CONNECTED' ? (
            <button
              type="button"
              onClick={disconnectSerial}
              className="w-full py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-colors"
            >
              DISCONNECT USB PORT
            </button>
          ) : (
            <button
              type="button"
              onClick={connectSerial}
              className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-colors flex items-center justify-center gap-1.5"
            >
              <Usb className="w-3.5 h-3.5" />
              <span>CONNECT ESP32 PORT</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={tareZero}
              className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] border border-slate-600 transition-colors flex items-center justify-center gap-1"
            >
              <RotateCw className="w-3 h-3 text-cyan-400" />
              <span>TARE ZERO</span>
            </button>

            {forceResetSerial && (
              <button
                type="button"
                onClick={forceResetSerial}
                className="py-1 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 rounded text-[11px] border border-slate-600 transition-colors flex items-center justify-center gap-1"
              >
                <RefreshCw className="w-3 h-3 text-rose-400" />
                <span>RESET LOCKS</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
