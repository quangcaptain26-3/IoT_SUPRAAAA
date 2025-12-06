# Hướng dẫn cấu hình .env

## Tạo file .env

```bash
# Copy từ template
cp env.example .env

# Hoặc tạo mới
touch .env
```

## Cấu hình ExchangeRate API Key

Nếu bạn có API key từ ExchangeRate API:

1. Mở file `.env`
2. Tìm dòng `# EXCHANGE_API_KEY=your_api_key_here`
3. Bỏ dấu `#` và thay `your_api_key_here` bằng API key của bạn:

```env
EXCHANGE_API_KEY=abc123xyz789
```

4. Lưu file

Hệ thống sẽ tự động:

- Sử dụng API có key nếu `EXCHANGE_API_KEY` được set
- Sử dụng free API nếu không có key

## Các biến môi trường khác

### Server

- `PORT`: Port của Express server (mặc định: 3000)

### MQTT

- `MQTT_PORT`: Port của MQTT broker (mặc định: 1883)
- `MQTT_HOST`: Host của MQTT broker (mặc định: localhost)

### API

- `WEATHER_API`: URL của Weather API (mặc định: Open-Meteo)
- `EXCHANGE_API`: URL của Exchange API (chỉ dùng nếu không có key)
- `EXCHANGE_API_KEY`: API key cho ExchangeRate API

### Database

- `DB_PATH`: Đường dẫn đến file SQLite (mặc định: ./database.sqlite)

### Cron

- `WEATHER_INTERVAL`: Khoảng thời gian lấy thời tiết (giây, mặc định: 300)
- `EXCHANGE_INTERVAL`: Khoảng thời gian lấy tỉ giá (giây, mặc định: 600)

### Location

- `DEFAULT_LAT`: Vĩ độ mặc định (mặc định: 10.762622 - HCM)
- `DEFAULT_LON`: Kinh độ mặc định (mặc định: 106.660172 - HCM)

## Ví dụ file .env hoàn chỉnh

```env
# Server
PORT=3000

# MQTT
MQTT_PORT=1883
MQTT_HOST=localhost

# ExchangeRate API Key (bỏ comment và thay bằng key của bạn)
EXCHANGE_API_KEY=your_actual_api_key_here

# Database
DB_PATH=./database.sqlite

# Cron (giây)
WEATHER_INTERVAL=300
EXCHANGE_INTERVAL=600

# Default Location
DEFAULT_LAT=10.762622
DEFAULT_LON=106.660172
```

## Lưu ý

- ✅ File `.env` đã được thêm vào `.gitignore` - không lo lộ API key
- ✅ Sau khi sửa `.env`, cần restart server để áp dụng thay đổi
- ✅ Không commit file `.env` lên git
