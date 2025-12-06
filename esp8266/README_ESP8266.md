# Hướng dẫn cài đặt ESP8266

## Yêu cầu phần cứng

- ESP8266 (NodeMCU hoặc D1 Mini)
- MAX7219 LED Matrix Module (1-4 modules)
- Dây nối
- Nguồn 5V

## Kết nối phần cứng

```
MAX7219    ->    ESP8266
VCC        ->    5V
GND        ->    GND
DIN        ->    D7 (GPIO13)
CS         ->    D8 (GPIO15)
CLK        ->    D5 (GPIO14)
```

## Cài đặt Arduino IDE

1. Cài đặt Arduino IDE (version 1.8.x hoặc mới hơn)
2. Thêm ESP8266 board support:
   - File -> Preferences
   - Thêm URL: `http://arduino.esp8266.com/stable/package_esp8266com_index.json`
   - Tools -> Board -> Boards Manager
   - Tìm "esp8266" và cài đặt

## Cài đặt Libraries

1. **PubSubClient** (MQTT):

   - Sketch -> Include Library -> Manage Libraries
   - Tìm "PubSubClient" và cài đặt

2. **MD_Parola** và **MD_MAX72XX**:
   - Sketch -> Include Library -> Manage Libraries
   - Tìm "MD_Parola" và cài đặt (sẽ tự động cài MD_MAX72XX)

## Cấu hình code

Mở file `led_display.ino` và cập nhật:

```cpp
// WiFi
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Server
const char* mqtt_server = "192.168.1.100"; // IP của server chạy MQTT broker
```

## Upload code

1. Chọn board: Tools -> Board -> NodeMCU 1.0 (ESP-12E Module)
2. Chọn port: Tools -> Port -> COMx (port của ESP8266)
3. Upload: Sketch -> Upload

## Kiểm tra

Sau khi upload, mở Serial Monitor (115200 baud) để xem log:

- Kết nối WiFi
- Kết nối MQTT
- Nhận messages từ topics

## Troubleshooting

- **Không kết nối WiFi**: Kiểm tra SSID và password
- **Không kết nối MQTT**: Kiểm tra IP server và port (1883)
- **LED không hiển thị**: Kiểm tra kết nối dây, đặc biệt là CS pin
- **Message bị cắt**: Tăng timeout hoặc giảm độ dài message
