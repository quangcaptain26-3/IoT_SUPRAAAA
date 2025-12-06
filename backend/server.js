/**
 * Main server file
 * Khởi tạo Express API, MQTT Broker, và các services
 */

import express from "express";
import cors from "cors";
import { initDatabase, query } from "./database.js";
import { initMqttBroker, publish } from "./mqttBroker.js";
import { config } from "./config.js";
import { WeatherModel } from "./models/Weather.js";
import { ExchangeModel } from "./models/Exchange.js";
import { MessageModel } from "./models/Message.js";
import { LogModel } from "./models/Log.js";
import { WeatherService } from "./services/weatherService.js";
import { ExchangeService } from "./services/exchangeService.js";
import { PublisherService } from "./services/publisher.js";
import mqtt from "mqtt";
import { CronJob } from "cron";

const app = express();
let db = null;
let mqttClient = null;
let weatherService = null;
let exchangeService = null;
let publisherService = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("../frontend")); // Serve static files

/**
 * Khởi tạo MQTT Client để publish messages
 */
function initMqttClient() {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(
      `mqtt://${config.mqtt.host}:${config.mqtt.port}`
    );

    client.on("connect", () => {
      console.log("✅ MQTT Client đã kết nối");
      resolve(client);
    });

    client.on("error", (error) => {
      console.error("❌ MQTT Client error:", error);
      reject(error);
    });
  });
}

/**
 * Khởi tạo cron jobs để tự động lấy dữ liệu
 */
function initCronJobs() {
  // Cron job cho thời tiết (mỗi 5 phút)
  const weatherJob = new CronJob(
    `*/${config.cron.weatherInterval} * * * * *`, // Mỗi X giây
    async () => {
      try {
        console.log("⏰ Cron job: Lấy dữ liệu thời tiết...");
        await weatherService.fetchWeather();
      } catch (error) {
        console.error("❌ Lỗi cron job thời tiết:", error);
      }
    },
    null,
    true,
    "Asia/Ho_Chi_Minh"
  );

  // Cron job cho tỉ giá (mỗi 10 phút)
  const exchangeJob = new CronJob(
    `*/${config.cron.exchangeInterval} * * * * *`, // Mỗi X giây
    async () => {
      try {
        console.log("⏰ Cron job: Lấy dữ liệu tỉ giá...");
        await exchangeService.fetchExchange();
      } catch (error) {
        console.error("❌ Lỗi cron job tỉ giá:", error);
      }
    },
    null,
    true,
    "Asia/Ho_Chi_Minh"
  );

  console.log("✅ Đã khởi tạo cron jobs");
}

// ==================== API ROUTES ====================

/**
 * API: Cập nhật vị trí (lat/lon) cho thời tiết
 */
app.post("/api/weather/location", async (req, res) => {
  try {
    const { lat, lon } = req.body;

    if (!lat || !lon) {
      return res.status(400).json({ error: "Thiếu lat hoặc lon" });
    }

    weatherService.setLocation(parseFloat(lat), parseFloat(lon));

    // Lấy dữ liệu ngay lập tức
    const weatherData = await weatherService.fetchWeather();

    res.json({ success: true, data: weatherData });
  } catch (error) {
    console.error("❌ Lỗi cập nhật vị trí:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Lấy dữ liệu thời tiết mới nhất
 */
app.get("/api/weather/current", async (req, res) => {
  try {
    const data = await weatherService.getLatest();
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Lỗi lấy dữ liệu thời tiết:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Lấy lịch sử thời tiết
 */
app.get("/api/weather/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const data = await weatherService.getHistory(limit, offset);
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Lỗi lấy lịch sử thời tiết:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Lấy dữ liệu tỉ giá mới nhất
 */
app.get("/api/exchange/current", async (req, res) => {
  try {
    const base = req.query.base || "USD";
    const target = req.query.target || "VND";

    let data = await exchangeService.getLatest(base, target);

    // Nếu không tìm thấy cặp tiền trực tiếp, thử convert qua USD
    if (!data && base !== "USD" && target !== "USD") {
      const baseToUSD = await exchangeService.getLatest("USD", base);
      const targetToUSD = await exchangeService.getLatest("USD", target);

      if (baseToUSD && targetToUSD) {
        const rate = targetToUSD.rate / baseToUSD.rate;
        data = {
          base_currency: base,
          target_currency: target,
          rate: rate,
          created_at: new Date().toISOString(),
          converted: true,
        };
      }
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Lỗi lấy dữ liệu tỉ giá:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Hiển thị tỷ giá lên LED
 */
app.post("/api/exchange/display", async (req, res) => {
  try {
    const { base, target } = req.body;

    if (!base || !target) {
      return res.status(400).json({ error: "Thiếu base hoặc target currency" });
    }

    // Lấy dữ liệu tỷ giá
    let exchangeData = await exchangeService.getLatest(base, target);

    // Nếu không tìm thấy cặp tiền trực tiếp, thử convert qua USD
    if (!exchangeData && base !== "USD" && target !== "USD") {
      console.log(
        `⚠️  Không tìm thấy ${base}/${target}, đang convert qua USD...`
      );

      // Lấy base/USD và target/USD
      const baseToUSD = await exchangeService.getLatest("USD", base);
      const targetToUSD = await exchangeService.getLatest("USD", target);

      if (baseToUSD && targetToUSD) {
        // Convert: base/target = (USD/target) / (USD/base)
        const rate = targetToUSD.rate / baseToUSD.rate;
        exchangeData = {
          base_currency: base,
          target_currency: target,
          rate: rate,
          created_at: new Date().toISOString(),
          converted: true, // Đánh dấu là đã convert
        };
        console.log(`✅ Đã convert ${base}/${target} = ${rate.toFixed(2)}`);
      }
    }

    if (!exchangeData) {
      return res.status(404).json({
        error: `Không tìm thấy dữ liệu tỷ giá cho ${base}/${target}`,
        suggestion: "Vui lòng thử lại sau hoặc chọn cặp tiền khác",
      });
    }

    // Format và publish lên LED
    const ledText = `${base}/${target}: ${exchangeData.rate.toFixed(2)}`;
    await publisherService.publishCustomMessage(ledText);

    res.json({
      success: true,
      message: "Đã gửi tỷ giá lên LED",
      data: exchangeData,
    });
  } catch (error) {
    console.error("❌ Lỗi hiển thị tỷ giá:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Lấy lịch sử tỉ giá
 */
app.get("/api/exchange/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const data = await exchangeService.getHistory(limit, offset);
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Lỗi lấy lịch sử tỉ giá:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Gửi custom message đến LED
 */
app.post("/api/message/send", async (req, res) => {
  try {
    const { message, mode } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Thiếu message" });
    }

    const result = await publisherService.publishCustomMessage(message, mode);
    res.json(result);
  } catch (error) {
    console.error("❌ Lỗi gửi message:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Lấy lịch sử messages
 */
app.get("/api/message/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const messageModel = new MessageModel(db);
    const data = await messageModel.getHistory(limit, offset);
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Lỗi lấy lịch sử messages:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Cập nhật LED settings
 */
app.post("/api/led/settings", async (req, res) => {
  try {
    const { mode, speed, brightness } = req.body;

    const settings = {};
    if (mode) settings.mode = mode;
    if (speed !== undefined) settings.speed = parseInt(speed);
    if (brightness !== undefined) settings.brightness = parseInt(brightness);

    const result = await publisherService.publishLedSettings(settings);
    res.json(result);
  } catch (error) {
    console.error("❌ Lỗi cập nhật LED settings:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Lấy logs MQTT
 */
app.get("/api/logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const topic = req.query.topic || null;
    const logModel = new LogModel(db);
    const data = await logModel.getHistory(limit, offset, topic);
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Lỗi lấy logs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: AUTO mode - Hiển thị thời gian
 */
app.post("/api/auto/time", async (req, res) => {
  try {
    const now = new Date();
    const timeText = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const dateText = now.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    });

    const displayText = `${timeText} - ${dateText}`;
    await publisherService.publishCustomMessage(displayText);

    res.json({
      success: true,
      message: "Đã gửi thời gian lên LED",
      data: { time: timeText, date: dateText },
    });
  } catch (error) {
    console.error("❌ Lỗi hiển thị thời gian:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: AUTO mode - Hiển thị thời tiết
 */
app.post("/api/auto/weather", async (req, res) => {
  try {
    const weatherData = await weatherService.getLatest();

    if (!weatherData) {
      return res.status(404).json({ error: "Không có dữ liệu thời tiết" });
    }

    const weatherText = `${weatherData.description} - ${weatherData.temperature}°C - ${weatherData.humidity}%`;
    await publisherService.publishCustomMessage(weatherText);

    res.json({
      success: true,
      message: "Đã gửi thời tiết lên LED",
      data: weatherData,
    });
  } catch (error) {
    console.error("❌ Lỗi hiển thị thời tiết:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * API: Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mqtt: mqttClient ? "connected" : "disconnected",
  });
});

// ==================== MAIN ====================

/**
 * Khởi động server
 */
async function startServer() {
  try {
    // 1. Khởi tạo database
    console.log("📦 Đang khởi tạo database...");
    db = await initDatabase();

    // 2. Khởi tạo MQTT Broker
    console.log("📡 Đang khởi tạo MQTT Broker...");
    await initMqttBroker(db);

    // 3. Khởi tạo MQTT Client
    console.log("📡 Đang khởi tạo MQTT Client...");
    mqttClient = await initMqttClient();

    // 4. Khởi tạo services
    console.log("⚙️  Đang khởi tạo services...");
    weatherService = new WeatherService(db, mqttClient);
    exchangeService = new ExchangeService(db, mqttClient);
    publisherService = new PublisherService(db, mqttClient);

    // 5. Lấy dữ liệu ban đầu
    console.log("📥 Đang lấy dữ liệu ban đầu...");
    await weatherService.fetchWeather();
    await exchangeService.fetchExchange();

    // 6. Khởi tạo cron jobs
    initCronJobs();

    // 7. Khởi động Express server
    app.listen(config.port, () => {
      console.log(`✅ Server đang chạy trên http://localhost:${config.port}`);
      console.log(`✅ MQTT Broker: mqtt://localhost:${config.mqtt.port}`);
      console.log(`✅ Frontend: http://localhost:${config.port}/index.html`);
    });
  } catch (error) {
    console.error("❌ Lỗi khởi động server:", error);
    process.exit(1);
  }
}

// Xử lý graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Đang tắt server...");
  if (mqttClient) {
    mqttClient.end();
  }
  process.exit(0);
});

// Khởi động
startServer();
