// ================================================================
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
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) {
      // Forward command over ESP-NOW to the CubeSat
      esp_now_send(cubeSatMac, (uint8_t *)cmd.c_str(), cmd.length());
    }
  }
}
