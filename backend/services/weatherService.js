/**
 * Weather Service - Lấy dữ liệu thời tiết từ API
 */

import fetch from "node-fetch";
import { config } from "../config.js";
import { WeatherModel } from "../models/Weather.js";
import { formatWeatherForLED } from "../utils/format.js";

export class WeatherService {
  constructor(db, mqttClient) {
    this.db = db;
    this.mqttClient = mqttClient;
    this.weatherModel = new WeatherModel(db);
    this.currentLocation = {
      lat: config.defaultLocation.lat,
      lon: config.defaultLocation.lon,
    };
  }

  /**
   * Cập nhật vị trí (lat/lon)
   */
  setLocation(lat, lon) {
    this.currentLocation = { lat, lon };
    console.log(`📍 Đã cập nhật vị trí: ${lat}, ${lon}`);
  }

  /**
   * Lấy dữ liệu thời tiết từ API
   */
  async fetchWeather() {
    try {
      const { lat, lon } = this.currentLocation;

      // Sử dụng Open-Meteo API (free, không cần key)
      const url = `${config.apis.weatherApi}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,pressure_msl,weather_code,wind_speed_10m&timezone=auto`;

      console.log(`🌤️  Đang lấy dữ liệu thời tiết từ API...`);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.current) {
        throw new Error("Không có dữ liệu thời tiết");
      }

      // Map weather code to description
      const weatherDescriptions = {
        0: "Clear",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing Rime Fog",
        51: "Light Drizzle",
        53: "Moderate Drizzle",
        55: "Dense Drizzle",
        56: "Light Freezing Drizzle",
        57: "Dense Freezing Drizzle",
        61: "Slight Rain",
        63: "Moderate Rain",
        65: "Heavy Rain",
        66: "Light Freezing Rain",
        67: "Heavy Freezing Rain",
        71: "Slight Snow",
        73: "Moderate Snow",
        75: "Heavy Snow",
        77: "Snow Grains",
        80: "Slight Rain Showers",
        81: "Moderate Rain Showers",
        82: "Violent Rain Showers",
        85: "Slight Snow Showers",
        86: "Heavy Snow Showers",
        95: "Thunderstorm",
        96: "Thunderstorm with Hail",
        99: "Thunderstorm with Heavy Hail",
      };

      const weatherCode = data.current.weather_code || 0;
      const description = weatherDescriptions[weatherCode] || "Unknown";

      const weatherData = {
        latitude: lat,
        longitude: lon,
        temperature: data.current.temperature_2m || 0,
        humidity: data.current.relative_humidity_2m || 0,
        pressure: data.current.pressure_msl || 0,
        description: description,
        wind_speed: data.current.wind_speed_10m || 0,
      };

      // Lưu vào database
      await this.weatherModel.save(weatherData);

      // Publish raw data
      if (this.mqttClient) {
        this.mqttClient.publish(
          config.mqtt.topics.weatherRaw,
          JSON.stringify(weatherData),
          { qos: 1 }
        );
        console.log(
          `📤 Đã publish raw weather data đến ${config.mqtt.topics.weatherRaw}`
        );
      }

      // Format và publish cho LED
      const ledText = formatWeatherForLED(weatherData);
      if (this.mqttClient) {
        this.mqttClient.publish(config.mqtt.topics.weatherLed, ledText, {
          qos: 1,
        });
        console.log(`📤 Đã publish weather LED text: ${ledText}`);
      }

      return weatherData;
    } catch (error) {
      console.error("❌ Lỗi lấy dữ liệu thời tiết:", error.message);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu thời tiết mới nhất từ database
   */
  async getLatest() {
    return await this.weatherModel.getLatest();
  }

  /**
   * Lấy lịch sử thời tiết
   */
  async getHistory(limit = 100, offset = 0) {
    return await this.weatherModel.getHistory(limit, offset);
  }
}
