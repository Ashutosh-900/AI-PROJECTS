# ORBITRA Ground Station — COSMIC ERA

**ORBITRA'26 CubeSat Mission Control Dashboard**  
**Team:** COSMIC ERA  
**Institution:** Madan Mohan Malaviya University of Technology (MMMUT), Gorakhpur  
**Club:** Drone & IoT Club  

---

## 🛰️ Architecture & Data Pipeline

```
[Onboard CubeSat ESP32 TX]
  ├── DHT11 (Temperature & Humidity)
  ├── BMP280 (Pressure & Barometric Altitude)
  ├── MPU6050 (Acceleration, Gyroscope & Attitude Filter)
  └── NEO-6M (GPS Lat, Lon, Altitude, Fix & Satellites)
       │
       ▼ (ESP-NOW 2.4 GHz Low-Latency Wireless)
[Ground Station ESP32 RX]
       │
       ▼ (USB Serial 115200 baud, 8-N-1)
[Web Dashboard (React + Vite + TypeScript + Three.js)]
       ├── Web Serial API (Direct USB connection in Chrome/Edge)
       └── OR Node.js bridge.js (Serial -> ws://localhost:8081)
```

---

## ⚡ Quick Start Instructions

### 1. Install & Run Dashboard Locally
```bash
# Install dependencies
npm install

# Start local mission control dev server
npm run dev
```
Open **http://localhost:3000** in Google Chrome or Microsoft Edge.

---

### 2. Flashing the ESP32 Hardware

#### A. Onboard CubeSat Transmitter
- Open `firmware/onboard_cubesat_tx/onboard_cubesat_tx.ino` in Arduino IDE.
- Required Libraries:
  - `Adafruit BMP280 Library`
  - `Adafruit MPU6050`
  - `DHT sensor library by Adafruit`
  - `TinyGPSPlus`
- Select Board: `ESP32 Dev Module` and click **Upload**.

#### B. Ground Station Receiver
- Open `firmware/ground_station_rx/ground_station_rx.ino` in Arduino IDE.
- Select Board: `ESP32 Dev Module` and click **Upload**.
- Plug this ESP32 into your laptop via USB.

---

### 3. Connecting to the Dashboard

#### Option A: Direct Web Serial (Recommended - Zero Installation)
1. In the dashboard, go to the **MISSION CONTROLS** tab (or bottom bar of Tab 1).
2. Click **SELECT & OPEN SERIAL PORT**.
3. Select your ESP32 COM port and click **Connect**.
4. Telemetry will begin streaming immediately at 115200 baud!

#### Option B: Node.js WebSocket Bridge
If you prefer running a background serial forwarder:
```bash
npm install serialport @serialport/parser-readline ws
node bridge.js COM3 115200
```
Then click **Connect WS** in the Mission Controls tab.

---

## 📐 Hardware Wiring Pinout Guide

### Power Architecture
- **2S Li-ion Battery (7.4V - 8.4V)** $\to$ **LM2596 DC-DC Buck Converter** set to **5.00V DC**.
- 5V Output feeds ESP32 `VIN` and sensor rails.

### Sensor Connections
| Component | ESP32 Pin | Sensor Pin | Notes |
|---|---|---|---|
| **MPU6050** | GPIO 21 | SDA | I2C Data (0x68) |
| **MPU6050** | GPIO 22 | SCL | I2C Clock |
| **BMP280** | GPIO 21 | SDA | Shared I2C Data (0x76) |
| **BMP280** | GPIO 22 | SCL | Shared I2C Clock |
| **DHT11** | GPIO 4 | DATA | 10kΩ pull-up to 3.3V |
| **NEO-6M GPS** | GPIO 16 (RX2) | TX | GPS Transmit $\to$ ESP32 Receive |
| **NEO-6M GPS** | GPIO 17 (TX2) | RX | GPS Receive $\leftarrow$ ESP32 Transmit |

---

## 📦 Exporting Telemetry Data
At any point during the mission:
1. Click **EXPORT CSV (RAW)** in the bottom controls or Mission Controls tab.
2. The dashboard will instantly download a timestamped CSV containing all raw sensor readings, Euler angles, GPS coordinates, and packet metrics.
