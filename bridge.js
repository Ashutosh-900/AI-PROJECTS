/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 * 
 * SERIAL TO WEBSOCKET BRIDGE (bridge.js)
 * -------------------------------------------------------------------------
 * Bridges incoming serial packets from the Ground Station ESP32 COM port
 * to a local WebSocket server at ws://localhost:8081 for the dashboard.
 * 
 * Requirements:
 *   npm install serialport ws
 * 
 * Usage:
 *   node bridge.js [COM_PORT] [BAUD_RATE]
 *   Example (Windows): node bridge.js COM3 115200
 *   Example (Linux/Mac): node bridge.js /dev/ttyUSB0 115200
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { WebSocketServer } = require('ws');

const DEFAULT_PORT = process.argv[2] || 'COM3';
const BAUD_RATE = parseInt(process.argv[3], 10) || 115200;
const WS_PORT = 8081;

console.log('================================================================');
console.log('  ORBITRA 2026 // COSMIC ERA // MMMUT GORAKHPUR');
console.log('  ESP32 Serial -> WebSocket Bridge');
console.log('================================================================');

// Initialize WebSocket Server
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`[WS] Server listening on ws://localhost:${WS_PORT}`);

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Dashboard client connected (Total: ${clients.size})`);

  ws.on('message', (message) => {
    const text = message.toString().trim();
    console.log(`[UPLINK from Web] -> ${text}`);
    if (serial && serial.isOpen) {
      serial.write(text + '\n');
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Dashboard client disconnected (Total: ${clients.size})`);
  });
});

// Broadcast line to all connected dashboard WebSocket clients
function broadcast(data) {
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  }
}

// Connect to Serial Port
let serial;
try {
  console.log(`[SERIAL] Opening ${DEFAULT_PORT} at ${BAUD_RATE} baud...`);
  serial = new SerialPort({
    path: DEFAULT_PORT,
    baudRate: BAUD_RATE,
    autoOpen: true,
  });

  const parser = serial.pipe(new ReadlineParser({ delimiter: '\n' }));

  serial.on('open', () => {
    console.log(`[SERIAL] Connected successfully to ${DEFAULT_PORT}!`);
    console.log('[SERIAL] Streaming telemetry packets to dashboard...');
  });

  parser.on('data', (line) => {
    const clean = line.trim();
    if (clean.length > 0) {
      broadcast(clean);
    }
  });

  serial.on('error', (err) => {
    console.error(`[SERIAL ERROR] ${err.message}`);
    console.log('Tip: Check if the ESP32 is plugged in and no other terminal (Arduino Serial Monitor) is using the port.');
  });
} catch (err) {
  console.error(`[INIT ERROR] Could not open ${DEFAULT_PORT}: ${err.message}`);
}
