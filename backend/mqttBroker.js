/**
 * MQTT Broker sử dụng Aedes
 * Xử lý các kết nối MQTT từ ESP8266 và frontend
 */

import aedes from "aedes";
import { createServer } from "net";
import { config } from "./config.js";
import { LogModel } from "./models/Log.js";

let brokerInstance = null;
let mqttServer = null;
let logModel = null;

/**
 * Khởi tạo MQTT Broker
 * @param {Object} db - Database instance
 * @returns {Promise<Object>} Broker instance và server
 */
export function initMqttBroker(db) {
  return new Promise((resolve, reject) => {
    try {
      logModel = new LogModel(db);

      // Tạo Aedes broker instance
      brokerInstance = aedes();

      // Log khi client kết nối
      brokerInstance.on("client", (client) => {
        console.log(`🔌 Client kết nối: ${client.id}`);
      });

      // Log khi client ngắt kết nối
      brokerInstance.on("clientDisconnect", (client) => {
        console.log(`🔌 Client ngắt kết nối: ${client.id}`);
      });

      // Log khi client subscribe
      brokerInstance.on("subscribe", (subscriptions, client) => {
        console.log(
          `📥 Client ${client.id} subscribe:`,
          subscriptions.map((s) => s.topic).join(", ")
        );
      });

      // Log khi client unsubscribe
      brokerInstance.on("unsubscribe", (unsubscriptions, client) => {
        console.log(
          `📥 Client ${client.id} unsubscribe:`,
          unsubscriptions.join(", ")
        );
      });

      // Log khi có message được publish
      brokerInstance.on("publish", async (packet, client) => {
        if (client) {
          const message = packet.payload.toString();
          console.log(
            `📤 Client ${client.id} publish đến ${
              packet.topic
            }: ${message.substring(0, 50)}`
          );

          // Lưu log vào database
          try {
            await logModel.save({
              topic: packet.topic,
              message: message,
              direction: "publish",
            });
          } catch (error) {
            console.error("❌ Lỗi lưu log:", error);
          }
        }
      });

      // Xử lý lỗi
      brokerInstance.on("error", (error) => {
        console.error("❌ MQTT Broker error:", error);
      });

      // Tạo TCP server cho ESP8266
      mqttServer = createServer(brokerInstance.handle);

      // Lắng nghe trên tất cả network interfaces (0.0.0.0)
      // Điều này cho phép ESP8266 và các thiết bị khác kết nối từ mạng LAN
      mqttServer.listen(config.mqtt.port, "0.0.0.0", () => {
        console.log(
          `✅ MQTT Broker đang chạy trên 0.0.0.0:${config.mqtt.port}`
        );
        console.log(`📡 ESP8266 có thể kết nối từ mạng LAN`);
        resolve({
          broker: brokerInstance,
          server: mqttServer,
        });
      });

      mqttServer.on("error", (error) => {
        console.error("❌ MQTT Server error:", error);
        reject(error);
      });
    } catch (error) {
      console.error("❌ Lỗi khởi tạo MQTT Broker:", error);
      reject(error);
    }
  });
}

/**
 * Lấy broker instance
 */
export function getBroker() {
  return brokerInstance;
}

/**
 * Publish message qua broker
 * @param {string} topic - MQTT topic
 * @param {string} message - Message content
 * @param {Object} options - Publish options
 */
export function publish(topic, message, options = {}) {
  if (!brokerInstance) {
    console.error("❌ MQTT Broker chưa được khởi tạo");
    return;
  }

  const packet = {
    topic: topic,
    payload: Buffer.from(
      typeof message === "string" ? message : JSON.stringify(message)
    ),
    qos: options.qos || 0,
    retain: options.retain || false,
  };

  brokerInstance.publish(packet, () => {
    console.log(`📤 Đã publish đến ${topic}`);
  });
}

/**
 * Đóng MQTT Broker
 */
export function closeBroker() {
  return new Promise((resolve) => {
    if (mqttServer) {
      mqttServer.close(() => {
        console.log("✅ Đã đóng MQTT Broker");
        resolve();
      });
    } else {
      resolve();
    }
  });
}
