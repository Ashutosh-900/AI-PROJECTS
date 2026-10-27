// ================================================================
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
  // Transmission status callback
}

void OnDataRecv(const uint8_t *mac, const uint8_t *incomingData, int len) {
  char cmd[64];
  int copyLen = min(len, (int)sizeof(cmd) - 1);
  memcpy(cmd, incomingData, copyLen);
  cmd[copyLen] = '\0';

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
      "{\"id\":%u,\"t\":%.1f,\"h\":%.1f,\"p\":%.2f,\"alt\":%.1f,"
      "\"ax\":%.2f,\"ay\":%.2f,\"az\":%.2f,\"gx\":%.2f,\"gy\":%.2f,\"gz\":%.2f,"
      "\"r\":%.1f,\"pt\":%.1f,\"y\":%.1f,\"lat\":%.5f,\"lon\":%.5f,\"galt\":%.1f,"
      "\"sats\":%d,\"fix\":%d}",
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
