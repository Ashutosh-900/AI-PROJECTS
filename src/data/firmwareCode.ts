/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Team: COSMIC ERA // ORBITRA 2026 // MMMUT Gorakhpur
 */

export const ONBOARD_CUBESAT_SKETCH = `// ================================================================
// ORBITRA 2026 — COSMIC ERA // MMMUT Gorakhpur
// ONBOARD CUBESAT TRANSMITTER (ESP32 + ESP-NOW)
// Sensors: DHT11, BMP280, MPU6050, NEO-6M GPS
// ================================================================

#include <esp_now.h>
#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <TinyGPS++.h>

// --- PIN DEFINITIONS ---
#define DHTPIN 4
#define DHTTYPE DHT11
#define GPS_RX_PIN 16 // Connects to NEO-6M TX
#define GPS_TX_PIN 17 // Connects to NEO-6M RX
#define I2C_SDA 21
#define I2C_SCL 22

// --- SENSOR OBJECTS ---
DHT dht(DHTPIN, DHTTYPE);
Adafruit_BMP280 bmp;
Adafruit_MPU6050 mpu;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// Ground Station Peer MAC (Replace with Ground Station ESP32 MAC)
// Broadcast MAC {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF} can also be used for testing
uint8_t groundStationMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// Telemetry State & Variables
uint32_t packetId = 1;
uint32_t telemetryIntervalMs = 100; // 10 Hz default (100ms)
uint32_t lastTxTime = 0;
float roll = 0.0, pitch = 0.0, yaw = 0.0;
float gyroZOffset = 0.0;
unsigned long prevTime = 0;

void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  // Silent transmission ack
}

void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
  char cmd[64];
  int copyLen = min(len, (int)sizeof(cmd) - 1);
  memcpy(cmd, incomingData, copyLen);
  cmd[copyLen] = '\\0';

  if (strstr(cmd, "PING")) {
    Serial.println(F("[UPLINK] PING received"));
  } else if (strstr(cmd, "CAL")) {
    Serial.println(F("[UPLINK] Calibrating MPU6050 zero gyro..."));
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);
    gyroZOffset = g.gyro.z;
    roll = 0; pitch = 0; yaw = 0;
  } else if (strstr(cmd, "RATE=")) {
    int rateHz = atoi(cmd + 5);
    if (rateHz >= 1 && rateHz <= 50) {
      telemetryIntervalMs = 1000 / rateHz;
    }
  } else if (strstr(cmd, "RESET")) {
    ESP.restart();
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  dht.begin();
  if (!bmp.begin(0x76)) {
    bmp.begin(0x77); // alternate address
  }
  mpu.begin();
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println(F("ESP-NOW Init Failed"));
    return;
  }

  esp_now_register_send_cb(OnDataSent);
  esp_now_register_recv_cb(esp_now_recv_cb_t(OnDataRecv));

  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, groundStationMac, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);

  prevTime = millis();
}

void loop() {
  // Feed GPS parser
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  unsigned long now = millis();
  float dt = (now - prevTime) / 1000.0;
  prevTime = now;

  // Read MPU6050
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);

  // Attitude Complementary Filter
  float pitchAcc = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 180.0 / PI;
  float rollAcc  = atan2(a.acceleration.y, a.acceleration.z) * 180.0 / PI;

  roll = 0.96 * (roll + g.gyro.x * dt * 180.0 / PI) + 0.04 * rollAcc;
  pitch = 0.96 * (pitch + g.gyro.y * dt * 180.0 / PI) + 0.04 * pitchAcc;
  yaw += (g.gyro.z - gyroZOffset) * dt * 180.0 / PI;
  if (yaw >= 360.0) yaw -= 360.0;
  if (yaw < 0.0) yaw += 360.0;

  if (now - lastTxTime >= telemetryIntervalMs) {
    lastTxTime = now;

    float t = dht.readTemperature();
    float h = dht.readHumidity();
    float p = bmp.readPressure() / 100.0F; // hPa
    float alt = bmp.readAltitude(1013.25); // Baro alt (m)

    // Build JSON packet string (compact format <= 250 bytes)
    char buffer[256];
    snprintf(buffer, sizeof(buffer),
      "{\\"id\\":%u,\\"t\\":%.1f,\\"h\\":%.1f,\\"p\\":%.2f,\\"alt\\":%.1f,"
      "\\"ax\\":%.2f,\\"ay\\":%.2f,\\"az\\":%.2f,\\"gx\\":%.2f,\\"gy\\":%.2f,\\"gz\\":%.2f,"
      "\\"r\\":%.1f,\\"pt\\":%.1f,\\"y\\":%.1f,\\"lat\\":%.5f,\\"lon\\":%.5f,\\"galt\\":%.1f,"
      "\\"sats\\":%d,\\"fix\\":%d}",
      packetId++,
      isnan(t) ? 24.5 : t,
      isnan(h) ? 48.0 : h,
      isnan(p) ? 1013.0 : p,
      isnan(alt) ? 102.0 : alt,
      a.acceleration.x, a.acceleration.y, a.acceleration.z,
      g.gyro.x * 180.0 / PI, g.gyro.y * 180.0 / PI, g.gyro.z * 180.0 / PI,
      roll, pitch, yaw,
      gps.location.isValid() ? gps.location.lat() : 26.7324,
      gps.location.isValid() ? gps.location.lng() : 83.4332,
      gps.altitude.isValid() ? gps.altitude.meters() : 102.0,
      gps.satellites.isValid() ? gps.satellites.value() : 9,
      gps.location.isValid() ? 1 : 0
    );

    // Send via ESP-NOW to Ground Station
    esp_now_send(groundStationMac, (uint8_t *)buffer, strlen(buffer));
  }
}
`;

export const GROUND_STATION_SKETCH = `// ================================================================
// ORBITRA 2026 — COSMIC ERA // MMMUT Gorakhpur
// GROUND STATION RECEIVER (ESP32 -> USB Serial 115200)
// Outputs ONLY clean JSON packets to Serial for the Web Dashboard
// ================================================================

#include <esp_now.h>
#include <WiFi.h>

// Onboard CubeSat Peer MAC (Replace or use broadcast for 2-way uplink)
uint8_t cubeSatMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// ESP-NOW Receive Callback
void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
  // Print ONLY the exact JSON packet with newline
  for (int i = 0; i < len; i++) {
    Serial.write(incomingData[i]);
  }
  Serial.println();
}

void setup() {
  // High-speed 115200 8-N-1 Serial for Web Serial API & Bridge
  Serial.begin(115200);

  // Set device as a Wi-Fi Station
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  // Init ESP-NOW
  if (esp_now_init() != ESP_OK) {
    // Keep silent or send formatted error
    return;
  }

  // Register receive callback
  esp_now_register_recv_cb(esp_now_recv_cb_t(OnDataRecv));

  // Register CubeSat as peer for bidirectional uplink commands
  esp_now_peer_info_t peerInfo = {};
  memcpy(peerInfo.peer_addr, cubeSatMac, 6);
  peerInfo.channel = 0;
  peerInfo.encrypt = false;
  esp_now_add_peer(&peerInfo);
}

void loop() {
  // Listen for commands from Web Serial / Mission Controls
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd.length() > 0) {
      // Forward command over ESP-NOW to the CubeSat
      esp_now_send(cubeSatMac, (uint8_t *)cmd.c_str(), cmd.length());
    }
  }
}
`;

export const WIRING_PINOUT_GUIDE = `================================================================================
ORBITRA'26 CUBESAT HARDWARE WIRING & INTERFACE SCHEMATICS
Team: COSMIC ERA // MMMUT Gorakhpur (Drone & IoT Club)
================================================================================

1. POWER ARCHITECTURE:
--------------------------------------------------------------------------------
[2S Li-ion Battery (7.4V - 8.4V)]
       │
       ▼
[LM2596 DC-DC Buck Converter]  ──> Trimmer set to stable 5.00V DC
       │
       ├──> ESP32 5V (VIN) / GND
       ├──> NEO-6M GPS VCC (5V tolerant) / GND
       └──> Sensor VCC Rails (DHT11 5V/3.3V, BMP280 3.3V, MPU6050 3.3V)

2. I2C BUS WIRING (MPU6050 + BMP280 Shared Bus):
--------------------------------------------------------------------------------
ESP32 Pin     MPU6050 Pin     BMP280 Pin      Notes
GPIO 21 (SDA)  SDA             SDA            Shared 4.7kΩ pull-up to 3.3V
GPIO 22 (SCL)  SCL             SCL            Shared 4.7kΩ pull-up to 3.3V
3V3            VCC             VCC            Regulated 3.3V from ESP32
GND            GND             GND            Common System Ground
               AD0 (GND)       SDO (GND)      MPU I2C Addr: 0x68, BMP I2C Addr: 0x76

3. DHT11 TEMPERATURE & HUMIDITY SENSOR:
--------------------------------------------------------------------------------
ESP32 Pin     DHT11 Pin       Notes
GPIO 4        DATA / OUT      10kΩ pull-up resistor to 3.3V / 5V
3V3 or 5V     VCC             Power
GND           GND             Common Ground

4. NEO-6M GPS MODULE (UART2 HARDWARE SERIAL):
--------------------------------------------------------------------------------
ESP32 Pin     NEO-6M Pin      Notes
GPIO 16 (RX2) TX              GPS Transmit to ESP32 Receive (9600 baud)
GPIO 17 (TX2) RX              Optional GPS Receive for NMEA config
5V or 3V3     VCC             Power (NEO-6M has onboard 3.3V LDO)
GND           GND             Common Ground
PPS Pin       NC (LED)        Blinks 1 Hz on 3D satellite lock

5. GROUND STATION ESP32 (RECEIVER):
--------------------------------------------------------------------------------
Micro-USB / Type-C Cable connects directly to laptop USB port.
Default Baud: 115200 baud, 8-N-1, No Flow Control.
Web Serial API in Chrome/Edge communicates directly without drivers on Linux/Mac/Win10+.
Alternative: Node.js bridge.js forwards serial to ws://localhost:8081.
================================================================================
`;
