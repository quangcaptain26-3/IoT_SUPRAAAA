/**
 * Exchange Service - Lấy dữ liệu tỉ giá từ API
 */

import fetch from "node-fetch";
import { config } from "../config.js";
import { ExchangeModel } from "../models/Exchange.js";
import { formatExchangeForLED } from "../utils/format.js";

export class ExchangeService {
  constructor(db, mqttClient) {
    this.db = db;
    this.mqttClient = mqttClient;
    this.exchangeModel = new ExchangeModel(db);
    this.targetCurrencies = ["VND", "EUR", "GBP", "JPY", "CNY", "AUD"]; // Các đồng tiền cần theo dõi
  }

  /**
   * Lấy dữ liệu tỉ giá từ API
   */
  async fetchExchange() {
    try {
      // Xây dựng URL với API key nếu có
      let url = config.apis.exchangeApi;

      // Nếu có API key, sử dụng exchangerate.host hoặc exchangerate-api.com với key
      if (config.apis.exchangeApiKey) {
        // Có thể dùng exchangerate.host với key
        // url = `https://api.exchangerate.host/latest?access_key=${config.apis.exchangeApiKey}&base=USD`;
        // Hoặc exchangerate-api.com với key
        url = `https://v6.exchangerate-api.com/v6/${config.apis.exchangeApiKey}/latest/USD`;
        console.log(`💱 Đang lấy dữ liệu tỉ giá từ API (với API key)...`);
      } else {
        console.log(`💱 Đang lấy dữ liệu tỉ giá từ API (free)...`);
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Xử lý response khác nhau tùy API
      let rates, baseCurrency;

      if (config.apis.exchangeApiKey) {
        // exchangerate-api.com với key trả về: { result: "success", base_code: "USD", conversion_rates: {...} }
        if (data.conversion_rates) {
          rates = data.conversion_rates;
          baseCurrency = data.base_code || "USD";
        } else if (data.rates) {
          rates = data.rates;
          baseCurrency = data.base || "USD";
        } else {
          throw new Error("Không có dữ liệu tỉ giá từ API");
        }
      } else {
        // Free API trả về: { base: "USD", rates: {...} }
        if (!data.rates) {
          throw new Error("Không có dữ liệu tỉ giá");
        }
        rates = data.rates;
        baseCurrency = data.base || "USD";
      }
      const results = [];

      // Lưu tỉ giá cho các đồng tiền quan trọng
      for (const targetCurrency of this.targetCurrencies) {
        if (rates[targetCurrency]) {
          const rate = rates[targetCurrency];

          const exchangeData = {
            base_currency: baseCurrency,
            target_currency: targetCurrency,
            rate: rate,
          };

          // Lưu vào database
          await this.exchangeModel.save(exchangeData);
          results.push(exchangeData);

          // Publish raw data cho từng cặp tiền tệ
          if (this.mqttClient) {
            this.mqttClient.publish(
              config.mqtt.topics.exchangeRaw,
              JSON.stringify(exchangeData),
              { qos: 1 }
            );
          }
        }
      }

      // Publish tổng hợp cho LED (USD/VND là phổ biến nhất)
      const usdVnd = results.find((r) => r.target_currency === "VND");
      if (usdVnd && this.mqttClient) {
        const ledText = formatExchangeForLED(usdVnd);
        this.mqttClient.publish(config.mqtt.topics.exchangeLed, ledText, {
          qos: 1,
        });
        console.log(`📤 Đã publish exchange LED text: ${ledText}`);
      }

      console.log(`✅ Đã lấy và lưu ${results.length} tỉ giá`);
      return results;
    } catch (error) {
      console.error("❌ Lỗi lấy dữ liệu tỉ giá:", error.message);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu tỉ giá mới nhất từ database
   */
  async getLatest(baseCurrency = null, targetCurrency = null) {
    return await this.exchangeModel.getLatest(baseCurrency, targetCurrency);
  }

  /**
   * Lấy lịch sử tỉ giá
   */
  async getHistory(limit = 100, offset = 0) {
    return await this.exchangeModel.getHistory(limit, offset);
  }
}
