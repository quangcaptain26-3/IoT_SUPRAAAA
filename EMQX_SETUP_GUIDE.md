# 🚀 Hướng dẫn Setup EMQX Cloud cho IoT Project

## 📋 Tổng quan

Hướng dẫn này sẽ giúp bạn migrate từ MQTT local (Aedes) sang **EMQX Cloud** để:

- ✅ Frontend trên Vercel có thể kết nối MQTT
- ✅ ESP8266 có thể kết nối từ bất kỳ đâu
- ✅ Backend API (`qiotbe.dev1.vimaru.edu.vn`) có thể publish/subscribe messages
- ✅ Không phụ thuộc vào máy local

## 🎯 Kiến trúc hệ thống

### ❌ Hiện tại (Local MQTT - KHÔNG hoạt động với Vercel):

```
Frontend (Local)  ──WS──→  MQTT Local (máy bạn)  ←──  ESP8266 (cùng mạng)
                                ↑
                          Backend Local
```

**Vấn đề:**

- Frontend trên Vercel KHÔNG thể kết nối MQTT local!
- ESP8266 chỉ kết nối được khi cùng mạng với máy bạn
- Phải chạy MQTT broker 24/7 trên máy

### ✅ Sau khi setup EMQX Cloud:

```
┌─────────────────────┐
│  Frontend (Vercel)  │
│  app.js             │
└──────────┬──────────┘
           │ WSS:8084
           ▼
    ┌──────────────────┐
    │  EMQX Cloud      │ ◄──── TLS:8883 ──── ESP8266 (WiFi bất kỳ)
    │  MQTT Broker     │
    └──────────────────┘
           ▲
           │ TLS:8883
           │
┌──────────┴──────────────────┐
│  Backend (Hosted)           │
│  qiotbe.dev1.vimaru.edu.vn  │
└─────────────────────────────┘
```

**Lợi ích:**

- ✅ Tất cả đều kết nối EMQX Cloud qua Internet
- ✅ Frontend Vercel hoạt động bình thường
- ✅ ESP8266 kết nối từ bất kỳ WiFi nào
- ✅ Backend chỉ cần thêm MQTT client (vài dòng code)

---

## 🎯 Bước 1: Đăng ký EMQX Cloud

### 1.1. Tạo tài khoản

1. Truy cập: https://www.emqx.com/en/cloud
2. Click **"Start Free"** hoặc **"Sign Up"**
3. Đăng ký bằng email hoặc GitHub

### 1.2. Tạo Deployment (Serverless - Free)

1. Sau khi đăng nhập, click **"New Deployment"**
2. Chọn **"Serverless"** (Free tier)
   - 1M session minutes/tháng
   - Đủ cho dự án IoT nhỏ
3. Cấu hình:
   - **Name**: `iot-led-display` (hoặc tên bạn muốn)
   - **Region**: Chọn **Singapore** hoặc **Tokyo** (gần Việt Nam nhất)
   - **Cloud Provider**: AWS hoặc GCP (tùy chọn)
4. Click **"Create"**
5. Đợi 2-3 phút để deployment được tạo

### 1.3. Lấy thông tin kết nối

Sau khi deployment sẵn sàng, bạn sẽ thấy:

```
Cluster Name: xxx.emqxsl.com
Connection Address: xxx.emqxsl.com
Port (MQTT): 8883 (TLS/SSL)
Port (WebSocket): 8084 (WSS)
```

**📝 Lưu lại thông tin này!** Bạn sẽ cần dùng trong các bước sau.

---

## 🔐 Bước 2: Tạo Authentication (Username/Password)

### 2.1. Vào Authentication Settings

1. Trong deployment dashboard, click **"Authentication"** (menu bên trái)
2. Click **"Add"** hoặc **"Create Authentication"**

### 2.2. Tạo credentials cho từng client

#### **Client 1: ESP8266**

```
Username: esp8266_client
Password: esp8266_secure_password_123
```

#### **Client 2: Backend (qiotbe.dev1.vimaru.edu.vn)**

```
Username: backend_client
Password: backend_secure_password_456
```

#### **Client 3: Frontend (Web)**

```
Username: web_client
Password: web_secure_password_789
```

**⚠️ Lưu ý:** Thay đổi password thành password mạnh của bạn!

---

## ⚙️ Bước 3: Cập nhật Backend Code

### 3.1. Cài đặt thư viện MQTT client

Backend của bạn (`qiotbe.dev1.vimaru.edu.vn`) cần thư viện `mqtt`:

```bash
cd backend
npm install mqtt
```

### 3.2. Tạo file `backend/mqttClient.js` (EMQX version)

File này sẽ **THAY THẾ** `mqttBroker.js` khi dùng EMQX Cloud:

```javascript
/**
 * MQTT Client kết nối đến EMQX Cloud
 * Thay thế Aedes broker local
 */
import mqtt from "mqtt";
import { LogModel } from "./models/Log.js";

let mqttClient = null;
let logModel = null;

/**
 * Khởi tạo MQTT Client kết nối EMQX Cloud
 */
export function initMqttClient(db) {
  return new Promise((resolve, reject) => {
    try {
      logModel = new LogModel(db);

      const options = {
        clientId: `backend_${Math.random().toString(16).substr(2, 8)}`,
        username: process.env.EMQX_USERNAME || "backend_client",
        password: process.env.EMQX_PASSWORD || "backend_secure_password_456",
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      };

      // Kết nối EMQX Cloud với TLS
      const broker = process.env.EMQX_BROKER || "xxx.emqxsl.com";
      const port = process.env.EMQX_PORT || 8883;
      const url = `mqtts://${broker}:${port}`;

      console.log(`🔌 Đang kết nối EMQX Cloud: ${url}`);

      mqttClient = mqtt.connect(url, options);

      mqttClient.on("connect", () => {
        console.log("✅ Đã kết nối EMQX Cloud!");
        console.log(`   Client ID: ${options.clientId}`);
        resolve(mqttClient);
      });

      mqttClient.on("error", (error) => {
        console.error("❌ MQTT Client error:", error);
        reject(error);
      });

      mqttClient.on("close", () => {
        console.log("🔌 MQTT Client đã đóng");
      });

      mqttClient.on("reconnect", () => {
        console.log("🔄 Đang kết nối lại EMQX...");
      });

      // Subscribe các topics để log
      mqttClient.on("message", async (topic, message) => {
        try {
          console.log(`📥 Nhận message từ ${topic}: ${message.toString()}`);
          await logModel.save({
            topic: topic,
            message: message.toString(),
            direction: "received",
          });
        } catch (error) {
          console.error("❌ Lỗi lưu log:", error);
        }
      });
    } catch (error) {
      console.error("❌ Lỗi khởi tạo MQTT Client:", error);
      reject(error);
    }
  });
}

/**
 * Lấy client instance
 */
export function getClient() {
  return mqttClient;
}

/**
 * Publish message
 */
export function publish(topic, message, options = {}) {
  if (!mqttClient || !mqttClient.connected) {
    console.error("❌ MQTT Client chưa kết nối");
    return Promise.reject(new Error("MQTT Client not connected"));
  }

  return new Promise((resolve, reject) => {
    const payload =
      typeof message === "string" ? message : JSON.stringify(message);

    mqttClient.publish(
      topic,
      payload,
      {
        qos: options.qos || 0,
        retain: options.retain || false,
      },
      (error) => {
        if (error) {
          console.error(`❌ Lỗi publish đến ${topic}:`, error);
          reject(error);
        } else {
          console.log(
            `📤 Đã publish đến ${topic}: ${payload.substring(0, 50)}`
          );
          resolve();
        }
      }
    );
  });
}

/**
 * Subscribe topic
 */
export function subscribe(topic) {
  if (!mqttClient || !mqttClient.connected) {
    console.error("❌ MQTT Client chưa kết nối");
    return;
  }

  mqttClient.subscribe(topic, (error) => {
    if (error) {
      console.error(`❌ Lỗi subscribe ${topic}:`, error);
    } else {
      console.log(`📥 Đã subscribe ${topic}`);
    }
  });
}

/**
 * Đóng MQTT Client
 */
export function closeClient() {
  return new Promise((resolve) => {
    if (mqttClient) {
      mqttClient.end(() => {
        console.log("✅ Đã đóng MQTT Client");
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// Export tương thích với code cũ
export const getBroker = getClient;
export const closeBroker = closeClient;
```

### 3.3. Cập nhật `backend/server.js`

Thay đổi import từ `mqttBroker.js` sang `mqttClient.js`:

**Cũ:**

```javascript
import { initMqttBroker, publish } from "./mqttBroker.js";
```

**Mới:**

```javascript
import { initMqttClient, publish } from "./mqttClient.js";
```

Và trong hàm `startServer()`:

**Cũ:**

```javascript
await initMqttBroker(db);
```

**Mới:**

```javascript
await initMqttClient(db);
```

### 3.4. Cập nhật file `.env` trên server

Thêm các biến môi trường EMQX vào file `.env` trên server `qiotbe.dev1.vimaru.edu.vn`:

```env
# ==================== EMQX Cloud Configuration ====================
EMQX_BROKER=xxx.emqxsl.com
EMQX_PORT=8883
EMQX_USERNAME=backend_client
EMQX_PASSWORD=backend_secure_password_456

# ==================== API Keys ====================
WEATHER_API_KEY=your_openweathermap_api_key
EXCHANGE_API_KEY=your_exchangerate_api_key
```

**Thay thế:**

- `xxx.emqxsl.com` → Cluster address từ EMQX Dashboard
- `backend_secure_password_456` → Password bạn đã tạo ở Bước 2

### 3.5. Restart Backend Server

Sau khi cập nhật code và `.env`, restart server:

```bash
# Nếu dùng PM2
pm2 restart all

# Hoặc restart service theo cách bạn deploy
```

Kiểm tra log:

```
✅ Đã kết nối EMQX Cloud!
```

---

## 🌐 Bước 4: Cập nhật Frontend Code

### 4.1. Cập nhật `frontend/app.js`

Tìm phần kết nối MQTT và thay đổi:

**Cũ (Local MQTT):**

```javascript
// Line 9-11
const API_BASE = `http://${window.location.hostname}:3000`;
const MQTT_BROKER = `ws://${window.location.hostname}:9001/mqtt`;
let mqttClient = null;
```

**Mới (EMQX Cloud):**

```javascript
// Line 9-11
const API_BASE = "https://qiotbe.dev1.vimaru.edu.vn";
const MQTT_BROKER = "wss://xxx.emqxsl.com:8084/mqtt";
const MQTT_OPTIONS = {
  clientId: `web_client_${Math.random().toString(16).substr(2, 8)}`,
  username: "web_client",
  password: "web_secure_password_789",
  clean: true,
  reconnectPeriod: 5000,
};
let mqttClient = null;
```

**Thay thế:**

- `xxx.emqxsl.com` → Cluster address của bạn
- `web_secure_password_789` → Password bạn đã tạo ở Bước 2

### 4.2. Cập nhật hàm `connectMQTT()`

Tìm hàm `connectMQTT()` (khoảng line 19-49) và sửa:

**Cũ:**

```javascript
function connectMQTT() {
  try {
    mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: `web_client_${Math.random().toString(16).substr(2, 8)}`,
      reconnectPeriod: 5000,
    });

    // ... rest of code
  }
}
```

**Mới:**

```javascript
function connectMQTT() {
  try {
    console.log("🔌 Đang kết nối EMQX Cloud:", MQTT_BROKER);
    mqttClient = mqtt.connect(MQTT_BROKER, MQTT_OPTIONS);

    mqttClient.on("connect", () => {
      console.log("✅ Đã kết nối EMQX Cloud!");
      updateMQTTStatus("connected");
    });

    mqttClient.on("error", (error) => {
      console.error("❌ MQTT error:", error);
      updateMQTTStatus("disconnected");
    });

    mqttClient.on("close", () => {
      console.log("🔌 MQTT đã đóng");
      updateMQTTStatus("disconnected");
    });

    mqttClient.on("reconnect", () => {
      console.log("🔄 Đang kết nối lại MQTT...");
      updateMQTTStatus("connecting");
    });
  } catch (error) {
    console.error("❌ Lỗi kết nối MQTT:", error);
    updateMQTTStatus("disconnected");
  }
}
```

### 4.3. Tạo file `frontend/config.js` (Optional - Best practice)

Để dễ quản lý config:

```javascript
// frontend/config.js
export const CONFIG = {
  // API Backend
  API_BASE: "https://qiotbe.dev1.vimaru.edu.vn",

  // EMQX Cloud MQTT
  MQTT: {
    broker: "wss://xxx.emqxsl.com:8084/mqtt",
    username: "web_client",
    password: "web_secure_password_789",
  },
};
```

Sau đó import trong `app.js`:

```javascript
import { CONFIG } from "./config.js";

const API_BASE = CONFIG.API_BASE;
const MQTT_BROKER = CONFIG.MQTT.broker;
const MQTT_OPTIONS = {
  clientId: `web_client_${Math.random().toString(16).substr(2, 8)}`,
  username: CONFIG.MQTT.username,
  password: CONFIG.MQTT.password,
  clean: true,
  reconnectPeriod: 5000,
};
```

---

## 🔧 Bước 5: Cập nhật ESP8266 Code

### 5.1. Cài đặt thư viện SSL/TLS

Trong Arduino IDE:

1. **Sketch** → **Include Library** → **Manage Libraries**
2. Tìm và cài: **WiFiClientSecure**

### 5.2. Cập nhật `esp8266/led_display.ino`

#### Thêm include và WiFiClientSecure:

**Tìm dòng 17-22:**

```cpp
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <MD_Parola.h>
#include <MD_MAX72XX.h>
#include <SPI.h>
```

**Thêm sau dòng 17:**

```cpp
#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>  // ← THÊM DÒNG NÀY
#include <PubSubClient.h>
#include <MD_Parola.h>
#include <MD_MAX72XX.h>
#include <SPI.h>
```

#### Cập nhật MQTT Configuration (Line 27-31):

**Cũ:**

```cpp
const char* mqtt_server = "qiot-mqtt.dev1.vimaru.edu.vn";
const int mqtt_port = 1883;
const char* mqtt_client_id = "ESP8266_LED_Display";
```

**Mới:**

```cpp
// ==================== MQTT Configuration (EMQX Cloud) ====================
const char* mqtt_server = "xxx.emqxsl.com";  // ← Thay bằng cluster của bạn
const int mqtt_port = 8883;  // TLS/SSL port
const char* mqtt_user = "esp8266_client";
const char* mqtt_password = "esp8266_secure_password_123";  // ← Thay password
const char* mqtt_client_id = "ESP8266_LED_Display";
```

#### Cập nhật WiFiClient (Line 51-53):

**Cũ:**

```cpp
MD_Parola myDisplay = MD_Parola(HARDWARE_TYPE, CS_PIN, MAX_DEVICES);
WiFiClient espClient;
PubSubClient client(espClient);
```

**Mới:**

```cpp
MD_Parola myDisplay = MD_Parola(HARDWARE_TYPE, CS_PIN, MAX_DEVICES);
WiFiClientSecure espClient;  // ← Đổi thành WiFiClientSecure
PubSubClient client(espClient);
```

#### Cập nhật hàm `setup()` (Line 69-98):

Thêm sau dòng `Serial.begin(115200);`:

```cpp
void setup() {
  Serial.begin(115200);
  delay(100);

  // ← THÊM DÒNG NÀY: Bỏ qua verify SSL certificate
  espClient.setInsecure();

  Serial.println("\n\n=== ESP8266 LED Matrix Display ===");

  // ... rest of code
}
```

#### Cập nhật hàm `connect_mqtt()` (Line 159-196):

**Cũ:**

```cpp
if (client.connect(mqtt_client_id)) {
  Serial.println(" ✅ Đã kết nối MQTT!");
  // ...
}
```

**Mới:**

```cpp
if (client.connect(mqtt_client_id, mqtt_user, mqtt_password)) {
  Serial.println(" ✅ Đã kết nối EMQX Cloud!");
  Serial.print("  Username: ");
  Serial.println(mqtt_user);

  // Subscribe các topics
  client.subscribe(topic_weather_led);
  client.subscribe(topic_exchange_led);
  client.subscribe(topic_custom_message);
  client.subscribe(topic_led_settings);

  Serial.println("📥 Đã subscribe các topics");
} else {
  Serial.print("❌ Lỗi kết nối MQTT, rc=");
  Serial.println(client.state());
  Serial.println("  Mã lỗi:");
  Serial.println("  -4 = MQTT_CONNECTION_TIMEOUT");
  Serial.println("  -3 = MQTT_CONNECTION_LOST");
  Serial.println("  -2 = MQTT_CONNECT_FAILED");
  Serial.println("  -1 = MQTT_DISCONNECTED");
  Serial.println("  Đang thử lại sau 5 giây...");
  delay(5000);
}
```

### 5.3. Upload code lên ESP8266

1. Kết nối ESP8266 với máy tính
2. Chọn đúng Board và Port trong Arduino IDE
3. Click **Upload**
4. Mở Serial Monitor (115200 baud) để xem log

**Log thành công:**

```
✅ WiFi đã kết nối!
📍 IP address: 192.168.x.x
✅ Đã kết nối EMQX Cloud!
  Username: esp8266_client
📥 Đã subscribe các topics
✅ Setup hoàn tất
```

---

## 🧪 Bước 6: Testing

### 6.1. Test EMQX Dashboard (WebSocket Client)

1. Vào EMQX Cloud Dashboard
2. Click **"WebSocket Client"** (menu bên trái)
3. Điền thông tin:
   ```
   Host: wss://xxx.emqxsl.com:8084/mqtt
   Username: web_client
   Password: web_secure_password_789
   ```
4. Click **"Connect"**
5. Subscribe topic: `home/custom/message`
6. Publish test message:
   ```
   Topic: home/custom/message
   Message: Hello from EMQX!
   ```
7. Kiểm tra ESP8266 có nhận được không (xem Serial Monitor)

### 6.2. Test Backend

SSH vào server `qiotbe.dev1.vimaru.edu.vn` và kiểm tra log:

```bash
# Xem log (nếu dùng PM2)
pm2 logs

# Hoặc xem log service
journalctl -u your-service-name -f
```

**Log mong đợi:**

```
🔌 Đang kết nối EMQX Cloud: mqtts://xxx.emqxsl.com:8883
✅ Đã kết nối EMQX Cloud!
   Client ID: backend_xxxxx
```

### 6.3. Test Frontend (Local trước)

1. Mở `frontend/index.html` trong browser
2. Mở Console (F12)
3. Kiểm tra log:
   ```
   🔌 Đang kết nối EMQX Cloud: wss://xxx.emqxsl.com:8084/mqtt
   ✅ Đã kết nối EMQX Cloud!
   ```
4. Kiểm tra status trên UI: **MQTT Status: Connected**
5. Thử gửi custom message và xem ESP8266 có nhận không

### 6.4. Test End-to-End

**Test 1: Gửi custom message**

1. Frontend: Nhập message "Test 123" → Click "Gửi Message"
2. Backend: Nhận request → Publish MQTT
3. ESP8266: Nhận message → Hiển thị trên LED

**Test 2: Hiển thị thời tiết**

1. Frontend: Click "Hiển thị thời tiết"
2. Backend: Fetch weather API → Publish MQTT
3. ESP8266: Nhận weather data → Hiển thị trên LED

**Test 3: Hiển thị tỷ giá**

1. Frontend: Chọn USD/VND → Click "Hiển thị lên LED"
2. Backend: Fetch exchange API → Publish MQTT
3. ESP8266: Nhận exchange data → Hiển thị trên LED

---

## 🚀 Bước 7: Deploy Frontend lên Vercel

### 7.1. Chuẩn bị code

Đảm bảo `frontend/app.js` đã có:

```javascript
const API_BASE = "https://qiotbe.dev1.vimaru.edu.vn";
const MQTT_BROKER = "wss://xxx.emqxsl.com:8084/mqtt";
```

### 7.2. Tạo file `vercel.json`

Tạo file `frontend/vercel.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
```

### 7.3. Deploy lên Vercel

**Cách 1: Dùng Vercel CLI**

```bash
cd frontend
npm install -g vercel
vercel login
vercel deploy --prod
```

**Cách 2: Dùng GitHub + Vercel Dashboard**

1. Push code lên GitHub
2. Vào https://vercel.com
3. Click **"New Project"**
4. Import repository
5. Chọn `frontend` folder làm root directory
6. Click **"Deploy"**

### 7.4. Kiểm tra sau khi deploy

1. Truy cập URL Vercel của bạn (ví dụ: `https://your-app.vercel.app`)
2. Mở Console (F12)
3. Kiểm tra:
   - ✅ Kết nối EMQX Cloud thành công
   - ✅ Gọi API `qiotbe.dev1.vimaru.edu.vn` thành công
   - ✅ Gửi message đến ESP8266 thành công

---

## 📊 Kiến trúc hoàn chỉnh sau khi setup

```
┌─────────────────────────────────┐
│  Frontend (Vercel)              │
│  https://your-app.vercel.app    │
│  - app.js kết nối EMQX WSS      │
│  - Gọi API qiotbe...            │
└────────────┬────────────────────┘
             │
             │ WSS:8084
             │ (WebSocket Secure)
             ▼
      ┌──────────────────────┐
      │  EMQX Cloud          │
      │  xxx.emqxsl.com      │
      │  - Port 8883 (TLS)   │ ◄──── TLS:8883 ──── ESP8266 (WiFi bất kỳ)
      │  - Port 8084 (WSS)   │                      - Nhận MQTT messages
      └──────────────────────┘                      - Hiển thị LED Matrix
             ▲
             │ TLS:8883
             │ (MQTT over TLS)
             │
┌────────────┴────────────────────┐
│  Backend (Hosted)               │
│  qiotbe.dev1.vimaru.edu.vn      │
│  - REST API endpoints           │
│  - MQTT Client publish messages │
│  - Fetch Weather/Exchange APIs  │
└─────────────────────────────────┘
```

**Luồng hoạt động:**

1. User truy cập Frontend trên Vercel
2. Frontend gọi API đến Backend (`qiotbe.dev1.vimaru.edu.vn`)
3. Backend xử lý request → Publish MQTT message đến EMQX Cloud
4. EMQX Cloud forward message đến ESP8266
5. ESP8266 nhận message → Hiển thị trên LED Matrix

---

## ⚠️ Lưu ý quan trọng

### 🔒 Security

1. **Không commit credentials vào Git**

   ```bash
   # Thêm vào .gitignore
   .env
   frontend/config.js
   ```

2. **Dùng environment variables cho production**

   - Backend: Dùng `.env` file
   - Frontend: Có thể dùng Vercel Environment Variables

3. **Thay đổi password mạnh**

   - Không dùng password mẫu trong hướng dẫn
   - Dùng password generator

4. **Luôn dùng TLS/SSL**
   - Backend: `mqtts://` (port 8883)
   - Frontend: `wss://` (port 8084)
   - ESP8266: WiFiClientSecure + setInsecure()

### 📊 EMQX Free Tier Limits

**Giới hạn:**

- 1M session minutes/tháng
- ~694 hours = ~29 days liên tục

**Cách tối ưu:**

- ✅ Dùng QoS 0 (không cần acknowledge)
- ✅ Set `clean: true` (không lưu session)
- ✅ Giảm `reconnectPeriod` nếu cần
- ✅ Đóng connection khi không dùng

**Nếu vượt quá:**

- Upgrade lên Dedicated plan ($0.50/hour)
- Hoặc tối ưu code để giảm session time

### 🐛 Troubleshooting

#### **Lỗi: Connection refused**

```
❌ MQTT Client error: Connection refused
```

**Giải pháp:**

- Kiểm tra username/password đúng chưa
- Kiểm tra đã tạo authentication trong EMQX Dashboard chưa
- Kiểm tra firewall rules

#### **Lỗi: SSL handshake failed**

```
❌ SSL handshake failed
```

**Giải pháp:**

- ESP8266: Đảm bảo đã gọi `espClient.setInsecure()`
- Backend: Dùng `mqtts://` thay vì `mqtt://`
- Frontend: Dùng `wss://` thay vì `ws://`

#### **Lỗi: Too many connections**

```
❌ rc=-2 MQTT_CONNECT_FAILED
```

**Giải pháp:**

- Kiểm tra có bao nhiêu client đang kết nối (EMQX Dashboard → Clients)
- Đóng các connection cũ
- Đảm bảo `clientId` là unique

#### **Lỗi: CORS khi gọi API từ Vercel**

```
❌ CORS policy: No 'Access-Control-Allow-Origin'
```

**Giải pháp:**

- Thêm CORS headers trong Backend:
  ```javascript
  app.use(
    cors({
      origin: ["https://your-app.vercel.app"],
      credentials: true,
    })
  );
  ```

#### **ESP8266 không kết nối được**

```
❌ Lỗi kết nối MQTT, rc=-2
```

**Giải pháp:**

- Kiểm tra WiFi đã kết nối chưa
- Kiểm tra `mqtt_server` đúng chưa (không có `https://`)
- Kiểm tra port 8883 (không phải 1883)
- Kiểm tra username/password
- Thử ping `xxx.emqxsl.com` từ máy tính

---

## 🎉 Hoàn thành!

Bây giờ bạn có hệ thống IoT hoàn chỉnh:

✅ **Frontend trên Vercel** - Truy cập từ bất kỳ đâu  
✅ **Backend trên qiotbe.dev1.vimaru.edu.vn** - API ổn định  
✅ **EMQX Cloud** - MQTT broker miễn phí, reliable  
✅ **ESP8266** - Kết nối từ bất kỳ WiFi nào

**Không còn phụ thuộc máy local! 🚀**

---

## 📚 Tài liệu tham khảo

- EMQX Cloud: https://docs.emqx.com/en/cloud/latest/
- MQTT.js: https://github.com/mqttjs/MQTT.js
- PubSubClient (ESP8266): https://pubsubclient.knolleary.net/
- Vercel Deployment: https://vercel.com/docs

---

## 💬 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:

1. EMQX Dashboard → Clients (xem client có kết nối không)
2. EMQX Dashboard → Topics (xem message có được publish không)
3. Browser Console (F12) → Xem lỗi frontend
4. Backend logs → Xem lỗi backend
5. ESP8266 Serial Monitor → Xem lỗi ESP8266

**Chúc bạn thành công! 🎊**
