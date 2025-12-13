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
        username: process.env.EMQX_USERNAME || "qiot-be",
        password: process.env.EMQX_PASSWORD || "qbe123",
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      };

      // Kết nối EMQX Cloud với TLS
      const broker = process.env.EMQX_BROKER || "z0d3bf33.ala.asia-southeast1.emqxsl.com";
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

