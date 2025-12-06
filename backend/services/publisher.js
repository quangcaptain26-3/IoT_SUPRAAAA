/**
 * Publisher Service - Quản lý việc publish MQTT messages
 */

import { config } from "../config.js";
import { MessageModel } from "../models/Message.js";
import { LogModel } from "../models/Log.js";

export class PublisherService {
  constructor(db, mqttClient) {
    this.db = db;
    this.mqttClient = mqttClient;
    this.messageModel = new MessageModel(db);
    this.logModel = new LogModel(db);
  }

  /**
   * Publish custom message đến LED
   * @param {string} message - Nội dung message
   * @param {string} mode - Chế độ hiển thị (scroll_left, scroll_right, blink)
   */
  async publishCustomMessage(message, mode = null) {
    try {
      if (!this.mqttClient) {
        throw new Error("MQTT client chưa được khởi tạo");
      }

      // Lưu message vào database
      await this.messageModel.save({ message, mode });

      // Publish message
      this.mqttClient.publish(config.mqtt.topics.customMessage, message, {
        qos: 1,
      });

      // Log
      await this.logModel.save({
        topic: config.mqtt.topics.customMessage,
        message: message,
        direction: "publish",
      });

      console.log(`📤 Đã publish custom message: ${message}`);
      return { success: true, message };
    } catch (error) {
      console.error("❌ Lỗi publish custom message:", error);
      throw error;
    }
  }

  /**
   * Publish LED settings
   * @param {Object} settings - Cài đặt LED
   * @param {string} settings.mode - Chế độ (scroll_left, scroll_right, blink)
   * @param {number} settings.speed - Tốc độ (1-10)
   * @param {number} settings.brightness - Độ sáng (1-15)
   */
  async publishLedSettings(settings) {
    try {
      if (!this.mqttClient) {
        throw new Error("MQTT client chưa được khởi tạo");
      }

      const settingsJson = JSON.stringify(settings);

      // Publish settings
      this.mqttClient.publish(config.mqtt.topics.ledSettings, settingsJson, {
        qos: 1,
      });

      // Log
      await this.logModel.save({
        topic: config.mqtt.topics.ledSettings,
        message: settingsJson,
        direction: "publish",
      });

      console.log(`📤 Đã publish LED settings:`, settings);
      return { success: true, settings };
    } catch (error) {
      console.error("❌ Lỗi publish LED settings:", error);
      throw error;
    }
  }

  /**
   * Publish message và log
   * @param {string} topic - MQTT topic
   * @param {string} message - Message content
   * @param {string} direction - publish hoặc subscribe
   */
  async publishAndLog(topic, message, direction = "publish") {
    try {
      if (this.mqttClient && direction === "publish") {
        this.mqttClient.publish(topic, message, { qos: 1 });
      }

      await this.logModel.save({
        topic,
        message:
          typeof message === "string" ? message : JSON.stringify(message),
        direction,
      });
    } catch (error) {
      console.error("❌ Lỗi publish và log:", error);
    }
  }
}
