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
  ChevronDown,
  ChevronUp,
  Cable,
  Cpu,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { ConnectionMode, ConnectionState, BoardType, TelemetryPacket } from '../types/telemetry';

interface SerialDiagnosticsModalProps {
  boardType?: BoardType;
  setBoardType?: (b: BoardType) => void;
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
  unstickESP32TypeB?: () => void;
  armRealHardwareMode?: () => void;
  injectTestPacket?: () => void;
  tareZero: () => void;
}

export const SerialDiagnosticsModal: React.FC<SerialDiagnosticsModalProps> = ({
  boardType = 'TYPE_B',
  setBoardType,
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
  unstickESP32TypeB,
  armRealHardwareMode,
  injectTestPacket,
  tareZero,
}) => {
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [hasSerialSupport, setHasSerialSupport] = useState<boolean>(true);
  const [knownPortsCount, setKnownPortsCount] = useState<number>(0);
  const [pulseSuccess, setPulseSuccess] = useState<string | null>(null);
  const [showTroubleshootingGuide, setShowTroubleshootingGuide] = useState<boolean>(true);

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

  const handleAction = (actionName: string, fn?: () => void) => {
    if (fn) {
      fn();
      setPulseSuccess(actionName);
      setTimeout(() => setPulseSuccess(null), 2800);
    }
  };

  return (
    <div className="w-full bg-[#0b1325]/95 border border-cyan-500/30 rounded-xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex flex-col gap-3 font-mono">
      {/* Top Header: Hardware Profile & Real Connection Status */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-cyan-500/20 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]">
            <Usb className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wider text-white uppercase">
                ESP32 TYPE-B (MICRO-USB) SERIAL DIAGNOSTICS & TESTBENCH
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                REAL HW READY
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Configured for CP2102 / CH340 / FT232 USB-UART Bridge on 8-N-1 Serial
            </p>
          </div>
        </div>

        {/* Board Selection & Live Status Pills */}
        <div className="flex items-center flex-wrap gap-2">
          {setBoardType && (
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setBoardType('TYPE_B')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  boardType === 'TYPE_B'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ESP32 TYPE-B (MICRO-USB)
              </button>
              <button
                type="button"
                onClick={() => setBoardType('TYPE_C')}
                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                  boardType === 'TYPE_C'
                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ESP32 TYPE-C (NATIVE CDC)
              </button>
            </div>
          )}

          <span
            className={`text-xs px-2.5 py-1 rounded border font-semibold ${
              connectionState === 'CONNECTED'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                : connectionState === 'STALE'
                ? 'bg-amber-950/90 text-amber-300 border-amber-500/60 animate-pulse'
                : connectionState === 'DEMO'
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
            }`}
          >
            {connectionState === 'DEMO' ? 'SIMULATOR ACTIVE' : `HW: ${connectionState}`}
          </span>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {pulseSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-lg p-2.5 text-xs text-emerald-200 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="font-bold">{pulseSuccess} EXECUTED SUCCESSFULLY</span>
          </div>
          <span className="text-[10px] text-emerald-400/80">Command dispatched to serial port</span>
        </div>
      )}

      {/* WHY IS MY ESP32 TYPE B NOT CONNECTING OR NOT SHOWING? (Diagnostic Accordion) */}
      <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl overflow-hidden shadow-inner">
        <button
          type="button"
          onClick={() => setShowTroubleshootingGuide(!showTroubleshootingGuide)}
          className="w-full px-4 py-2.5 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 flex items-center justify-between text-left border-b border-cyan-500/20 hover:bg-slate-800/80 transition-colors"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-200 uppercase tracking-wide">
              WHY IS MY ESP32 TYPE B NOT CONNECTING OR NOT SHOWING IN SERIAL PORT?
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              TOP 5 FIXES
            </span>
          </div>
          {showTroubleshootingGuide ? (
            <ChevronUp className="w-4 h-4 text-cyan-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-cyan-400" />
          )}
        </button>

        {showTroubleshootingGuide && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Fix 1: Micro-USB Cable Data vs Power */}
            <div className="bg-[#070e1c] p-3 rounded-lg border border-amber-500/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Cable className="w-4 h-4 text-amber-400" />
                <span>1. CHARGE-ONLY CABLE (MOST COMMON)</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Over 60% of Micro-USB cables are <strong>power-only</strong> charging cables (they only have 2 wires for VBUS & GND, and lack the <strong>D+ and D-</strong> data lines).
              </p>
              <div className="bg-amber-950/40 p-2 rounded text-[10px] text-amber-200 border border-amber-500/20 mt-auto">
                <strong>Test:</strong> When you plug in the ESP32, does your PC make a USB connection sound? If not, switch to a true 4-wire sync/data Micro-USB cable.
              </div>
            </div>

            {/* Fix 2: Driver (CH340 or CP2102) */}
            <div className="bg-[#070e1c] p-3 rounded-lg border border-cyan-500/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>2. MISSING CH340 / CP2102 DRIVER</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                ESP32 Type-B boards have an external USB-to-UART chip (usually <strong>CH340G</strong> or <strong>CP2102</strong>). Windows 10/11 does not always include the CH340 driver by default.
              </p>
              <div className="bg-cyan-950/40 p-2 rounded text-[10px] text-cyan-200 border border-cyan-500/20 mt-auto">
                <strong>Fix:</strong> Open <em>Windows Device Manager</em>. If you see &quot;USB-Serial&quot; with a yellow exclamation mark, install the <strong>CH341SER.EXE</strong> or <strong>CP210x VCP</strong> driver.
              </div>
            </div>

            {/* Fix 3: DTR/RTS Reset Line Lock */}
            <div className="bg-[#070e1c] p-3 rounded-lg border border-purple-500/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-purple-300 font-bold">
                <Power className="w-4 h-4 text-purple-400" />
                <span>3. AUTO-RESET HELD IN RESET</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Standard ESP32 Type-B boards have a transistor reset circuit. If DTR and RTS are asserted High, the board is held in <strong>RESET</strong> and never boots.
              </p>
              <div className="bg-purple-950/40 p-2 rounded text-[10px] text-purple-200 border border-purple-500/20 mt-auto">
                <strong>Resolved:</strong> In our new Type-B mode, DTR/RTS are released to <strong>LOW (0,0)</strong> so EN stays HIGH and firmware runs freely. Click &quot;UNSTICK TYPE-B&quot; below if needed!
              </div>
            </div>

            {/* Fix 4: Port Exclusive Lock */}
            <div className="bg-[#070e1c] p-3 rounded-lg border border-rose-500/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-rose-300 font-bold">
                <RefreshCw className="w-4 h-4 text-rose-400" />
                <span>4. ARDUINO IDE / TERMINAL PORT LOCK</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                On Windows, serial COM ports have an <strong>exclusive lock</strong>. If Arduino IDE Serial Monitor, PlatformIO, or another terminal is open, the browser cannot open the port.
              </p>
              <div className="bg-rose-950/40 p-2 rounded text-[10px] text-rose-200 border border-rose-500/20 mt-auto">
                <strong>Fix:</strong> Close Arduino Serial Monitor. Then click &quot;RELEASE LOCKS & RESET&quot; below to clear browser stream locks.
              </div>
            </div>

            {/* Fix 5: Web Serial in Iframe */}
            <div className="bg-[#070e1c] p-3 rounded-lg border border-emerald-500/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold">
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span>5. BROWSER PREVIEW IFRAME POLICY</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                In Web Studio previews, iframes block the browser hardware popup dialog with a <code>SecurityError</code> unless launched in a dedicated top-level window.
              </p>
              <div className="bg-emerald-950/40 p-2 rounded text-[10px] text-emerald-200 border border-emerald-500/20 mt-auto flex items-center justify-between">
                <span>Click &quot;DIRECT WINDOW (USB)&quot;</span>
                <button
                  type="button"
                  onClick={openDirectWindow}
                  className="px-2 py-0.5 bg-emerald-500 text-slate-950 font-bold rounded text-[10px]"
                >
                  OPEN
                </button>
              </div>
            </div>

            {/* Fix 6: Node.js WebSocket Bridge Fallback */}
            <div className="bg-[#070e1c] p-3 rounded-lg border border-blue-500/30 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-blue-300 font-bold">
                <Terminal className="w-4 h-4 text-blue-400" />
                <span>6. LOCAL BRIDGE.JS ALTERNATIVE</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                If Web Serial is unavailable, run the included bridge on your laptop:
                <code className="block bg-slate-950 p-1 rounded text-cyan-300 my-1 font-mono text-[10px]">
                  node bridge.js COM3 115200
                </code>
                Dashboard connects automatically via <code>ws://localhost:8081</code>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* REAL HARDWARE TESTBENCH CONTROLS (Disarms Demo, Pure Real Data) */}
      <div className="bg-gradient-to-r from-[#0d1830] via-[#091122] to-[#0d1830] border-2 border-cyan-500/40 rounded-xl p-3.5 shadow-lg flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              REAL HARDWARE TESTBENCH CONTROLS (TEST INPUT DATA, NOT DEMO)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {armRealHardwareMode && (
              <button
                type="button"
                onClick={() => handleAction('DEMO DISARMED (LIVE HW ARMED)', armRealHardwareMode)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded shadow transition-all flex items-center gap-1.5"
                title="Stops all simulation loops, clears fake numbers and awaits real packets from ESP32"
              >
                <Zap className="w-3.5 h-3.5 text-slate-950" />
                <span>DISARM DEMO & WAIT FOR ESP32</span>
              </button>
            )}
          </div>
        </div>

        {/* Action Button Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {connectionState === 'CONNECTED' ? (
            <button
              type="button"
              onClick={disconnectSerial}
              className="py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-colors shadow flex items-center justify-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              <span>DISCONNECT USB</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={connectSerial}
              className="py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded text-xs shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Usb className="w-3.5 h-3.5" />
              <span>CONNECT SERIAL</span>
            </button>
          )}

          {unstickESP32TypeB && (
            <button
              type="button"
              onClick={() => handleAction('UNSTICK TYPE-B', unstickESP32TypeB)}
              className="py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-xs shadow transition-colors flex items-center justify-center gap-1.5"
              title="Releases EN pin from reset and locks DTR=0, RTS=0 for CP2102/CH340"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
              <span>UNSTICK TYPE-B</span>
            </button>
          )}

          {rebootESP32 && (
            <button
              type="button"
              onClick={() => handleAction('REBOOT ESP32', rebootESP32)}
              className="py-2 px-3 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs shadow transition-colors flex items-center justify-center gap-1.5"
              title="Pulses RTS on EN pin to trigger a clean boot"
            >
              <Power className="w-3.5 h-3.5" />
              <span>REBOOT (EN PIN)</span>
            </button>
          )}

          {forceResetSerial && (
            <button
              type="button"
              onClick={() => handleAction('RELEASED ALL LOCKS', forceResetSerial)}
              className="py-2 px-3 bg-slate-800 hover:bg-rose-950 text-slate-200 hover:text-rose-200 border border-slate-700 hover:border-rose-500/50 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
              title="Clears locked readable streams and re-initializes serial port"
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
              <span>RELEASE LOCKS</span>
            </button>
          )}

          <button
            type="button"
            onClick={tareZero}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
            title="Zeros out accelerometer and gyro offsets"
          >
            <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>TARE ZYRO</span>
          </button>

          {injectTestPacket && (
            <button
              type="button"
              onClick={() => handleAction('TEST PACKET INGESTED', injectTestPacket)}
              className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-xs shadow transition-colors flex items-center justify-center gap-1.5"
              title="Injects a realistic ESP32 Type-B JSON packet into the live pipeline to verify HUD, 3D attitude and graphs"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-200" />
              <span>TEST PACKET</span>
            </button>
          )}
        </div>

        {/* Live Counters & Real-Time Gyro Validation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#060b14] p-3 rounded-lg border border-cyan-500/20 text-xs">
          {/* Data Flow */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              REAL DATA FLOW COUNTER
            </span>
            <div className="text-slate-200 mt-1">
              Raw Bytes Arrived: <strong className="text-cyan-300">{rawBytesCount.toLocaleString()} bytes</strong>
            </div>
            <div className="text-slate-200 mt-0.5">
              Parsed Packets: <strong className="text-emerald-400">{validPacketCount.toLocaleString()} PKT</strong>
            </div>
            {rawBytesCount > 0 && validPacketCount === 0 && (
              <div className="text-amber-400 text-[10px] mt-1 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>Bytes incoming but no JSON packet parsed! Check baud rate (115200).</span>
              </div>
            )}
          </div>

          {/* Gyro Real-Time Verification */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                GYROSCOPE (ZYRO) ACCURACY
              </span>
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

          {/* Baud Rate Quick Selector */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">BAUD RATE CONFIG</span>
              <span className="text-cyan-300 font-bold">{baudRate} BAUD</span>
            </div>
            {setBaudRate && (
              <div className="flex gap-1.5 mt-2">
                {[115200, 9600, 57600, 921600].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBaudRate(b)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      baudRate === b
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Iframe Alert & Direct Window Access */}
      {isIframe && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-2.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>IFRAME PERMISSION NOTICE:</strong> Chromium blocks USB Serial permission popups inside embedded preview frames. Click <strong>DIRECT WINDOW (USB)</strong> to connect directly.
            </span>
          </div>
          <button
            type="button"
            onClick={openDirectWindow}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded hover:bg-amber-400 transition-colors shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>OPEN DIRECT WINDOW</span>
          </button>
        </div>
      )}

      {/* Connection Error Message Banner */}
      {connectionError && (
        <div className="bg-rose-950/60 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-200 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-rose-300">Connection Notice:</strong>
              <div className="mt-0.5">{connectionError}</div>
            </div>
          </div>
          {forceResetSerial && (
            <button
              type="button"
              onClick={forceResetSerial}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-[11px] shrink-0"
            >
              CLEAR & RESET
            </button>
          )}
        </div>
      )}
    </div>
  );
};
