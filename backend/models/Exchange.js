/**
 * Model Exchange - Quản lý dữ liệu tỉ giá trong database
 */

import { query, run } from "../database.js";

export class ExchangeModel {
  constructor(db) {
    this.db = db;
  }

  /**
   * Lưu dữ liệu tỉ giá vào database
   * @param {Object} data - Dữ liệu tỉ giá
   * @param {string} data.base_currency - Tiền tệ cơ sở (VD: USD)
   * @param {string} data.target_currency - Tiền tệ đích (VD: VND)
   * @param {number} data.rate - Tỉ giá
   */
  async save(data) {
    const sql = `
      INSERT INTO exchange (base_currency, target_currency, rate)
      VALUES (?, ?, ?)
    `;

    const params = [data.base_currency, data.target_currency, data.rate];

    try {
      const result = await run(this.db, sql, params);
      console.log(`✅ Đã lưu dữ liệu tỉ giá (ID: ${result.lastID})`);
      return result;
    } catch (error) {
      console.error("❌ Lỗi lưu dữ liệu tỉ giá:", error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử tỉ giá
   * @param {number} limit - Số lượng bản ghi tối đa
   * @param {number} offset - Vị trí bắt đầu
   */
  async getHistory(limit = 100, offset = 0) {
    const sql = `
      SELECT * FROM exchange 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    try {
      const rows = await query(this.db, sql, [limit, offset]);
      return rows;
    } catch (error) {
      console.error("❌ Lỗi lấy lịch sử tỉ giá:", error);
      throw error;
    }
  }

  /**
   * Lấy dữ liệu tỉ giá mới nhất
   * @param {string} baseCurrency - Tiền tệ cơ sở (optional)
   * @param {string} targetCurrency - Tiền tệ đích (optional)
   */
  async getLatest(baseCurrency = null, targetCurrency = null) {
    // Đơn giản: chỉ lấy record mới nhất
    const sql = `SELECT * FROM exchange ORDER BY created_at DESC LIMIT 1`;

    try {
      const rows = await query(this.db, sql);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      console.error("❌ Lỗi lấy dữ liệu tỉ giá mới nhất:", error);
      throw error;
    }
  }

  /**
   * Đếm tổng số bản ghi
   */
  async count() {
    const sql = `SELECT COUNT(*) as total FROM exchange`;

    try {
      const rows = await query(this.db, sql);
      return rows[0].total;
    } catch (error) {
      console.error("❌ Lỗi đếm bản ghi tỉ giá:", error);
      throw error;
    }
  }
}
