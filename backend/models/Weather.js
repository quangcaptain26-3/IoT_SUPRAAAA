/**
 * Model Weather - Quản lý dữ liệu thời tiết trong database
 */

import { query, run } from "../database.js";

export class WeatherModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * Lưu dữ liệu thời tiết vào database
   * @param {Object} data - Dữ liệu thời tiết
   * @param {number} data.latitude - Vĩ độ
   * @param {number} data.longitude - Kinh độ
   * @param {number} data.temperature - Nhiệt độ
   * @param {number} data.humidity - Độ ẩm
   * @param {number} data.pressure - Áp suất
   * @param {string} data.description - Mô tả thời tiết
   * @param {number} data.wind_speed - Tốc độ gió
   */
  async save(data) {
    const sql = `
      INSERT INTO weather (
        latitude, longitude, temperature, humidity, 
        pressure, description, wind_speed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      data.latitude,
      data.longitude,
      data.temperature,
      data.humidity,
      data.pressure,
      data.description,
      data.wind_speed,
    ];

    try {
      const result = await run(this.db, sql, params);
      console.log(`✅ Đã lưu dữ liệu thời tiết (ID: ${result.lastID})`);
      return result;
    } catch (error) {
      console.error("❌ Lỗi lưu dữ liệu thời tiết:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử thời tiết
   * @param {number} limit - Số lượng bản ghi tối đa
   * @param {number} offset - Vị trí bắt đầu
   */
  async getHistory(limit = 100, offset = 0) {
    const sql = `
      SELECT * FROM weather 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    try {
      const rows = await query(this.db, sql, [limit, offset]);
      return rows;
    } catch (error) {
      console.error("❌ Lỗi lấy lịch sử thời tiết:", error);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu thời tiết mới nhất
   */
  async getLatest() {
    const sql = `
      SELECT * FROM weather 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    try {
      const rows = await query(this.db, sql);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("❌ Lỗi lấy dữ liệu thời tiết mới nhất:", error);
      throw error;
    }
  }

  /**
   * Đếm tổng số bản ghi
   */
  async count() {
    const sql = `SELECT COUNT(*) as total FROM weather`;

    try {
      const rows = await query(this.db, sql);
      return rows[0].total;
    } catch (error) {
      console.error("❌ Lỗi đếm bản ghi thời tiết:", error);
      throw error;
    }
  }
}
