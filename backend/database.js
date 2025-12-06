/**
 * Database initializer cho SQLite3
 * Tạo các bảng: weather, exchange, messages, logs
 */

import sqlite3 from "sqlite3";
import { config } from "./config.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = config.database.path.startsWith("./")
  ? join(__dirname, "..", config.database.path)
  : config.database.path;

/**
 * Tạo và mở kết nối database
 */
export function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("❌ Lỗi kết nối database:", err.message);
        reject(err);
        return;
      }
      console.log("✅ Đã kết nối SQLite database:", dbPath);
      createTables(db)
        .then(() => resolve(db))
        .catch(reject);
    });
  });
}

/**
 * Tạo các bảng trong database
 */
function createTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Bảng lưu lịch sử thời tiết
      db.run(
        `
        CREATE TABLE IF NOT EXISTS weather (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          temperature REAL,
          humidity REAL,
          pressure REAL,
          description TEXT,
          wind_speed REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Lỗi tạo bảng weather:", err);
            reject(err);
          } else {
            console.log("✅ Đã tạo bảng weather");
          }
        }
      );

      // Bảng lưu lịch sử tỉ giá
      db.run(
        `
        CREATE TABLE IF NOT EXISTS exchange (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          base_currency TEXT NOT NULL,
          target_currency TEXT NOT NULL,
          rate REAL NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Lỗi tạo bảng exchange:", err);
            reject(err);
          } else {
            console.log("✅ Đã tạo bảng exchange");
          }
        }
      );

      // Bảng lưu lịch sử messages gửi qua LED
      db.run(
        `
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message TEXT NOT NULL,
          mode TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Lỗi tạo bảng messages:", err);
            reject(err);
          } else {
            console.log("✅ Đã tạo bảng messages");
          }
        }
      );

      // Bảng lưu log MQTT
      db.run(
        `
        CREATE TABLE IF NOT EXISTS logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic TEXT NOT NULL,
          message TEXT,
          direction TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            console.error("❌ Lỗi tạo bảng logs:", err);
            reject(err);
          } else {
            console.log("✅ Đã tạo bảng logs");
            resolve();
          }
        }
      );
    });
  });
}

/**
 * Helper function để query database
 */
export function query(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * Helper function để run database (INSERT, UPDATE, DELETE)
 */
export function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}
