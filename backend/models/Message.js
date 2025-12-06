/**
 * Model Message - Quản lý lịch sử messages gửi qua LED
 */

import { query, run } from "../database.js";

export class MessageModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * Lưu message vào database
   * @param {Object} data - Dữ liệu message
   * @param {string} data.message - Nội dung message
   * @param {string} data.mode - Chế độ hiển thị (scroll_left, scroll_right, blink)
   */
  async save(data) {
    const sql = `
      INSERT INTO messages (message, mode)
      VALUES (?, ?)
    `;

    const params = [data.message, data.mode || null];

    try {
      const result = await run(this.db, sql, params);
      console.log(`✅ Đã lưu message (ID: ${result.lastID})`);
      return result;
    } catch (error) {
      console.error("❌ Lỗi lưu message:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử messages
   * @param {number} limit - Số lượng bản ghi tối đa
   * @param {number} offset - Vị trí bắt đầu
   */
  async getHistory(limit = 100, offset = 0) {
    const sql = `
      SELECT * FROM messages 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    try {
      const rows = await query(this.db, sql, [limit, offset]);
      return rows;
    } catch (error) {
      console.error("❌ Lỗi lấy lịch sử messages:", error);
      throw error;
    }
  }

  /**
   * Lấy message mới nhất
   */
  async getLatest() {
    const sql = `
      SELECT * FROM messages 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    try {
      const rows = await query(this.db, sql);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("❌ Lỗi lấy message mới nhất:", error);
      throw error;
    }
  }

  /**
   * Đếm tổng số bản ghi
   */
  async count() {
    const sql = `SELECT COUNT(*) as total FROM messages`;

    try {
      const rows = await query(this.db, sql);
      return rows[0].total;
    } catch (error) {
      console.error("❌ Lỗi đếm bản ghi messages:", error);
      throw error;
    }
  }
}
