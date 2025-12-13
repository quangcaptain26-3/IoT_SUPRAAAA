/**
 * ESP8266 LED Matrix Display với MAX7219
 * Kết nối MQTT và hiển thị dữ liệu từ các topics
 * 
 * Hardware:
 * - ESP8266 (NodeMCU hoặc D1 Mini)
 * - MAX7219 LED Matrix Module
 * 
 * Connections:
 * - MAX7219 VCC -> 5V
 * - MAX7219 GND -> GND
 * - MAX7219 DIN -> D7 (GPIO13)
 * - MAX7219 CS -> D8 (GPIO15)
 * - MAX7219 CLK -> D5 (GPIO14)
 */

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>  // SSL/TLS support for EMQX Cloud
#include <PubSubClient.h>
#include <MD_Parola.h>
#include <MD_MAX72XX.h>
#include <SPI.h>

// ==================== WiFi Configuration ====================
const char* ssid = "PhamMinhQuang";        // Thay bằng SSID WiFi của bạn
const char* password = "26032004"; // Thay bằng password WiFi của bạn

// ==================== MQTT Configuration (EMQX Cloud) ====================
const char* mqtt_server = "z0d3bf33.ala.asia-southeast1.emqxsl.com";  // EMQX Cloud cluster
const int mqtt_port = 8883;  // TLS/SSL port
const char* mqtt_user = "esp8266_client";
const char* mqtt_password = "esp123";  
const char* mqtt_client_id = "ESP8266_LED_Display_001";  // Unique client ID

// MQTT Topics
const char* topic_weather_raw = "home/weather/raw";
const char* topic_weather_led = "home/weather/led";
const char* topic_exchange_raw = "home/exchange/raw";
const char* topic_exchange_led = "home/exchange/led";
const char* topic_custom_message = "home/custom/message";
const char* topic_led_settings = "home/led/settings";

// ==================== MAX7219 Configuration ====================
#define HARDWARE_TYPE MD_MAX72XX::FC16_HW
#define MAX_DEVICES 4  // Số lượng MAX7219 modules (4 modules = 32x8 pixels)

// Pin definitions cho ESP8266
#define DATA_PIN   13  // D7
#define CS_PIN     15  // D8
#define CLK_PIN    14  // D5

// Tạo instances
MD_Parola myDisplay = MD_Parola(HARDWARE_TYPE, CS_PIN, MAX_DEVICES);
WiFiClientSecure espClient;  // SSL/TLS client for EMQX Cloud
PubSubClient client(espClient);

// ==================== LED Settings ====================
struct LedSettings {
  textEffect_t effect = PA_SCROLL_LEFT;  // Mặc định scroll trái
  uint8_t speed = 50;                     // Tốc độ delay (ms): nhỏ = nhanh, lớn = chậm
  uint8_t brightness = 8;                 // Độ sáng (0-15)
  bool pause = false;                     // Tạm dừng
};

LedSettings currentSettings;
String currentMessage = "";
unsigned long lastMessageTime = 0;
const unsigned long messageTimeout = 30000; // 30 giây timeout

// Flag để ưu tiên message từ nút (custom message)
bool priorityMode = false;
unsigned long priorityModeEndTime = 0;
const unsigned long priorityModeDuration = 60000; // 60 giây ưu tiên sau khi nhận custom message

// ==================== Setup ====================
void setup() {
  Serial.begin(115200);
  delay(100);
  
  // Bỏ qua verify SSL certificate (cần thiết cho EMQX Cloud)
  espClient.setInsecure();
  
  Serial.println("\n\n=== ESP8266 LED Matrix Display ===");
  
  // Khởi tạo display
  myDisplay.begin();
  myDisplay.setIntensity(currentSettings.brightness);
  myDisplay.displayClear();
  myDisplay.displayText("Init...", PA_CENTER, currentSettings.speed, 0, PA_NO_EFFECT, PA_NO_EFFECT);
  
  // Kết nối WiFi
  setup_wifi();
  
  // Kết nối MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqtt_callback);
  client.setBufferSize(512);  // Tăng buffer size cho SSL
  client.setKeepAlive(60);  // Keep alive 60 giây
  client.setSocketTimeout(15);  // Socket timeout 15 giây
  
  // Hiển thị thông báo kết nối
  myDisplay.displayText("Connecting...", PA_CENTER, currentSettings.speed, 0, PA_NO_EFFECT, PA_NO_EFFECT);
  connect_mqtt();
  
  // Hiển thị "Ready"
  myDisplay.displayText("Ready!", PA_CENTER, currentSettings.speed, 0, PA_NO_EFFECT, PA_NO_EFFECT);
  delay(2000);
  myDisplay.displayClear();
  
  Serial.println("[OK] Setup hoan tat");
}

// ==================== Main Loop ====================
void loop() {
  // Kiểm tra kết nối MQTT
  if (!client.connected()) {
    connect_mqtt();
  }
  client.loop();
  
  // Cập nhật display
  if (myDisplay.displayAnimate()) {
    // Display animation đã hoàn thành
    if (currentMessage.length() > 0) {
      // Hiển thị lại message với settings hiện tại
      myDisplay.setSpeed(currentSettings.speed);
      myDisplay.displayText(currentMessage.c_str(), PA_CENTER, 
                           currentSettings.speed, 0, currentSettings.effect, currentSettings.effect);
    }
  }
  
  // Kiểm tra timeout message
  if (currentMessage.length() > 0 && 
      (millis() - lastMessageTime) > messageTimeout) {
    currentMessage = "";
    myDisplay.displayClear();
  }
  
  // Reset priority mode khi hết hạn
  if (priorityMode && millis() > priorityModeEndTime) {
    priorityMode = false;
    Serial.println("[TIME] Het thoi gian uu tien, cho phep nhan message tu dong");
  }
  
  delay(10);
}

// ==================== WiFi Setup ====================
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("[WIFI] Dang ket noi WiFi: ");
  Serial.println(ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[OK] WiFi da ket noi!");
    Serial.print("[IP] IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[ERROR] Khong the ket noi WiFi");
    myDisplay.displayText("WiFi Error", PA_CENTER, currentSettings.speed, 0, PA_NO_EFFECT, PA_NO_EFFECT);
  }
}

// ==================== MQTT Connection ====================
void connect_mqtt() {
  while (!client.connected()) {
    Serial.println("\n[MQTT] Dang ket noi MQTT...");
    Serial.print("  ESP8266 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("  MQTT Server: ");
    Serial.print(mqtt_server);
    Serial.print(":");
    Serial.println(mqtt_port);
    Serial.print("  Username: ");
    Serial.println(mqtt_user);
    
    // Thử kết nối với timeout dài hơn cho SSL
    Serial.println("  Đang thực hiện SSL handshake...");
    
    if (client.connect(mqtt_client_id, mqtt_user, mqtt_password)) {
      Serial.println("[OK] Da ket noi EMQX Cloud!");
      Serial.print("  Username: ");
      Serial.println(mqtt_user);
      
      // Subscribe các topics
      client.subscribe(topic_weather_led);
      client.subscribe(topic_exchange_led);
      client.subscribe(topic_custom_message);
      client.subscribe(topic_led_settings);
      
      Serial.println("[SUB] Da subscribe cac topics:");
      Serial.println("  - home/weather/led");
      Serial.println("  - home/exchange/led");
      Serial.println("  - home/custom/message");
      Serial.println("  - home/led/settings");
    } else {
      int state = client.state();
      Serial.print("[ERROR] Loi ket noi MQTT, rc=");
      Serial.println(state);
      Serial.println("  Mã lỗi:");
      Serial.println("  -4 = MQTT_CONNECTION_TIMEOUT");
      Serial.println("  -3 = MQTT_CONNECTION_LOST");
      Serial.println("  -2 = MQTT_CONNECT_FAILED");
      Serial.println("  -1 = MQTT_DISCONNECTED");
      Serial.println("  4 = MQTT_CONNECTION_REFUSED (Username/Password sai hoặc server từ chối)");
      Serial.println("  5 = MQTT_DISCONNECTED");
      
      // Kiểm tra lỗi cụ thể
      if (state == 4) {
        Serial.println("  [WARN] Co the do:");
        Serial.println("     - Username/Password sai");
        Serial.println("     - Client ID đã tồn tại");
        Serial.println("     - Server từ chối kết nối");
      }
      
      Serial.println("  Đang thử lại sau 5 giây...");
      delay(5000);
    }
  }
}

// ==================== MQTT Callback ====================
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  // Convert payload to string
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  
  Serial.print("[MSG] Nhan message tu topic: ");
  Serial.print(topic);
  Serial.print(" -> ");
  Serial.println(message);
  
  // Xử lý theo topic
  if (strcmp(topic, topic_led_settings) == 0) {
    handle_led_settings(message);
  } else if (strcmp(topic, topic_custom_message) == 0) {
    // Message từ nút - ưu tiên cao nhất
    priorityMode = true;
    priorityModeEndTime = millis() + priorityModeDuration;
    Serial.println("[PRIORITY] Uu tien message tu nut (60 giay)");
    handle_display_message(message);
  } else if (strcmp(topic, topic_weather_led) == 0 || strcmp(topic, topic_exchange_led) == 0) {
    // Message từ cron jobs tự động - chỉ xử lý nếu không đang trong priority mode
    Serial.print("[WEATHER/EXCHANGE] Nhan message, priorityMode=");
    Serial.print(priorityMode);
    Serial.print(", timeLeft=");
    if (priorityMode) {
      long timeLeft = (priorityModeEndTime - millis()) / 1000;
      Serial.print(timeLeft);
      Serial.println("s");
    } else {
      Serial.println("0s");
    }
    
    if (!priorityMode || millis() > priorityModeEndTime) {
      priorityMode = false; // Reset priority mode nếu đã hết hạn
      Serial.println("[WEATHER/EXCHANGE] Xu ly va hien thi message");
      handle_display_message(message);
    } else {
      Serial.println("[SKIP] Bo qua message tu dong (dang trong che do uu tien)");
    }
  } else {
    // Các topic khác: hiển thị message
    handle_display_message(message);
  }
}

// ==================== Handle LED Settings ====================
void handle_led_settings(const char* json) {
  // Parse JSON đơn giản (có thể dùng ArduinoJson library cho phức tạp hơn)
  // Format: {"mode":"scroll_left","speed":50,"brightness":8}
  
  Serial.println("[SETTINGS] Cap nhat LED settings...");
  
  bool settingsChanged = false;
  
  // Parse mode
  if (strstr(json, "scroll_left") != NULL) {
    currentSettings.effect = PA_SCROLL_LEFT;
    settingsChanged = true;
    Serial.println("  Mode: Scroll Left");
  } else if (strstr(json, "scroll_right") != NULL) {
    currentSettings.effect = PA_SCROLL_RIGHT;
    settingsChanged = true;
    Serial.println("  Mode: Scroll Right");
  } else if (strstr(json, "blink") != NULL) {
    currentSettings.effect = PA_BLINDS;
    settingsChanged = true;
    Serial.println("  Mode: Blink (using BLINDS effect)");
  }
  
  // Parse speed (tìm "speed":X)
  // Frontend gửi 0-100, cần convert sang delay time (ms)
  // 0 = chậm nhất (200ms), 100 = nhanh nhất (10ms)
  char* speedPtr = strstr(json, "\"speed\":");
  if (speedPtr != NULL) {
    int speedValue = atoi(speedPtr + 8);
    if (speedValue >= 0 && speedValue <= 100) {
      // Convert: 0->200ms, 100->10ms
      currentSettings.speed = map(speedValue, 0, 100, 200, 10);
      settingsChanged = true;
      Serial.print("  Speed value: ");
      Serial.print(speedValue);
      Serial.print(" -> Delay: ");
      Serial.print(currentSettings.speed);
      Serial.println("ms");
    }
  }
  
  // Parse brightness (tìm "brightness":X)
  char* brightnessPtr = strstr(json, "\"brightness\":");
  if (brightnessPtr != NULL) {
    int brightness = atoi(brightnessPtr + 13);
    if (brightness >= 0 && brightness <= 15) {
      currentSettings.brightness = brightness;
      myDisplay.setIntensity(brightness);
      Serial.print("  Brightness: ");
      Serial.println(brightness);
    }
  }
  
  // Áp dụng settings mới cho message hiện tại
  if (settingsChanged) {
    if (currentMessage.length() > 0) {
      Serial.println("  Áp dụng settings mới cho message hiện tại...");
      myDisplay.displayReset();  // Reset animation
      myDisplay.setSpeed(currentSettings.speed);
      myDisplay.displayText(currentMessage.c_str(), PA_CENTER, 
                           currentSettings.speed, 0, currentSettings.effect, currentSettings.effect);
    } else {
      Serial.println("  Settings đã được lưu, sẽ áp dụng cho message tiếp theo");
    }
  }
}

// ==================== Handle Display Message ====================
void handle_display_message(const char* message) {
  currentMessage = String(message);
  lastMessageTime = millis();
  
  // Giới hạn độ dài message
  if (currentMessage.length() > 100) {
    currentMessage = currentMessage.substring(0, 100);
  }
  
  // Hiển thị message với settings hiện tại
  myDisplay.displayReset();  // Reset animation trước khi hiển thị message mới
  myDisplay.setSpeed(currentSettings.speed);
  myDisplay.displayText(currentMessage.c_str(), PA_CENTER, 
                       currentSettings.speed, 0, currentSettings.effect, currentSettings.effect);
  
  Serial.print("[DISPLAY] Hien thi: ");
  Serial.println(currentMessage);
  Serial.print("   Mode: ");
  if (currentSettings.effect == PA_SCROLL_LEFT) {
    Serial.print("Scroll Left");
  } else if (currentSettings.effect == PA_SCROLL_RIGHT) {
    Serial.print("Scroll Right");
  } else if (currentSettings.effect == PA_BLINDS) {
    Serial.print("Blink");
  } else {
    Serial.print("Unknown");
  }
  Serial.print(" | Tốc độ: ");
  Serial.print(currentSettings.speed);
  Serial.println("ms");
}

