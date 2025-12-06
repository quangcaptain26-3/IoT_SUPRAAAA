/**
 * File cấu hình cho backend
 * Chứa các thông tin API keys, MQTT settings, database path
 */

import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Server settings
  port: process.env.PORT || 3000,

  // MQTT Broker settings
  mqtt: {
    port: process.env.MQTT_PORT || 1883,
    host: process.env.MQTT_HOST || "localhost",
    // Topics
    topics: {
      weatherRaw: "home/weather/raw",
      weatherLed: "home/weather/led",
      exchangeRaw: "home/exchange/raw",
      exchangeLed: "home/exchange/led",
      customMessage: "home/custom/message",
      ledSettings: "home/led/settings",
    },
  },

  // API Configuration
  apis: {
    // Weather API - Open-Meteo (free, không cần API key)
    weatherApi:
      process.env.WEATHER_API || "https://api.open-meteo.com/v1/forecast",

    // ExchangeRate API
    // Nếu có API key, sẽ dùng exchangerate.host hoặc exchangerate-api.com với key
    exchangeApiKey: process.env.EXCHANGE_API_KEY || null,
    // URL mặc định (free, không cần key)
    exchangeApi:
      process.env.EXCHANGE_API ||
      "https://api.exchangerate-api.com/v4/latest/USD",
  },

  // Database
  database: {
    path: process.env.DB_PATH || "./database.sqlite",
  },

  // Cron settings (giây)
  cron: {
    weatherInterval: parseInt(process.env.WEATHER_INTERVAL) || 300, // 5 phút
    exchangeInterval: parseInt(process.env.EXCHANGE_INTERVAL) || 600, // 10 phút
  },

  // Default location (lat/lon)
  defaultLocation: {
    lat: parseFloat(process.env.DEFAULT_LAT) || 10.762622,
    lon: parseFloat(process.env.DEFAULT_LON) || 106.660172,
  },
};
