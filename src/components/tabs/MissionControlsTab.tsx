/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Usb,
  Download,
  Terminal,
  Send,
  Trash2,
  Copy,
  Check,
  Code2,
  Wifi,
  Radio,
  RefreshCw,
} from 'lucide-react';
import { ConnectionMode, ConnectionState, TelemetryPacket } from '../../types/telemetry';
import { SerialLogEntry } from '../../hooks/useTelemetry';
import { SerialDiagnosticsModal } from '../SerialDiagnosticsModal';
import {
  ONBOARD_CUBESAT_SKETCH,
  GROUND_STATION_SKETCH,
  WIRING_PINOUT_GUIDE,
} from '../../data/firmwareCode';

interface MissionControlsTabProps {
  connectionState: ConnectionState;
  connectionMode: ConnectionMode;
  baudRate: number;
  setBaudRate: (baud: number) => void;
  wsUrl: string;
  setWsUrl: (url: string) => void;
  serialLogs: SerialLogEntry[];
  setSerialLogs: React.Dispatch<React.SetStateAction<SerialLogEntry[]>>;
  connectionError: string | null;
  rawBytesCount: number;
  validPacketCount: number;
  currentPacket: TelemetryPacket;
  connectSerial: () => void;
  disconnectSerial: () => void;
  connectWebSocket: (url?: string) => void;
  sendCommand: (cmd: string) => void;
  exportCSV: () => void;
  tareZero: () => void;
  forceResetSerial?: () => void;
  pulseDTR?: () => void;
  rebootESP32?: () => void;
  injectTestPacket?: () => void;
}

export const MissionControlsTab: React.FC<MissionControlsTabProps> = ({
  connectionState,
  connectionMode,
  baudRate,
  setBaudRate,
  wsUrl,
  setWsUrl,
  serialLogs,
  setSerialLogs,
  connectionError,
  rawBytesCount,
  validPacketCount,
  currentPacket,
  connectSerial,
  disconnectSerial,
  connectWebSocket,
  sendCommand,
  exportCSV,
  tareZero,
  forceResetSerial,
  pulseDTR,
  rebootESP32,
  injectTestPacket,
}) => {
  const [autoscroll, setAutoscroll] = useState<boolean>(true);
  const [commandInput, setCommandInput] = useState<string>('');
  const [activeFirmwareTab, setActiveFirmwareTab] = useState<'ONBOARD' | 'GROUND' | 'WIRING'>('ONBOARD');
  const [copied, setCopied] = useState<boolean>(false);

  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Autoscroll terminal on new logs
  useEffect(() => {
    if (autoscroll && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [serialLogs, autoscroll]);

  // Transmit command
  const handleTransmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commandInput.trim()) return;
    sendCommand(commandInput.trim());
    setCommandInput('');
  };

  // Copy code helper
  const handleCopyCode = () => {
    const code =
      activeFirmwareTab === 'ONBOARD'
        ? ONBOARD_CUBESAT_SKETCH
        : activeFirmwareTab === 'GROUND'
        ? GROUND_STATION_SKETCH
        : WIRING_PINOUT_GUIDE;

    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#060b14] min-h-[calc(100vh-140px)]">
      {/* Live ESP32 Type-C Hardware Connection & Gyro Diagnostics */}
      <SerialDiagnosticsModal
        connectionState={connectionState}
        connectionMode={connectionMode}
        baudRate={baudRate}
        setBaudRate={setBaudRate}
        rawBytesCount={rawBytesCount}
        validPacketCount={validPacketCount}
        connectionError={connectionError}
        currentPacket={currentPacket}
        connectSerial={connectSerial}
        disconnectSerial={disconnectSerial}
        forceResetSerial={forceResetSerial}
        pulseDTR={pulseDTR}
        rebootESP32={rebootESP32}
        injectTestPacket={injectTestPacket}
        tareZero={tareZero}
      />

      {/* ================= CARD 1: GROUND STATION ESP32 USB SERIAL INTERFACE ================= */}
      <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/10">
          <div className="flex items-center gap-2">
            <Usb className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
              GROUND STATION ESP32 USB SERIAL INTERFACE
            </span>
          </div>

          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              connectionState === 'CONNECTED'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                : connectionState === 'DEMO'
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
            }`}
          >
            {connectionState}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          {/* Baud Rate & Frame Config */}
          <div className="flex items-center flex-wrap gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Baud Rate:</span>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(parseInt(e.target.value, 10))}
                className="bg-[#070e1c] border border-cyan-500/30 text-cyan-300 px-3 py-1.5 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-400"
              >
                <option value={9600}>9600 baud</option>
                <option value={57600}>57600 baud</option>
                <option value={115200}>115200 baud (Default ESP32)</option>
                <option value={230400}>230400 baud</option>
              </select>
            </div>

            <span className="text-slate-400">8-N-1 // No Flow Control</span>
          </div>

          {/* Connect & Export Buttons */}
          <div className="flex items-center gap-2">
            {connectionState === 'CONNECTED' && connectionMode === 'SERIAL' ? (
              <button
                type="button"
                onClick={disconnectSerial}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold tracking-wider transition-all"
              >
                <span>CLOSE SERIAL PORT</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={connectSerial}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold tracking-wider shadow-[0_0_12px_rgba(34,211,238,0.4)] transition-all"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>SELECT & OPEN SERIAL PORT</span>
              </button>
            )}

            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-white text-xs font-mono transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXPORT RAW CSV</span>
            </button>
          </div>
        </div>

        {/* Optional WebSocket Bridge Mode */}
        <div className="mt-3 pt-3 border-t border-cyan-500/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>Bridge Mode (WebSocket):</span>
            <input
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              placeholder="ws://localhost:8081"
              className="bg-[#070e1c] border border-cyan-500/30 text-cyan-300 px-2 py-1 rounded text-xs font-mono w-48 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={() => connectWebSocket(wsUrl)}
              className="px-3 py-1 bg-cyan-950 border border-cyan-500/40 text-cyan-300 rounded hover:bg-cyan-900 transition-colors"
            >
              Connect WS
            </button>
          </div>
          <span className="text-[10px] text-slate-500">
            Node.js bridge.js forwards Serial from USB port to local WebSocket
          </span>
        </div>
      </div>

      {/* ================= CARD 2: LIVE SERIAL MONITOR & TELEMETRY STREAM ================= */}
      <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)] flex flex-col justify-between">
        <div className="flex items-center justify-between pb-2 border-b border-cyan-500/10">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
              LIVE SERIAL MONITOR & TELEMETRY STREAM
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoscroll(!autoscroll)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-medium transition-colors ${
                autoscroll
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-900 border border-slate-700 text-slate-400'
              }`}
            >
              AUTOSCROLL {autoscroll ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={() => setSerialLogs([])}
              className="px-2.5 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-white bg-slate-900 border border-slate-700 transition-colors"
            >
              CLEAR
            </button>
          </div>
        </div>

        {/* Scrollable Log Area */}
        <div
          ref={terminalScrollRef}
          className="my-3 h-[240px] bg-[#050914] rounded-lg p-3 font-mono text-[11px] leading-relaxed overflow-y-auto border border-cyan-500/10 space-y-1 select-text"
        >
          {serialLogs.length === 0 ? (
            <div className="text-slate-600 italic">No telemetry packets received yet...</div>
          ) : (
            serialLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                <span
                  className={`px-1 rounded text-[9px] font-bold shrink-0 ${
                    log.type === 'RX'
                      ? 'bg-cyan-950 text-cyan-300'
                      : log.type === 'TX'
                      ? 'bg-amber-950 text-amber-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {log.type}
                </span>
                <span
                  className={`break-all ${
                    log.type === 'RX'
                      ? 'text-slate-300'
                      : log.type === 'TX'
                      ? 'text-amber-200 font-semibold'
                      : 'text-indigo-300'
                  }`}
                >
                  {log.raw}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Command Input & Transmit */}
        <form onSubmit={handleTransmit} className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Send command to ESP32 (e.g. PING, CAL, RATE=10, RESET)..."
            className="flex-1 bg-[#070e1c] border border-cyan-500/20 text-slate-100 placeholder:text-slate-600 px-3 py-2 rounded-lg text-xs font-mono focus:outline-none focus:border-cyan-400"
          />
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold rounded-lg shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>TRANSMIT</span>
          </button>
        </form>

        {/* Quick Uplinks Chips */}
        <div className="flex items-center flex-wrap gap-2 text-xs font-mono pt-1">
          <span className="text-slate-400 text-[11px]">Quick Uplinks:</span>
          <button
            type="button"
            onClick={() => sendCommand('PING')}
            className="px-2.5 py-1 rounded bg-[#070e1c] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950 transition-colors"
          >
            PING
          </button>
          <button
            type="button"
            onClick={() => sendCommand('CAL')}
            className="px-2.5 py-1 rounded bg-[#070e1c] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950 transition-colors"
          >
            CAL ACCEL
          </button>
          <button
            type="button"
            onClick={() => sendCommand('GET_CONFIG')}
            className="px-2.5 py-1 rounded bg-[#070e1c] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950 transition-colors"
          >
            GET_CONFIG
          </button>
          <button
            type="button"
            onClick={() => sendCommand('RESET')}
            className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 hover:bg-rose-900 transition-colors"
          >
            RESTART
          </button>
        </div>
      </div>

      {/* ================= CARD 3: COSMIC ERA // ESP32 HARDWARE FIRMWARE & WIRING SCHEMATICS ================= */}
      <div className="bg-[#0b1325]/90 border border-cyan-500/20 rounded-xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-cyan-500/10 gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-semibold tracking-wider text-slate-200 uppercase">
              COSMIC ERA // ESP32 HARDWARE FIRMWARE & WIRING SCHEMATICS
            </span>
          </div>

          {/* 3 Tabs */}
          <div className="flex items-center gap-1 bg-[#070e1c] p-1 rounded-lg border border-cyan-500/20">
            <button
              type="button"
              onClick={() => setActiveFirmwareTab('ONBOARD')}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                activeFirmwareTab === 'ONBOARD'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ONBOARD CUBESAT ESP32
            </button>
            <button
              type="button"
              onClick={() => setActiveFirmwareTab('GROUND')}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                activeFirmwareTab === 'GROUND'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              GROUND STATION ESP32
            </button>
            <button
              type="button"
              onClick={() => setActiveFirmwareTab('WIRING')}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                activeFirmwareTab === 'WIRING'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              WIRING PINOUT GUIDE
            </button>
          </div>
        </div>

        {/* Code Container with Copy and Download Buttons */}
        <div className="relative mt-3">
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <a
              href="/cosmic-era-ground-station.zip"
              download="cosmic-era-ground-station.zip"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold rounded shadow transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD PROJECT (.ZIP)</span>
            </a>

            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1325]/90 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 text-xs font-mono rounded shadow transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
            </button>
          </div>

          <pre className="h-[280px] bg-[#050914] text-slate-300 p-4 rounded-lg font-mono text-[11px] leading-relaxed overflow-x-auto overflow-y-auto border border-cyan-500/10">
            <code>
              {activeFirmwareTab === 'ONBOARD'
                ? ONBOARD_CUBESAT_SKETCH
                : activeFirmwareTab === 'GROUND'
                ? GROUND_STATION_SKETCH
                : WIRING_PINOUT_GUIDE}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
};
