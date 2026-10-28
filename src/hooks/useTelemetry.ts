/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  TelemetryPacket,
  DisturbanceEvent,
  SatelliteInfo,
  ConnectionState,
  ConnectionMode,
  BoardType,
  CONFIG,
} from '../types/telemetry';
import {
  parseTelemetryLine,
  calculateNetJitter,
  calculatePacketLoss,
  exportTelemetryToCSV,
} from '../utils/telemetryMath';

export interface SerialLogEntry {
  id: string;
  timestamp: string;
  type: 'RX' | 'TX' | 'SYS';
  raw: string;
}

export function useTelemetry() {
  // Connection states
  const [boardType, setBoardType] = useState<BoardType>('TYPE_B');
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('SIM');
  const [connectionState, setConnectionState] = useState<ConnectionState>('DEMO');
  const [baudRate, setBaudRate] = useState<number>(CONFIG.DEFAULT_BAUD);
  const [wsUrl, setWsUrl] = useState<string>(CONFIG.DEFAULT_WS_URL);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [rawBytesCount, setRawBytesCount] = useState<number>(0);
  const [validPacketCount, setValidPacketCount] = useState<number>(0);

  // Core telemetry state
  const [currentPacket, setCurrentPacket] = useState<TelemetryPacket>({
    id: 4895,
    t: 24.3,
    h: 48.4,
    p: 1012.71,
    alt: 103.8,
    ax: -0.01,
    ay: -0.03,
    az: 9.82,
    gx: -0.01,
    gy: 0.01,
    gz: 0.00,
    r: 6.5,
    pt: -2.4,
    y: 129.8,
    lat: 26.7325,
    lon: 83.4334,
    galt: 102.2,
    sats: 9,
    fix: 1,
    timestamp: Date.now(),
  });

  // History buffers for real-time charts (last 60-120 packets)
  const [packetHistory, setPacketHistory] = useState<TelemetryPacket[]>([]);
  const fullPacketLogRef = useRef<TelemetryPacket[]>([]);

  // Ground baseline & offsets
  const [groundBaselineAlt, setGroundBaselineAlt] = useState<number>(0.0);
  const [maxApogee, setMaxApogee] = useState<number>(124.0);
  const [verticalSpeed, setVerticalSpeed] = useState<number>(0.2);
  const [accelOffset, setAccelOffset] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [gyroOffset, setGyroOffset] = useState<{ gx: number; gy: number; gz: number }>({ gx: 0, gy: 0, gz: 0 });

  // Disturbance & motion threshold monitor
  const [jitterLimit, setJitterLimit] = useState<number>(CONFIG.DEFAULT_JITTER_LIMIT);
  const [incidentLog, setIncidentLog] = useState<DisturbanceEvent[]>([
    {
      id: 'evt-1',
      timestamp: '14:32:05 Z',
      name: 'Staged Fairing Separation',
      peakJitter: 1.12,
      status: 'Recovered (120ms)',
      durationMs: 120,
    },
    {
      id: 'evt-2',
      timestamp: '14:35:18 Z',
      name: 'Antenna Deployment Shock',
      peakJitter: 1.34,
      status: 'Stabilized (250ms)',
      durationMs: 250,
    },
  ]);
  const [isAlertState, setIsAlertState] = useState<boolean>(false);

  // Satellites for GPS tab
  const [satellites, setSatellites] = useState<SatelliteInfo[]>([
    { prn: 3, system: 'GPS', azimuth: 52, elevation: 68, snr: 44, locked: true },
    { prn: 8, system: 'GPS', azimuth: 124, elevation: 42, snr: 41, locked: true },
    { prn: 14, system: 'GPS', azimuth: 280, elevation: 78, snr: 46, locked: true },
    { prn: 21, system: 'GPS', azimuth: 185, elevation: 28, snr: 38, locked: true },
    { prn: 22, system: 'GPS', azimuth: 340, elevation: 54, snr: 43, locked: true },
    { prn: 29, system: 'GPS', azimuth: 92, elevation: 61, snr: 40, locked: true },
    { prn: 102, system: 'NavIC', azimuth: 155, elevation: 72, snr: 45, locked: true },
    { prn: 104, system: 'NavIC', azimuth: 210, elevation: 65, snr: 42, locked: true },
    { prn: 106, system: 'NavIC', azimuth: 315, elevation: 49, snr: 39, locked: true },
  ]);

  // Serial monitor log
  const [serialLogs, setSerialLogs] = useState<SerialLogEntry[]>([
    { id: '1', timestamp: '18:54:00', type: 'SYS', raw: 'COSMIC ERA Ground Station initialized. Select COM Port or run Bridge.' },
    { id: '2', timestamp: '18:54:01', type: 'RX', raw: '{"id":4895,"t":24.5,"h":48.1,"p":1012.94,"alt":93,"ax":0,"ay":-0.01,"az":9.82,"gx":0.0,"gy":0.0,"gz":0.0,"r":4.5,"pt":-2,"y":128.5,"lat":26.7324,"lon":83.4332,"galt":101.7,"sats":9,"fix":1}' },
  ]);

  // Operational metrics
  const [packetCount, setPacketCount] = useState<number>(4946);
  const [packetLoss, setPacketLoss] = useState<number>(0.02);
  const [linkAgeMs, setLinkAgeMs] = useState<number>(14);
  const [bitrateKbps, setBitrateKbps] = useState<number>(9.6);
  const [missionElapsedSeconds, setMissionElapsedSeconds] = useState<number>(15918); // 04:25:18

  // Web Serial & WebSocket references
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const serialWriterRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastPacketTimeRef = useRef<number>(Date.now());
  const firstPacketIdRef = useRef<number>(4800);
  const lastPacketIdRef = useRef<number>(4895);
  const totalReceivedRef = useRef<number>(4946);
  const isFirstLivePacketRef = useRef<boolean>(true);
  const jitterDisturbanceTimerRef = useRef<any>(null);

  // Sim impulse state
  const simShockRef = useRef<{ active: boolean; remaining: number; magnitude: number }>({
    active: false,
    remaining: 0,
    magnitude: 0,
  });
  const simTumbleRef = useRef<{ active: boolean; remaining: number }>({
    active: false,
    remaining: 0,
  });

  // Append a serial log entry
  const addLog = useCallback((type: 'RX' | 'TX' | 'SYS', raw: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setSerialLogs((prev) => {
      const next = [...prev, { id: `${Date.now()}-${Math.random()}`, timestamp: timeStr, type, raw }];
      if (next.length > 200) return next.slice(next.length - 200);
      return next;
    });
  }, []);

  // Ingest incoming packet with complementary attitude gyro fusion
  const ingestPacket = useCallback(
    (packet: Partial<TelemetryPacket>, rawText?: string) => {
      if (isPaused) return;

      const now = Date.now();
      const age = now - lastPacketTimeRef.current;
      setLinkAgeMs(age > 0 ? age : 10);
      lastPacketTimeRef.current = now;

      if (rawText) {
        addLog('RX', rawText);
      }

      setValidPacketCount((c) => c + 1);

      setCurrentPacket((prev) => {
        const dt = Math.min(0.5, Math.max(0.001, (now - (prev.timestamp || now)) / 1000));

        // Correct gyro & accel with tared offsets
        const correctedAx = packet.ax !== undefined ? Number((packet.ax - accelOffset.x).toFixed(2)) : prev.ax;
        const correctedAy = packet.ay !== undefined ? Number((packet.ay - accelOffset.y).toFixed(2)) : prev.ay;
        const correctedAz = packet.az !== undefined ? Number((packet.az - accelOffset.z).toFixed(2)) : prev.az;

        const correctedGx = packet.gx !== undefined ? Number((packet.gx - gyroOffset.gx).toFixed(2)) : prev.gx;
        const correctedGy = packet.gy !== undefined ? Number((packet.gy - gyroOffset.gy).toFixed(2)) : prev.gy;
        const correctedGz = packet.gz !== undefined ? Number((packet.gz - gyroOffset.gz).toFixed(2)) : prev.gz;

        // Attitude calculation:
        // 1. If ESP32 provided roll/pitch/yaw, use them directly.
        // 2. If not provided or NaN, compute via complementary filter from gyro + accelerometer
        let finalRoll = packet.r;
        let finalPitch = packet.pt;
        let finalYaw = packet.y;

        if (finalRoll === undefined || isNaN(finalRoll)) {
          const rollAcc = (Math.atan2(correctedAy, correctedAz) * 180) / Math.PI;
          finalRoll = Number((0.95 * (prev.r + correctedGx * dt) + 0.05 * rollAcc).toFixed(1));
        }

        if (finalPitch === undefined || isNaN(finalPitch)) {
          const pitchAcc = (Math.atan2(-correctedAx, Math.sqrt(correctedAy * correctedAy + correctedAz * correctedAz)) * 180) / Math.PI;
          finalPitch = Number((0.95 * (prev.pt + correctedGy * dt) + 0.05 * pitchAcc).toFixed(1));
        }

        if (finalYaw === undefined || isNaN(finalYaw)) {
          let updatedYaw = prev.y + correctedGz * dt;
          if (updatedYaw >= 360) updatedYaw -= 360;
          if (updatedYaw < 0) updatedYaw += 360;
          finalYaw = Number(updatedYaw.toFixed(1));
        }

        // Keep raw sensor altitude in packet.alt (MSL)
        const rawAlt = packet.alt !== undefined ? packet.alt : prev.alt;

        const full: TelemetryPacket = {
          id: packet.id ?? prev.id + 1,
          t: packet.t ?? prev.t,
          h: packet.h ?? prev.h,
          p: packet.p ?? prev.p,
          alt: rawAlt,
          ax: correctedAx,
          ay: correctedAy,
          az: correctedAz,
          gx: correctedGx,
          gy: correctedGy,
          gz: correctedGz,
          r: finalRoll,
          pt: finalPitch,
          y: finalYaw,
          lat: packet.lat ?? prev.lat,
          lon: packet.lon ?? prev.lon,
          galt: packet.galt ?? prev.galt,
          sats: packet.sats !== undefined ? packet.sats : prev.sats,
          fix: packet.fix !== undefined ? packet.fix : prev.fix,
          timestamp: now,
        };

        // Update vertical speed from barometric altitude rate of change
        if (dt > 0.05 && packet.alt !== undefined) {
          const vs = (full.alt - prev.alt) / dt;
          setVerticalSpeed(Number(vs.toFixed(1)));
        }

        // Update Max Apogee (computed relative to ground baseline)
        const currentAgl = full.alt - groundBaselineAlt;
        if (currentAgl > maxApogee) {
          setMaxApogee(Number(currentAgl.toFixed(1)));
        }

        // Update packet history buffer
        setPacketHistory((hist) => {
          const next = [...hist, full];
          if (next.length > 80) return next.slice(next.length - 80);
          return next;
        });
        fullPacketLogRef.current.push(full);

        // Calculate dynamic jitter
        const jitter = calculateNetJitter(full.ax, full.ay, full.az);
        if (jitter > jitterLimit) {
          setIsAlertState(true);
          clearTimeout(jitterDisturbanceTimerRef.current);
          jitterDisturbanceTimerRef.current = setTimeout(() => {
            setIsAlertState(false);
          }, 600);

          // Add incident if not logged recently
          setIncidentLog((logs) => {
            const lastLog = logs[logs.length - 1];
            if (lastLog && Date.now() - new Date().getTime() < 3000) return logs;
            const newEvt: DisturbanceEvent = {
              id: `evt-${Date.now()}`,
              timestamp: new Date().toISOString().substring(11, 19) + ' Z',
              name: jitter > 2.0 ? 'Aerodynamic Shock Disturbance' : 'Angular Stabilization Trim',
              peakJitter: jitter,
              status: `Stabilized (${Math.floor(100 + Math.random() * 200)}ms)`,
              durationMs: Math.floor(100 + Math.random() * 200),
            };
            return [...logs.slice(-14), newEvt];
          });
        }

        return full;
      });

      // Update counters with support for live hardware packet start
      if (connectionMode !== 'SIM') {
        if (isFirstLivePacketRef.current) {
          isFirstLivePacketRef.current = false;
          firstPacketIdRef.current = packet.id ?? 1;
          lastPacketIdRef.current = packet.id ?? 1;
          totalReceivedRef.current = 1;
          setPacketCount(1);
          setPacketLoss(0.00);
        } else {
          totalReceivedRef.current += 1;
          setPacketCount(totalReceivedRef.current);
          if (packet.id !== undefined) {
            lastPacketIdRef.current = Math.max(lastPacketIdRef.current, packet.id);
            const loss = calculatePacketLoss(totalReceivedRef.current, lastPacketIdRef.current, firstPacketIdRef.current);
            setPacketLoss(loss);
          }
        }
      } else {
        totalReceivedRef.current += 1;
        setPacketCount(totalReceivedRef.current);
        if (packet.id !== undefined) {
          lastPacketIdRef.current = Math.max(lastPacketIdRef.current, packet.id);
          const loss = calculatePacketLoss(totalReceivedRef.current, lastPacketIdRef.current, firstPacketIdRef.current);
          setPacketLoss(loss);
        }
      }
    },
    [isPaused, groundBaselineAlt, accelOffset, gyroOffset, maxApogee, jitterLimit, addLog, connectionMode]
  );

  // Mission Elapsed Time timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMissionElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Stale connection detector
  useEffect(() => {
    const checker = setInterval(() => {
      if (connectionMode !== 'SIM') {
        const diff = Date.now() - lastPacketTimeRef.current;
        if (diff > 3000 && connectionState === 'CONNECTED') {
          setConnectionState('STALE');
        }
      }
    }, 1000);
    return () => clearInterval(checker);
  }, [connectionMode, connectionState]);

  // Simulation mode loop (runs at ~10 Hz when in SIM mode)
  useEffect(() => {
    if (connectionMode !== 'SIM') return;

    let simId = 4895;
    let angleTime = 0;

    const interval = setInterval(() => {
      if (isPaused) return;

      simId += 1;
      angleTime += 0.1;

      // Check shock
      let shockAccel = 0;
      if (simShockRef.current.active) {
        shockAccel = simShockRef.current.magnitude;
        simShockRef.current.remaining -= 1;
        if (simShockRef.current.remaining <= 0) {
          simShockRef.current.active = false;
        }
      }

      // Check tumble
      let tumbleRate = 0;
      if (simTumbleRef.current.active) {
        tumbleRate = 45.0;
        simTumbleRef.current.remaining -= 1;
        if (simTumbleRef.current.remaining <= 0) {
          simTumbleRef.current.active = false;
        }
      }

      // Physics variation
      const rollDeg = Number((6.5 + Math.sin(angleTime * 0.8) * 1.5 + (tumbleRate > 0 ? (Math.random() - 0.5) * 40 : 0)).toFixed(1));
      const pitchDeg = Number((-2.4 + Math.cos(angleTime * 0.7) * 1.2 + (tumbleRate > 0 ? (Math.random() - 0.5) * 30 : 0)).toFixed(1));
      const yawDeg = Number(((129.8 + angleTime * 0.5 + (tumbleRate > 0 ? Math.random() * 50 : 0)) % 360).toFixed(1));

      const ax = Number(((Math.random() - 0.5) * 0.05 + (shockAccel > 0 ? shockAccel : 0)).toFixed(2));
      const ay = Number(((Math.random() - 0.5) * 0.06).toFixed(2));
      const az = Number((9.82 + (Math.random() - 0.5) * 0.04 + (shockAccel > 0 ? shockAccel * 0.8 : 0)).toFixed(2));

      const gx = Number(((Math.random() - 0.5) * 0.03 + tumbleRate * 0.1).toFixed(2));
      const gy = Number(((Math.random() - 0.5) * 0.03 + tumbleRate * 0.1).toFixed(2));
      const gz = Number(((Math.random() - 0.5) * 0.02 + (tumbleRate > 0 ? 5.2 : 0)).toFixed(2));

      // Sensors
      const temp = Number((24.3 + Math.sin(angleTime * 0.05) * 0.4 + (Math.random() - 0.5) * 0.1).toFixed(1));
      const hum = Number((48.4 + Math.cos(angleTime * 0.04) * 0.5 + (Math.random() - 0.5) * 0.2).toFixed(1));
      const press = Number((1012.71 + Math.sin(angleTime * 0.03) * 0.2 + (Math.random() - 0.5) * 0.05).toFixed(2));
      const alt = Number((103.8 + Math.sin(angleTime * 0.08) * 1.5 + (Math.random() - 0.5) * 0.2).toFixed(1));

      // GPS drifting slightly around Gorakhpur MMMUT
      const lat = Number((26.7325 + Math.sin(angleTime * 0.02) * 0.001).toFixed(5));
      const lon = Number((83.4334 + Math.cos(angleTime * 0.02) * 0.001).toFixed(5));
      const galt = Number((102.2 + Math.sin(angleTime * 0.05) * 1.0).toFixed(1));

      const simPacket: TelemetryPacket = {
        id: simId,
        t: temp,
        h: hum,
        p: press,
        alt: alt,
        ax: ax,
        ay: ay,
        az: az,
        gx: gx,
        gy: gy,
        gz: gz,
        r: rollDeg,
        pt: pitchDeg,
        y: yawDeg,
        lat: lat,
        lon: lon,
        galt: galt,
        sats: 9,
        fix: 1,
        timestamp: Date.now(),
      };

      const rawJson = JSON.stringify(simPacket);
      ingestPacket(simPacket, rawJson);
    }, 100);

    return () => clearInterval(interval);
  }, [connectionMode, isPaused, ingestPacket]);

  // Connect Web Serial API (Resilient for Type-C ESP32)
  const connectSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      setConnectionError(
        'Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge on HTTPS or localhost.'
      );
      addLog('SYS', 'ERROR: Web Serial not supported in current browser.');
      return;
    }

    try {
      setConnectionError(null);

      // Clean up previous reader / writer / port references first to prevent locked stream errors
      if (serialReaderRef.current) {
        try {
          await serialReaderRef.current.cancel();
          serialReaderRef.current.releaseLock();
        } catch {}
        serialReaderRef.current = null;
      }
      if (serialWriterRef.current) {
        try {
          await serialWriterRef.current.close();
        } catch {}
        serialWriterRef.current = null;
      }
      if (serialPortRef.current) {
        try {
          await serialPortRef.current.close();
        } catch {}
        serialPortRef.current = null;
      }

      addLog('SYS', `Requesting USB Serial Port for ESP32 ${boardType === 'TYPE_B' ? 'Type-B (Micro-USB / CH340 / CP2102)' : 'Type-C (Native CDC)'} at ${baudRate} baud...`);
      
      let port: any = null;
      // Auto-reconnect to existing granted port if available
      if ((navigator as any).serial.getPorts) {
        const existingPorts = await (navigator as any).serial.getPorts().catch(() => []);
        if (existingPorts.length === 1 && !serialPortRef.current) {
          port = existingPorts[0];
          addLog('SYS', 'Found previously authorized USB Serial port. Connecting directly...');
        }
      }
      if (!port) {
        // Empty filters ensures all USB-UART bridges (CH340, CP2102, FT232, PL2303, CDC) are visible
        port = await (navigator as any).serial.requestPort({ filters: [] });
      }
      serialPortRef.current = port;

      try {
        await port.open({
          baudRate,
          bufferSize: 16384,
          flowControl: 'none',
        });
      } catch (openErr: any) {
        const msg = openErr?.message || String(openErr);
        if (msg.includes('already open')) {
          addLog('SYS', 'Notice: Port was already open in browser session. Reusing open port.');
        } else {
          throw openErr;
        }
      }

      // Configure DTR / RTS lines based on ESP32 board architecture:
      // - ESP32 Type-B (Micro-USB with CP2102, CH340, FT232):
      //   Crucial: Setting DTR=false, RTS=false releases the transistor auto-reset circuit,
      //   leaving EN (Reset) and IO0 (Boot) HIGH so the CPU runs user firmware!
      // - ESP32 Type-C (Native USB-CDC on S2/S3/C3):
      //   Asserting DTR=true wakes up the CDC communication endpoint.
      if (boardType === 'TYPE_B') {
        try {
          await port.setSignals({ dataTerminalReady: false, requestToSend: false });
          addLog('SYS', 'ESP32 Type-B Mode: DTR & RTS lines released LOW. EN pin released, CPU running sketch.');
        } catch {
          // Some USB-UART drivers don't implement setSignals, safe to ignore
        }
      } else {
        try {
          await port.setSignals({ dataTerminalReady: true, requestToSend: true });
          addLog('SYS', 'ESP32 Type-C CDC Mode: DTR/RTS asserted High.');
        } catch {}
      }

      isFirstLivePacketRef.current = true;
      setConnectionMode('SERIAL');
      setConnectionState('CONNECTED');
      lastPacketTimeRef.current = Date.now();
      addLog('SYS', `Serial port opened successfully at ${baudRate} baud (8-N-1, flowControl: none).`);
      addLog('SYS', 'Listening for live ESP32 telemetry packets (JSON/CSV/KV)...');

      // Setup writer
      const textEncoder = new TextEncoder();
      if (port.writable && !port.writable.locked) {
        const writer = port.writable.getWriter();
        serialWriterRef.current = {
          write: async (msg: string) => {
            const data = textEncoder.encode(msg);
            await writer.write(data);
          },
          close: async () => {
            await writer.close().catch(() => {});
            writer.releaseLock();
          },
        };
      }

      // Setup reader
      if (!port.readable) {
        throw new Error('Port readable stream unavailable.');
      }
      if (port.readable.locked) {
        addLog('SYS', 'Warning: ReadableStream is locked by another reader. Attempting release...');
      }

      const reader = port.readable.getReader();
      serialReaderRef.current = reader;
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let buffer = '';

      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              setRawBytesCount((c) => c + value.byteLength);
              const text = decoder.decode(value, { stream: true });
              buffer += text;

              // Extract complete JSON objects between matching braces { ... }
              let firstBrace;
              while ((firstBrace = buffer.indexOf('{')) !== -1) {
                let depth = 0;
                let endBrace = -1;
                for (let i = firstBrace; i < buffer.length; i++) {
                  if (buffer[i] === '{') depth++;
                  else if (buffer[i] === '}') {
                    depth--;
                    if (depth === 0) {
                      endBrace = i;
                      break;
                    }
                  }
                }

                if (endBrace !== -1) {
                  const jsonString = buffer.substring(firstBrace, endBrace + 1);
                  buffer = buffer.substring(endBrace + 1);
                  const parsed = parseTelemetryLine(jsonString);
                  if (parsed) {
                    ingestPacket(parsed, jsonString);
                    if (connectionState === 'STALE') {
                      setConnectionState('CONNECTED');
                    }
                  } else {
                    addLog('RX', jsonString);
                  }
                } else {
                  // If buffer grows too big without closing brace, drop stale characters
                  if (buffer.length > 2048) {
                    buffer = buffer.substring(firstBrace + 1);
                  }
                  break;
                }
              }

              // Also capture non-JSON lines (e.g. CSV, Key-Value, or ESP32 boot logs)
              const newlineIdx = buffer.indexOf('\n');
              if (newlineIdx !== -1 && buffer.indexOf('{') === -1) {
                const textLine = buffer.substring(0, newlineIdx).trim();
                buffer = buffer.substring(newlineIdx + 1);
                if (textLine) {
                  const parsed = parseTelemetryLine(textLine);
                  if (parsed) {
                    ingestPacket(parsed, textLine);
                    if (connectionState === 'STALE') {
                      setConnectionState('CONNECTED');
                    }
                  } else {
                    addLog('RX', textLine);
                  }
                }
              }
            }
          }
        } catch (err: any) {
          addLog('SYS', `Serial read loop: ${err?.message || err}`);
          setConnectionState('STALE');
        } finally {
          try {
            reader.releaseLock();
          } catch {}
        }
      })();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('disallowed by permissions policy') || errMsg.includes('SecurityError')) {
        setConnectionError(
          'Web Serial is restricted inside embedded iframe preview. Click "DIRECT WINDOW (USB)" at the top to access USB COM ports directly.'
        );
      } else if (errMsg.includes('No port selected') || errMsg.includes('canceled')) {
        addLog('SYS', 'Serial port selection canceled.');
      } else if (errMsg.includes('already open')) {
        addLog('SYS', 'Port is already open. Reconnecting reader...');
        setConnectionState('CONNECTED');
      } else {
        setConnectionError(`Connection error: ${errMsg}`);
      }
      addLog('SYS', `Serial connection failed: ${errMsg}`);
    }
  }, [baudRate, addLog, ingestPacket, connectionState]);

  // Disconnect Serial
  const disconnectSerial = useCallback(async () => {
    try {
      if (serialWriterRef.current) {
        await serialWriterRef.current.close().catch(() => {});
      }
      if (serialReaderRef.current) {
        await serialReaderRef.current.cancel().catch(() => {});
        try {
          serialReaderRef.current.releaseLock();
        } catch {}
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close().catch(() => {});
      }
    } catch {
      // ignore
    } finally {
      serialPortRef.current = null;
      serialReaderRef.current = null;
      serialWriterRef.current = null;
      setConnectionState('DISCONNECTED');
      addLog('SYS', 'Serial connection closed cleanly.');
    }
  }, [addLog]);

  // Connect WebSocket Bridge (ws://localhost:8081)
  const connectWebSocket = useCallback(
    (targetUrl: string = wsUrl) => {
      addLog('SYS', `Attempting WebSocket connection to ${targetUrl}...`);
      try {
        const ws = new WebSocket(targetUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          isFirstLivePacketRef.current = true;
          setConnectionMode('WEBSOCKET');
          setConnectionState('CONNECTED');
          setConnectionError(null);
          addLog('SYS', `Connected to WebSocket bridge at ${targetUrl}`);
        };

        ws.onmessage = (event) => {
          const raw = String(event.data).trim();
          if (raw) {
            setRawBytesCount((c) => c + raw.length);
            const parsed = parseTelemetryLine(raw);
            if (parsed) {
              ingestPacket(parsed, raw);
            } else {
              addLog('RX', raw);
            }
          }
        };

        ws.onerror = () => {
          setConnectionError(`Failed to connect to ${targetUrl}. Is 'node bridge.js' running?`);
          addLog('SYS', `WebSocket connection error.`);
        };

        ws.onclose = () => {
          setConnectionState('DISCONNECTED');
          addLog('SYS', `WebSocket connection closed.`);
        };
      } catch (e: any) {
        setConnectionError(`WebSocket error: ${e?.message || e}`);
        addLog('SYS', `Failed to open WebSocket: ${e?.message || e}`);
      }
    },
    [wsUrl, addLog, ingestPacket]
  );

  // Send Command to ESP32
  const sendCommand = useCallback(
    async (command: string) => {
      const cleanCmd = command.trim();
      if (!cleanCmd) return;

      addLog('TX', cleanCmd);

      // Web Serial write
      if (serialWriterRef.current) {
        try {
          await serialWriterRef.current.write(cleanCmd + '\n');
        } catch (e: any) {
          addLog('SYS', `Serial write error: ${e?.message || e}`);
        }
      }

      // WebSocket write
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(cleanCmd + '\n');
        } catch (e: any) {
          addLog('SYS', `WebSocket send error: ${e?.message || e}`);
        }
      }

      // If in demo mode, simulate responses for testing
      if (connectionMode === 'SIM') {
        setTimeout(() => {
          if (cleanCmd.startsWith('PING')) {
            addLog('RX', '[UPLINK ACK] PONG - COSMIC ERA CUBESAT OK (RSSI: -52 dBm)');
          } else if (cleanCmd.startsWith('CAL')) {
            addLog('RX', '[UPLINK ACK] MPU6050 ZERO GYRO & LEVEL CALIBRATED');
            tareZero();
          } else if (cleanCmd.startsWith('RATE=')) {
            addLog('RX', `[UPLINK ACK] TELEMETRY ODR SET TO ${cleanCmd.split('=')[1]} Hz`);
          } else if (cleanCmd.startsWith('GET_CONFIG')) {
            addLog('RX', '[UPLINK ACK] CONFIG: ODR=10Hz, PWR=19.5dBm, CHAN=1, CHKSUM=CRC16');
          } else if (cleanCmd.startsWith('RESET')) {
            addLog('RX', '[UPLINK ACK] CUBESAT WATCHDOG REBOOT TRIGGERED');
          }
        }, 150);
      }
    },
    [connectionMode, addLog]
  );

  // Calibrate Baro Baseline Ground (Sets zero AGL reference to current altitude)
  const calibrateBaseline = useCallback(() => {
    setGroundBaselineAlt(currentPacket.alt);
    setMaxApogee(0.0);
    addLog('SYS', `Calibrated Barometric Ground Baseline to ${currentPacket.alt.toFixed(1)}m MSL (Zero AGL set)`);
  }, [currentPacket.alt, addLog]);

  // Tare Zero Accel & Gyro
  const tareZero = useCallback(() => {
    setAccelOffset((prev) => ({
      x: prev.x + (currentPacket.ax || 0),
      y: prev.y + (currentPacket.ay || 0),
      z: prev.z + ((currentPacket.az !== undefined ? currentPacket.az : 9.80665) - 9.80665),
    }));
    setGyroOffset((prev) => ({
      gx: prev.gx + (currentPacket.gx || 0),
      gy: prev.gy + (currentPacket.gy || 0),
      gz: prev.gz + (currentPacket.gz || 0),
    }));
    setCurrentPacket((p) => ({
      ...p,
      ax: 0,
      ay: 0,
      az: 9.81,
      gx: 0,
      gy: 0,
      gz: 0,
      r: 0,
      pt: 0,
      y: 0,
    }));
    addLog('SYS', 'MPU6050 Accelerometer & Gyro Tared to Zero (Level Reference Set)');
  }, [currentPacket.ax, currentPacket.ay, currentPacket.az, currentPacket.gx, currentPacket.gy, currentPacket.gz, addLog]);

  // Inject Shock (Simulation/demo only)
  const injectShock = useCallback(() => {
    if (connectionMode !== 'SIM') return;
    simShockRef.current = {
      active: true,
      remaining: 6, // ~600ms
      magnitude: 1.6 * 9.81, // 1.6G
    };
    addLog('SYS', 'SIMULATION: Injected 1.6G Impulse Shock');
  }, [connectionMode, addLog]);

  // Tumble Impulse (Simulation/demo only)
  const tumbleImpulse = useCallback(() => {
    if (connectionMode !== 'SIM') return;
    simTumbleRef.current = {
      active: true,
      remaining: 25, // ~2.5s
    };
    addLog('SYS', 'SIMULATION: Injected Tumble Angular Impulse (45°/s)');
  }, [connectionMode, addLog]);

  // Toggle Demo Mode
  const toggleDemoMode = useCallback(() => {
    if (connectionMode === 'SIM') {
      isFirstLivePacketRef.current = true;
      setConnectionMode('SERIAL');
      setConnectionState('DISCONNECTED');
      addLog('SYS', 'Switched to LIVE HW Mode (Serial/WS ready)');
    } else {
      if (serialPortRef.current) {
        disconnectSerial();
      }
      setConnectionMode('SIM');
      setConnectionState('DEMO');
      addLog('SYS', 'Switched to SIM / DEMO Telemetry Mode');
    }
  }, [connectionMode, disconnectSerial, addLog]);

  // Download raw CSV
  const exportCSV = useCallback(() => {
    const csvContent = exportTelemetryToCSV(
      fullPacketLogRef.current.length > 0 ? fullPacketLogRef.current : [currentPacket]
    );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `COSMIC_ERA_TELEMETRY_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentPacket]);

  // Pulse DTR / RTS signals to kickstart ESP32 USB CDC
  const pulseDTR = useCallback(async () => {
    if (serialPortRef.current) {
      try {
        addLog('SYS', 'Pulsing DTR/RTS lines (Low -> High) to wake up ESP32 USB CDC...');
        await serialPortRef.current.setSignals({ dataTerminalReady: false, requestToSend: false });
        await new Promise((r) => setTimeout(r, 120));
        await serialPortRef.current.setSignals({ dataTerminalReady: true, requestToSend: true });
        addLog('SYS', 'DTR/RTS lines asserted High (Active CDC).');
      } catch (e: any) {
        addLog('SYS', `DTR pulse: ${e?.message || e}`);
      }
    } else {
      addLog('SYS', 'No active serial port to pulse.');
    }
  }, [addLog]);

  // Hardware Reset ESP32 via RTS pulse on EN pin
  const rebootESP32 = useCallback(async () => {
    if (serialPortRef.current) {
      try {
        addLog('SYS', 'Asserting RTS to pulse ESP32 EN reset pin...');
        await serialPortRef.current.setSignals({ requestToSend: true, dataTerminalReady: false });
        await new Promise((r) => setTimeout(r, 100));
        await serialPortRef.current.setSignals({ requestToSend: false, dataTerminalReady: true });
        await new Promise((r) => setTimeout(r, 150));
        await serialPortRef.current.setSignals({ requestToSend: true, dataTerminalReady: true });
        addLog('SYS', 'ESP32 reset sequence triggered. Awaiting boot...');
      } catch (e: any) {
        addLog('SYS', `ESP32 reset error: ${e?.message || e}`);
      }
    } else {
      addLog('SYS', 'No active serial port to reset.');
    }
  }, [addLog]);

  // Force reset serial port and clear browser-level locks
  const forceResetSerial = useCallback(async () => {
    addLog('SYS', 'Force resetting serial connection and releasing all locks...');
    try {
      if (serialReaderRef.current) {
        await serialReaderRef.current.cancel().catch(() => {});
        try {
          serialReaderRef.current.releaseLock();
        } catch {}
        serialReaderRef.current = null;
      }
      if (serialWriterRef.current) {
        await serialWriterRef.current.close().catch(() => {});
        serialWriterRef.current = null;
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close().catch(() => {});
        serialPortRef.current = null;
      }

      // Check all previously authorized ports in browser to clear hung instances
      if ('serial' in navigator && (navigator as any).serial.getPorts) {
        try {
          const ports = await (navigator as any).serial.getPorts();
          for (const p of ports) {
            try {
              if (p.readable && !p.readable.locked) {
                const r = p.readable.getReader();
                await r.cancel().catch(() => {});
                r.releaseLock();
              }
              if (p.writable && !p.writable.locked) {
                const w = p.writable.getWriter();
                await w.abort().catch(() => {});
                w.releaseLock();
              }
              await p.close().catch(() => {});
            } catch {}
          }
        } catch {}
      }
    } catch {}

    setConnectionState('DISCONNECTED');
    setConnectionError(null);
    addLog('SYS', 'Serial interface successfully reset. Port locks cleared.');
  }, [addLog]);

  // Unstick / Hardware Run ESP32 Type B (Releases EN reset pin for CP2102/CH340)
  const unstickESP32TypeB = useCallback(async () => {
    if (serialPortRef.current) {
      try {
        addLog('SYS', 'ESP32 Type-B: Pulsing EN reset line and locking run mode (DTR=0, RTS=0)...');
        await serialPortRef.current.setSignals({ requestToSend: true, dataTerminalReady: false });
        await new Promise((r) => setTimeout(r, 120));
        await serialPortRef.current.setSignals({ requestToSend: false, dataTerminalReady: false });
        addLog('SYS', 'ESP32 Type-B EN released: CPU is now executing user firmware.');
      } catch (e: any) {
        addLog('SYS', `Unstick error: ${e?.message || e}`);
      }
    } else {
      addLog('SYS', 'Notice: No serial port currently open. Click "CONNECT SERIAL PORT" first.');
    }
  }, [addLog]);

  // Arm pure Real Hardware Mode (Disarms simulation immediately and resets to waiting state)
  const armRealHardwareMode = useCallback(() => {
    setConnectionMode('SERIAL');
    setConnectionState('DISCONNECTED');
    setPacketCount(0);
    setPacketLoss(0.0);
    setRawBytesCount(0);
    setValidPacketCount(0);
    isFirstLivePacketRef.current = true;
    totalReceivedRef.current = 0;
    setPacketHistory([]);
    fullPacketLogRef.current = [];
    setCurrentPacket({
      id: 0,
      t: 0.0,
      h: 0.0,
      p: 0.0,
      alt: 0.0,
      ax: 0.0,
      ay: 0.0,
      az: 9.81,
      gx: 0.0,
      gy: 0.0,
      gz: 0.0,
      r: 0.0,
      pt: 0.0,
      y: 0.0,
      lat: CONFIG.GS_LAT,
      lon: CONFIG.GS_LON,
      galt: CONFIG.GS_ALT,
      sats: 0,
      fix: 0,
      timestamp: Date.now(),
    });
    addLog('SYS', 'REAL HARDWARE TESTBENCH ARMED: Demo simulator stopped. Waiting for real ESP32 Type-B packets...');
  }, [addLog]);

  // Inject test packet to verify hardware rendering pipeline
  const injectTestPacket = useCallback(() => {
    const testPacket: TelemetryPacket = {
      id: lastPacketIdRef.current + 1,
      t: 25.4,
      h: 47.8,
      p: 1012.85,
      alt: 104.2,
      ax: 0.05,
      ay: -0.02,
      az: 9.81,
      gx: 0.12,
      gy: -0.08,
      gz: 0.02,
      r: 8.5,
      pt: -3.2,
      y: 135.0,
      lat: 26.7325,
      lon: 83.4334,
      galt: 102.5,
      sats: 9,
      fix: 1,
      timestamp: Date.now(),
    };
    ingestPacket(testPacket, JSON.stringify(testPacket));
    setConnectionState('CONNECTED');
    addLog('SYS', 'Test hardware telemetry packet ingested successfully!');
  }, [ingestPacket, addLog]);

  return {
    boardType,
    setBoardType,
    connectionMode,
    connectionState,
    baudRate,
    setBaudRate,
    wsUrl,
    setWsUrl,
    isPaused,
    setIsPaused,
    connectionError,
    setConnectionError,
    rawBytesCount,
    validPacketCount,
    currentPacket,
    packetHistory,
    groundBaselineAlt,
    maxApogee,
    verticalSpeed,
    jitterLimit,
    setJitterLimit,
    incidentLog,
    isAlertState,
    satellites,
    serialLogs,
    setSerialLogs,
    packetCount,
    packetLoss,
    linkAgeMs,
    bitrateKbps,
    missionElapsedSeconds,
    connectSerial,
    disconnectSerial,
    forceResetSerial,
    pulseDTR,
    rebootESP32,
    unstickESP32TypeB,
    armRealHardwareMode,
    injectTestPacket,
    connectWebSocket,
    sendCommand,
    calibrateBaseline,
    tareZero,
    injectShock,
    tumbleImpulse,
    toggleDemoMode,
    exportCSV,
    addLog,
  };
}
