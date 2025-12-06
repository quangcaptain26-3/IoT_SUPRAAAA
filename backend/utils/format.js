/**
 * Utility functions để format dữ liệu cho LED display
 */

/**
 * Format dữ liệu thời tiết cho LED
 * @param {Object} weather - Dữ liệu thời tiết
 * @returns {string} Text đã format
 */
export function formatWeatherForLED(weather) {
  if (!weather) return "No data";

  const temp = Math.round(weather.temperature || 0);
  const desc = (weather.description || "").substring(0, 10);
  const humidity = Math.round(weather.humidity || 0);

  return `Temp: ${temp}C ${desc} H:${humidity}%`;
}

/**
 * Format dữ liệu tỉ giá cho LED
 * @param {Object} exchange - Dữ liệu tỉ giá
 * @returns {string} Text đã format
 */
export function formatExchangeForLED(exchange) {
  if (!exchange) return "No data";

  const base = exchange.base_currency || "USD";
  const target = exchange.target_currency || "VND";
  const rate = (exchange.rate || 0).toFixed(2);

  return `${base}/${target}: ${rate}`;
}

/**
 * Truncate text để fit với LED matrix
 * @param {string} text - Text cần truncate
 * @param {number} maxLength - Độ dài tối đa
 * @returns {string} Text đã truncate
 */
export function truncateText(text, maxLength = 100) {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) : text;
}
