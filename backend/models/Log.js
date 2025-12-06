/**
 * Model Log - Quản lý log MQTT trong database
 */

import { query, run } from "../database.js";

export class LogModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * Lưu log vào database
   * @param {Object} data - Dữ liệu log
   * @param {string} data.topic - MQTT topic
   * @param {string} data.message - Nội dung message
   * @param {string} data.direction - Hướng (publish/subscribe)
   */
  async save(data) {
    const sql = `
      INSERT INTO logs (topic, message, direction)
      VALUES (?, ?, ?)
    `;

    const params = [data.topic, data.message, data.direction || "publish"];

    try {
      const result = await run(this.db, sql, params);
      return result;
    } catch (error) {
      console.error("❌ Lỗi lưu log:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử logs
   * @param {number} limit - Số lượng bản ghi tối đa
   * @param {number} offset - Vị trí bắt đầu
   * @param {string} topic - Lọc theo topic (optional)
   */
  async getHistory(limit = 100, offset = 0, topic = null) {
    let sql = `SELECT * FROM logs WHERE 1=1`;
    const params = [];

    if (topic) {
      sql += ` AND topic = ?`;
      params.push(topic);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    try {
      const rows = await query(this.db, sql, params);
      return rows;
    } catch (error) {
      console.error("❌ Lỗi lấy lịch sử logs:", error);
      throw error;
    }
  }

  /**
   * Đếm tổng số bản ghi
   */
  async count(topic = null) {
    let sql = `SELECT COUNT(*) as total FROM logs WHERE 1=1`;
    const params = [];

    if (topic) {
      sql += ` AND topic = ?`;
      params.push(topic);
    }

    try {
      const rows = await query(this.db, sql, params);
      return rows[0].total;
    } catch (error) {
      console.error("❌ Lỗi đếm bản ghi logs:", error);
      throw error;
    }
  }
}
