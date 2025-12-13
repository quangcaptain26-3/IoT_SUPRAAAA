/**
 * Main application JavaScript
 * Kết nối MQTT, gọi API, điều khiển LED
 */

console.log("🔵 Script app.js đã được load!");

// API Base URL - Backend server
const API_BASE = "https://qiotbe.dev1.vimaru.edu.vn";
const MQTT_BROKER = "wss://z0d3bf33.ala.asia-southeast1.emqxsl.com:8084/mqtt";
const MQTT_OPTIONS = {
  clientId: `qiot-fe_${Math.random().toString(16).substr(2, 8)}`,
  username: "qiot-fe",
  password: "qbe123",
  clean: true,
  reconnectPeriod: 5000,
};
let mqttClient = null;

// ==================== MQTT Connection ====================

/**
 * Kết nối MQTT
 */
function connectMQTT() {
  try {
    // Kiểm tra mqtt library đã load chưa (từ CDN, sẽ có trong window.mqtt)
    const mqttLib =
      typeof window !== "undefined" && window.mqtt ? window.mqtt : null;

    if (!mqttLib) {
      console.warn("⚠️ MQTT library chưa load. Retry sau 200ms...");
      updateMQTTStatus("disconnected");
      // Retry nhanh hơn (200ms thay vì 1000ms)
      setTimeout(connectMQTT, 200);
      return;
    }

    console.log("🔌 Đang kết nối EMQX Cloud:", MQTT_BROKER);
    mqttClient = mqttLib.connect(MQTT_BROKER, MQTT_OPTIONS);

    mqttClient.on("connect", () => {
      console.log("✅ Đã kết nối EMQX Cloud!");
      updateMQTTStatus("connected");
    });

    mqttClient.on("error", (error) => {
      console.error("❌ MQTT error:", error);
      updateMQTTStatus("disconnected");
    });

    mqttClient.on("close", () => {
      console.log("🔌 MQTT đã đóng");
      updateMQTTStatus("disconnected");
    });

    mqttClient.on("reconnect", () => {
      console.log("🔄 Đang kết nối lại MQTT...");
      updateMQTTStatus("connecting");
    });
  } catch (error) {
    console.error("❌ Lỗi kết nối MQTT:", error);
    updateMQTTStatus("disconnected");
  }
}

/**
 * Cập nhật trạng thái MQTT
 */
function updateMQTTStatus(status) {
  const statusEl = document.getElementById("mqttStatus");
  statusEl.textContent =
    status === "connected"
      ? "Connected"
      : status === "connecting"
      ? "Connecting..."
      : "Disconnected";
  statusEl.className = `status-value ${
    status === "connected" ? "connected" : "disconnected"
  }`;
}

// ==================== API Calls ====================

/**
 * Gọi API
 */
async function apiCall(endpoint, options = {}) {
  try {
    const url = `${API_BASE}${endpoint}`;
    console.log(`📡 Gọi API: ${url}`);
    console.log(`   Method: ${options.method || "GET"}`);
    console.log(`   Body:`, options.body);

    const fetchOptions = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    console.log(`   Fetch options:`, fetchOptions);

    const response = await fetch(url, fetchOptions);

    console.log(
      `📥 Response status: ${response.status} ${response.statusText}`
    );
    console.log(
      `   Response headers:`,
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ API Response data:`, data);
    return data;
  } catch (error) {
    console.error(`❌ Lỗi API ${endpoint}:`, error);
    console.error(`   Error type:`, error.constructor.name);
    console.error(`   Error message:`, error.message);
    if (
      error.message.includes("Failed to fetch") ||
      error.message.includes("CORS") ||
      error.name === "TypeError"
    ) {
      console.error("⚠️ CORS Error hoặc Network Error - Kiểm tra:");
      console.error("   1. Backend có đang chạy không?");
      console.error("   2. CORS settings trên backend");
      console.error("   3. Network connection");
    }
    throw error;
  }
}

/**
 * Kiểm tra server status
 */
async function checkServerStatus() {
  try {
    const data = await apiCall("/api/health");
    console.log("🏥 Health check response:", data);

    const isOnline = data.status === "ok";
    const mqttConnected = data.mqtt === "connected";

    document.getElementById("serverStatus").textContent = isOnline
      ? "Online"
      : "Offline";
    document.getElementById("serverStatus").className = isOnline
      ? "status-value connected"
      : "status-value disconnected";

    // Cập nhật MQTT status
    updateMQTTStatus(mqttConnected ? "connected" : "disconnected");

    if (!mqttConnected) {
      console.warn("⚠️ MQTT không kết nối! Status:", data.mqtt);
      console.warn("   MQTT Client exists:", data.mqttClientExists);
      console.warn("   MQTT Client connected:", data.mqttClientConnected);
    }

    return isOnline;
  } catch (error) {
    console.error("❌ Health check failed:", error);
    document.getElementById("serverStatus").textContent = "Offline";
    document.getElementById("serverStatus").className =
      "status-value disconnected";
    return false;
  }
}

/**
 * Lấy dữ liệu thời tiết hiện tại
 */
async function loadCurrentWeather() {
  try {
    const result = await apiCall("/api/weather/current");
    const data = result.data;

    if (data) {
      document.getElementById("weatherDisplay").innerHTML = `
                <div class="data-item">
                    <strong>Nhiệt độ:</strong> ${data.temperature}°C
                </div>
                <div class="data-item">
                    <strong>Độ ẩm:</strong> ${data.humidity}%
                </div>
                <div class="data-item">
                    <strong>Áp suất:</strong> ${data.pressure} hPa
                </div>
                <div class="data-item">
                    <strong>Mô tả:</strong> ${data.description}
                </div>
                <div class="data-item">
                    <strong>Gió:</strong> ${data.wind_speed} km/h
                </div>
            `;
    } else {
      document.getElementById("weatherDisplay").innerHTML =
        '<p class="loading">Chưa có dữ liệu. Vui lòng cập nhật vị trí.</p>';
    }
  } catch (error) {
    document.getElementById("weatherDisplay").innerHTML =
      '<p class="loading" style="color: red;">Lỗi tải dữ liệu</p>';
  }
}

/**
 * Lấy dữ liệu tỉ giá hiện tại
 */
async function loadCurrentExchange() {
  try {
    const currencyPair = document.getElementById("currencyPair").value;
    const [base, target] = currencyPair.split("/");

    const result = await apiCall(
      `/api/exchange/current?base=${base}&target=${target}`
    );
    const data = result.data;

    if (data) {
      document.getElementById("exchangeDisplay").innerHTML = `
                <div class="data-item">
                    <strong>Cặp tiền:</strong> ${data.base_currency}/${
        data.target_currency
      }
                </div>
                <div class="data-item">
                    <strong>Tỉ giá:</strong> ${data.rate.toFixed(2)}
                </div>
                <div class="data-item">
                    <strong>Thời gian:</strong> ${new Date(
                      data.created_at
                    ).toLocaleString("vi-VN")}
                </div>
            `;
    } else {
      document.getElementById("exchangeDisplay").innerHTML =
        '<p class="loading">Chưa có dữ liệu</p>';
    }
  } catch (error) {
    document.getElementById("exchangeDisplay").innerHTML =
      '<p class="loading" style="color: red;">Lỗi tải dữ liệu</p>';
  }
}

// ==================== Event Handlers ====================

/**
 * Cập nhật vị trí thời tiết
 */
async function handleUpdateLocation() {
  const lat = document.getElementById("latitude").value;
  const lon = document.getElementById("longitude").value;

  if (!lat || !lon) {
    alert("Vui lòng nhập đầy đủ lat và lon");
    return;
  }

  const btn = document.getElementById("updateLocationBtn");
  btn.disabled = true;
  btn.textContent = "Đang cập nhật...";

  try {
    await apiCall("/api/weather/location", {
      method: "POST",
      body: JSON.stringify({ lat, lon }),
    });

    alert("✅ Đã cập nhật vị trí!");
    await loadCurrentWeather();
  } catch (error) {
    alert("❌ Lỗi cập nhật vị trí: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Cập nhật vị trí";
  }
}

/**
 * Hiển thị tỷ giá lên LED
 */
async function handleDisplayExchange() {
  const currencyPair = document.getElementById("currencyPair").value;
  const [base, target] = currencyPair.split("/");

  const btn = document.getElementById("displayExchangeBtn");
  btn.disabled = true;
  btn.textContent = "Đang gửi...";

  try {
    await apiCall("/api/exchange/display", {
      method: "POST",
      body: JSON.stringify({ base, target }),
    });

    alert(`✅ Đã gửi tỷ giá ${currencyPair} lên LED!`);
  } catch (error) {
    alert("❌ Lỗi hiển thị tỷ giá: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Hiển thị lên LED";
  }
}

/**
 * Gửi custom message
 */
async function handleSendMessage() {
  const message = document.getElementById("customMessage").value.trim();
  const mode = document.getElementById("messageMode").value;

  console.log("🔵 handleSendMessage được gọi");
  console.log("   Message:", message);
  console.log("   Mode:", mode);

  if (!message) {
    alert("Vui lòng nhập message");
    return;
  }

  const btn = document.getElementById("sendMessageBtn");
  btn.disabled = true;
  btn.textContent = "Đang gửi...";

  try {
    console.log("📤 Đang gọi API /api/message/send...");
    const result = await apiCall("/api/message/send", {
      method: "POST",
      body: JSON.stringify({ message, mode }),
    });

    console.log("✅ API response:", result);
    alert("✅ Đã gửi message!");
    document.getElementById("customMessage").value = "";
  } catch (error) {
    console.error("❌ Lỗi trong handleSendMessage:", error);
    console.error("   Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    alert("❌ Lỗi gửi message: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Gửi Message";
  }
}

/**
 * Áp dụng tốc độ
 */
async function handleApplySpeed() {
  const speed = document.getElementById("ledSpeed").value;

  const btn = document.getElementById("applySpeedBtn");
  btn.disabled = true;
  btn.textContent = "Đang áp dụng...";

  try {
    await apiCall("/api/led/settings", {
      method: "POST",
      body: JSON.stringify({ speed: parseInt(speed) }),
    });

    alert(`✅ Đã áp dụng tốc độ: ${speed}`);
  } catch (error) {
    alert("❌ Lỗi áp dụng tốc độ: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Áp dụng tốc độ";
  }
}

/**
 * Áp dụng độ sáng
 */
async function handleApplyBrightness() {
  const brightness = document.getElementById("ledBrightness").value;

  const btn = document.getElementById("applyBrightnessBtn");
  btn.disabled = true;
  btn.textContent = "Đang áp dụng...";

  try {
    await apiCall("/api/led/settings", {
      method: "POST",
      body: JSON.stringify({ brightness: parseInt(brightness) }),
    });

    alert(`✅ Đã áp dụng độ sáng: ${brightness}`);
  } catch (error) {
    alert("❌ Lỗi áp dụng độ sáng: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Áp dụng độ sáng";
  }
}

/**
 * Áp dụng chế độ hiển thị
 */
async function handleApplyMode() {
  const mode = document.getElementById("ledMode").value;

  if (!mode) {
    alert("Vui lòng chọn chế độ");
    return;
  }

  const btn = document.getElementById("applyModeBtn");
  btn.disabled = true;
  btn.textContent = "Đang áp dụng...";

  try {
    await apiCall("/api/led/settings", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });

    alert(`✅ Đã áp dụng chế độ: ${mode}`);
  } catch (error) {
    alert("❌ Lỗi áp dụng chế độ: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✓ Áp dụng chế độ";
  }
}

// ==================== AUTO MODE ====================

let autoInterval = null;
let autoStep = 0;

const AUTO_CURRENCIES = [
  "USD/VND",
  "EUR/VND",
  "GBP/VND",
  "JPY/VND",
  "CNY/VND",
  "AUD/VND",
];
const AUTO_DELAY = 5000; // 5 giây mỗi bước

/**
 * Bắt đầu chế độ AUTO
 */
async function startAutoMode() {
  if (autoInterval) {
    alert("Chế độ AUTO đang chạy!");
    return;
  }

  // Đặt tốc độ vừa phải
  await apiCall("/api/led/settings", {
    method: "POST",
    body: JSON.stringify({ speed: 50 }),
  });

  autoStep = 0;
  updateAutoStatus("Đang chạy - Bước 1: Thời gian", "connected");

  document.getElementById("autoDisplayBtn").disabled = true;
  document.getElementById("stopAutoBtn").disabled = false;

  // Chạy ngay lập tức
  await runAutoStep();

  // Sau đó chạy theo interval
  autoInterval = setInterval(runAutoStep, AUTO_DELAY);
}

/**
 * Dừng chế độ AUTO
 */
function stopAutoMode() {
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
  }

  autoStep = 0;
  updateAutoStatus("Đã dừng", "disconnected");

  document.getElementById("autoDisplayBtn").disabled = false;
  document.getElementById("stopAutoBtn").disabled = true;
}

/**
 * Chạy một bước AUTO
 */
async function runAutoStep() {
  try {
    if (autoStep === 0) {
      // Bước 1: Hiển thị thời gian
      updateAutoStatus("Đang chạy - Bước 1: Thời gian", "connected");
      await apiCall("/api/auto/time", { method: "POST" });
    } else if (autoStep === 1) {
      // Bước 2: Hiển thị thời tiết
      updateAutoStatus("Đang chạy - Bước 2: Thời tiết", "connected");
      await apiCall("/api/auto/weather", { method: "POST" });
    } else {
      // Bước 3+: Hiển thị tỷ giá
      const currencyIndex = autoStep - 2;
      if (currencyIndex < AUTO_CURRENCIES.length) {
        const currencyPair = AUTO_CURRENCIES[currencyIndex];
        const [base, target] = currencyPair.split("/");
        updateAutoStatus(`Đang chạy - Tỷ giá: ${currencyPair}`, "connected");
        await apiCall("/api/exchange/display", {
          method: "POST",
          body: JSON.stringify({ base, target }),
        });
      } else {
        // Quay lại bước đầu
        autoStep = -1;
      }
    }

    autoStep++;
  } catch (error) {
    console.error("❌ Lỗi AUTO mode:", error);
    updateAutoStatus("Lỗi: " + error.message, "disconnected");
  }
}

/**
 * Cập nhật trạng thái AUTO
 */
function updateAutoStatus(text, status) {
  const statusEl = document.getElementById("autoStatusText");
  statusEl.textContent = text;
  statusEl.className = `status-value ${status}`;
}

// ==================== Initialization ====================

/**
 * Khởi tạo ứng dụng
 */
function init() {
  // Kiểm tra server status
  checkServerStatus();
  setInterval(checkServerStatus, 30000); // Check mỗi 30 giây

  // Đợi mqtt library load xong rồi mới kết nối MQTT
  function waitForMqtt() {
    if (typeof window !== "undefined" && window.mqtt) {
      console.log("✅ MQTT library đã sẵn sàng");
      connectMQTT();
    } else {
      // Retry nhanh (100ms) khi script CDN chưa load xong
      setTimeout(waitForMqtt, 100);
    }
  }
  waitForMqtt();

  // Load dữ liệu ban đầu
  loadCurrentWeather();
  loadCurrentExchange();

  // Event listeners - Weather
  document
    .getElementById("updateLocationBtn")
    .addEventListener("click", handleUpdateLocation);

  // Event listeners - Exchange
  document
    .getElementById("currencyPair")
    .addEventListener("change", loadCurrentExchange);
  document
    .getElementById("refreshExchangeBtn")
    .addEventListener("click", loadCurrentExchange);
  document
    .getElementById("displayExchangeBtn")
    .addEventListener("click", handleDisplayExchange);

  // Event listeners - Auto Mode
  document
    .getElementById("autoDisplayBtn")
    .addEventListener("click", startAutoMode);
  document
    .getElementById("stopAutoBtn")
    .addEventListener("click", stopAutoMode);

  // Event listeners - Custom Message
  document
    .getElementById("sendMessageBtn")
    .addEventListener("click", handleSendMessage);

  // Event listeners - LED Settings
  document
    .getElementById("applySpeedBtn")
    .addEventListener("click", handleApplySpeed);
  document
    .getElementById("applyBrightnessBtn")
    .addEventListener("click", handleApplyBrightness);
  document
    .getElementById("applyModeBtn")
    .addEventListener("click", handleApplyMode);

  // Range sliders - cập nhật hiển thị giá trị
  document.getElementById("ledSpeed").addEventListener("input", (e) => {
    document.getElementById("speedValue").textContent = e.target.value;
  });

  document.getElementById("ledBrightness").addEventListener("input", (e) => {
    document.getElementById("brightnessValue").textContent = e.target.value;
  });

  // Event listeners - Query Buttons
  document
    .getElementById("queryTempBtn")
    .addEventListener("click", handleQueryTemperature);
  document
    .getElementById("queryExchangeBtn")
    .addEventListener("click", handleQueryExchange);
  document
    .getElementById("queryStatsBtn")
    .addEventListener("click", handleQueryStats);
  document
    .getElementById("queryRecentBtn")
    .addEventListener("click", handleQueryRecent);

  console.log("✅ Ứng dụng đã khởi tạo");
}

// ==================== QUERY HANDLERS ====================

/**
 * Truy vấn nhiệt độ theo phút - sử dụng history API
 */
async function handleQueryTemperature() {
  const minutes = parseInt(document.getElementById("tempMinutes").value) || 90;
  const resultsDiv = document.getElementById("queryResults");

  // Show loading
  resultsDiv.className = "query-results loading";
  resultsDiv.innerHTML = "";

  try {
    // Sử dụng history API thay vì query API
    const result = await apiCall("/api/weather/history?limit=100");

    if (!result.success || !result.data || result.data.length === 0) {
      resultsDiv.className = "query-results";
      resultsDiv.innerHTML = '<p class="placeholder-text">Không có dữ liệu</p>';
      return;
    }

    // Lọc dữ liệu theo số phút
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
    let data = result.data.filter(
      (item) => new Date(item.created_at) >= cutoffTime
    );

    if (data.length === 0) {
      resultsDiv.className = "query-results";
      resultsDiv.innerHTML =
        '<p class="placeholder-text">Không có dữ liệu trong khoảng thời gian này</p>';
      return;
    }

    // Tính toán stats từ dữ liệu
    const stats = {
      count: data.length,
      avgTemp:
        data.length > 0
          ? (
              data.reduce((sum, item) => sum + item.temperature, 0) /
              data.length
            ).toFixed(1)
          : 0,
      maxTemp:
        data.length > 0
          ? Math.max(...data.map((item) => item.temperature)).toFixed(1)
          : 0,
      minTemp:
        data.length > 0
          ? Math.min(...data.map((item) => item.temperature)).toFixed(1)
          : 0,
      avgHumidity:
        data.length > 0
          ? (
              data.reduce((sum, item) => sum + item.humidity, 0) / data.length
            ).toFixed(1)
          : 0,
    };

    // Format data với time_label
    data = data.map((item) => ({
      ...item,
      time_label: new Date(item.created_at).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    // Build HTML
    let html = `
      <div class="result-header">
        <h3>🌡️ Nhiệt độ ${minutes} phút gần nhất</h3>
        <div class="result-meta">${data.length} bản ghi</div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Trung bình</div>
          <div class="stat-value">${stats.avgTemp}</div>
          <div class="stat-unit">°C</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cao nhất</div>
          <div class="stat-value">${stats.maxTemp}</div>
          <div class="stat-unit">°C</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Thấp nhất</div>
          <div class="stat-value">${stats.minTemp}</div>
          <div class="stat-unit">°C</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Độ ẩm TB</div>
          <div class="stat-value">${stats.avgHumidity}</div>
          <div class="stat-unit">%</div>
        </div>
      </div>
      
      <div class="chart-container">
        <h4 style="color: var(--text-dark); margin-bottom: 16px;">📊 Biểu đồ nhiệt độ</h4>
    `;

    // Tạo chart bars (lấy tối đa 10 records gần nhất)
    const chartData = data.slice(0, 10);
    const maxTemp = Math.max(...chartData.map((d) => d.temperature));

    chartData.forEach((item) => {
      const percentage = (item.temperature / maxTemp) * 100;
      html += `
        <div class="chart-bar">
          <div class="chart-label">${item.time_label}</div>
          <div class="chart-bar-fill" style="width: ${percentage}%"></div>
          <div class="chart-value">${item.temperature}°C</div>
        </div>
      `;
    });

    html += "</div>";

    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = html;
  } catch (error) {
    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = `<p class="placeholder-text" style="color: var(--danger-color);">❌ Lỗi: ${error.message}</p>`;
  }
}

/**
 * Truy vấn tỷ giá trung bình - sử dụng history API
 */
async function handleQueryExchange() {
  const minutes =
    parseInt(document.getElementById("exchangeMinutes").value) || 180;
  const currencyPair = document.getElementById("exchangePair").value;
  const [base, target] = currencyPair.split("/");
  const resultsDiv = document.getElementById("queryResults");

  // Show loading
  resultsDiv.className = "query-results loading";
  resultsDiv.innerHTML = "";

  try {
    // Sử dụng history API thay vì query API
    const result = await apiCall("/api/exchange/history?limit=100");

    if (!result.success || !result.data || result.data.length === 0) {
      resultsDiv.className = "query-results";
      resultsDiv.innerHTML = '<p class="placeholder-text">Không có dữ liệu</p>';
      return;
    }

    // Lọc theo currency pair và số phút
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - minutes * 60 * 1000);
    let data = result.data.filter(
      (item) =>
        item.base_currency === base &&
        item.target_currency === target &&
        new Date(item.created_at) >= cutoffTime
    );

    if (data.length === 0) {
      resultsDiv.className = "query-results";
      resultsDiv.innerHTML =
        '<p class="placeholder-text">Không có dữ liệu trong khoảng thời gian này</p>';
      return;
    }

    // Tính toán stats từ dữ liệu
    const stats = {
      count: data.length,
      avgRate:
        data.length > 0
          ? (
              data.reduce((sum, item) => sum + item.rate, 0) / data.length
            ).toFixed(2)
          : 0,
      maxRate:
        data.length > 0
          ? Math.max(...data.map((item) => item.rate)).toFixed(2)
          : 0,
      minRate:
        data.length > 0
          ? Math.min(...data.map((item) => item.rate)).toFixed(2)
          : 0,
      currentRate: data.length > 0 ? data[0].rate.toFixed(2) : 0,
    };

    // Format data với time_label
    data = data.map((item) => ({
      ...item,
      time_label: new Date(item.created_at).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    // Build HTML
    let html = `
      <div class="result-header">
        <h3>💱 Tỷ giá ${base}/${target} - ${minutes} phút gần nhất</h3>
        <div class="result-meta">${data.length} bản ghi</div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Hiện tại</div>
          <div class="stat-value">${stats.currentRate}</div>
          <div class="stat-unit">VND</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Trung bình</div>
          <div class="stat-value">${stats.avgRate}</div>
          <div class="stat-unit">VND</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cao nhất</div>
          <div class="stat-value">${stats.maxRate}</div>
          <div class="stat-unit">VND</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Thấp nhất</div>
          <div class="stat-value">${stats.minRate}</div>
          <div class="stat-unit">VND</div>
        </div>
      </div>
      
      <div class="chart-container">
        <h4 style="color: var(--text-dark); margin-bottom: 16px;">📊 Biểu đồ tỷ giá</h4>
    `;

    // Tạo chart bars (lấy tối đa 10 records gần nhất)
    const chartData = data.slice(0, 10);
    const maxRate = Math.max(...chartData.map((d) => d.rate));

    chartData.forEach((item) => {
      const percentage = (item.rate / maxRate) * 100;
      html += `
        <div class="chart-bar">
          <div class="chart-label">${item.time_label}</div>
          <div class="chart-bar-fill" style="width: ${percentage}%"></div>
          <div class="chart-value">${item.rate.toFixed(2)}</div>
        </div>
      `;
    });

    html += "</div>";

    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = html;
  } catch (error) {
    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = `<p class="placeholder-text" style="color: var(--danger-color);">❌ Lỗi: ${error.message}</p>`;
  }
}

/**
 * Truy vấn thống kê tổng quan - tính từ history
 */
async function handleQueryStats() {
  const resultsDiv = document.getElementById("queryResults");

  // Show loading
  resultsDiv.className = "query-results loading";
  resultsDiv.innerHTML = "";

  try {
    // Lấy tất cả history và tính toán stats
    const [weatherResult, exchangeResult, messageResult, logsResult] =
      await Promise.all([
        apiCall("/api/weather/history?limit=1000").catch(() => ({
          success: true,
          data: [],
        })),
        apiCall("/api/exchange/history?limit=1000").catch(() => ({
          success: true,
          data: [],
        })),
        apiCall("/api/message/history?limit=1000").catch(() => ({
          success: true,
          data: [],
        })),
        apiCall("/api/logs?limit=1000").catch(() => ({
          success: true,
          data: [],
        })),
      ]);

    const weatherData = weatherResult.data || [];
    const exchangeData = exchangeResult.data || [];
    const messageData = messageResult.data || [];
    const logsData = logsResult.data || [];

    // Tính 24h qua
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weatherLast24h = weatherData.filter(
      (item) => new Date(item.created_at) >= last24h
    );
    const exchangeLast24h = exchangeData.filter(
      (item) => new Date(item.created_at) >= last24h
    );

    // Latest data
    const latestWeather = weatherData[0] || null;
    const latestExchange = exchangeData[0] || null;

    const stats = {
      total: {
        weather: weatherData.length,
        exchange: exchangeData.length,
        messages: messageData.length,
        logs: logsData.length,
      },
      last24h: {
        weather: weatherLast24h.length,
        exchange: exchangeLast24h.length,
      },
      latest: {
        weather: latestWeather,
        exchange: latestExchange,
      },
    };

    // Build HTML
    let html = `
      <div class="result-header">
        <h3>📈 Thống Kê Tổng Quan</h3>
        <div class="result-meta">Cập nhật: ${new Date().toLocaleString(
          "vi-VN"
        )}</div>
      </div>
      
      <h4 style="color: var(--primary-color); margin: 20px 0 12px 0; font-size: 1.1em;">📊 Tổng số bản ghi</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Thời tiết</div>
          <div class="stat-value">${stats.total.weather}</div>
          <div class="stat-unit">records</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tỷ giá</div>
          <div class="stat-value">${stats.total.exchange}</div>
          <div class="stat-unit">records</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Messages</div>
          <div class="stat-value">${stats.total.messages}</div>
          <div class="stat-unit">records</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Logs</div>
          <div class="stat-value">${stats.total.logs}</div>
          <div class="stat-unit">records</div>
        </div>
      </div>
      
      <h4 style="color: var(--accent-color); margin: 20px 0 12px 0; font-size: 1.1em;">⏰ 24 giờ qua</h4>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Thời tiết</div>
          <div class="stat-value">${stats.last24h.weather}</div>
          <div class="stat-unit">records</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tỷ giá</div>
          <div class="stat-value">${stats.last24h.exchange}</div>
          <div class="stat-unit">records</div>
        </div>
      </div>
    `;

    // Latest data
    if (stats.latest.weather) {
      html += `
        <h4 style="color: var(--warning-color); margin: 20px 0 12px 0; font-size: 1.1em;">🔥 Dữ liệu mới nhất</h4>
        <div class="result-item">
          <div class="item-label">Thời tiết</div>
          <div class="item-value highlight">${
            stats.latest.weather.temperature
          }°C, ${stats.latest.weather.humidity}%</div>
          <div class="item-time">${new Date(
            stats.latest.weather.created_at
          ).toLocaleString("vi-VN")}</div>
        </div>
      `;
    }

    if (stats.latest.exchange) {
      html += `
        <div class="result-item">
          <div class="item-label">Tỷ giá</div>
          <div class="item-value highlight">${
            stats.latest.exchange.base_currency
          }/${
        stats.latest.exchange.target_currency
      }: ${stats.latest.exchange.rate.toFixed(2)}</div>
          <div class="item-time">${new Date(
            stats.latest.exchange.created_at
          ).toLocaleString("vi-VN")}</div>
        </div>
      `;
    }

    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = html;
  } catch (error) {
    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = `<p class="placeholder-text" style="color: var(--danger-color);">❌ Lỗi: ${error.message}</p>`;
  }
}

/**
 * Truy vấn hoạt động gần đây - từ logs và history
 */
async function handleQueryRecent() {
  console.log("🔵 handleQueryRecent được gọi");
  const resultsDiv = document.getElementById("queryResults");

  // Show loading
  resultsDiv.className = "query-results loading";
  resultsDiv.innerHTML = "";

  try {
    console.log("📤 Đang lấy dữ liệu từ history APIs...");
    // Lấy dữ liệu từ các history APIs
    const [weatherResult, exchangeResult, messageResult] = await Promise.all([
      apiCall("/api/weather/history?limit=20").catch((err) => {
        console.error("❌ Lỗi weather history:", err);
        return { success: true, data: [] };
      }),
      apiCall("/api/exchange/history?limit=20").catch((err) => {
        console.error("❌ Lỗi exchange history:", err);
        return { success: true, data: [] };
      }),
      apiCall("/api/message/history?limit=20").catch((err) => {
        console.error("❌ Lỗi message history:", err);
        return { success: true, data: [] };
      }),
    ]);

    console.log("✅ Đã lấy dữ liệu:", {
      weather: weatherResult.data?.length || 0,
      exchange: exchangeResult.data?.length || 0,
      message: messageResult.data?.length || 0,
    });

    const weatherData = (weatherResult.data || []).map((item) => ({
      type: "weather",
      data: `${item.temperature}°C, ${item.humidity}%`,
      created_at: item.created_at,
    }));

    const exchangeData = (exchangeResult.data || []).map((item) => ({
      type: "exchange",
      data: `${item.base_currency}/${item.target_currency}: ${item.rate.toFixed(
        2
      )}`,
      created_at: item.created_at,
    }));

    const messageData = (messageResult.data || []).map((item) => ({
      type: "message",
      data: item.message,
      created_at: item.created_at,
    }));

    // Gộp và sắp xếp theo thời gian
    const data = [...weatherData, ...exchangeData, ...messageData]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);

    if (data.length === 0) {
      resultsDiv.className = "query-results";
      resultsDiv.innerHTML =
        '<p class="placeholder-text">Không có hoạt động nào</p>';
      return;
    }

    // Build HTML
    let html = `
      <div class="result-header">
        <h3>🕐 Hoạt Động Gần Đây</h3>
        <div class="result-meta">${data.length} hoạt động</div>
      </div>
    `;

    // Type icons
    const typeIcons = {
      weather: "🌡️",
      exchange: "💱",
      message: "✉️",
    };

    const typeLabels = {
      weather: "Thời tiết",
      exchange: "Tỷ giá",
      message: "Message",
    };

    data.forEach((item) => {
      const icon = typeIcons[item.type] || "📝";
      const label = typeLabels[item.type] || item.type;
      const time = new Date(item.created_at).toLocaleString("vi-VN");

      html += `
        <div class="result-item">
          <div class="item-label">${icon} ${label}</div>
          <div class="item-value">${item.data}</div>
          <div class="item-time">${time}</div>
        </div>
      `;
    });

    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = html;
  } catch (error) {
    resultsDiv.className = "query-results";
    resultsDiv.innerHTML = `<p class="placeholder-text" style="color: var(--danger-color);">❌ Lỗi: ${error.message}</p>`;
  }
}

// Chạy khi DOM ready
console.log("🚀 Script đã load!");
try {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
} catch (error) {
  console.error("❌ Lỗi khởi tạo ứng dụng:", error);
  alert("Lỗi khởi tạo ứng dụng: " + error.message);
}
