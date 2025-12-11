/**
 * Main application JavaScript
 * Kết nối MQTT, gọi API, điều khiển LED
 */

console.log("🔵 Script app.js đã được load!");

const API_BASE = "https://qiotbe.dev1.vimaru.edu.vn";
// WebSocket MQTT - sử dụng cùng host với HTTP server
const MQTT_BROKER = `ws://${window.location.hostname}:9001/mqtt`;
let mqttClient = null;

// ==================== MQTT Connection ====================

/**
 * Kết nối MQTT
 */
function connectMQTT() {
  try {
    mqttClient = mqtt.connect(MQTT_BROKER, {
      clientId: `web_client_${Math.random().toString(16).substr(2, 8)}`,
      reconnectPeriod: 5000,
    });

    mqttClient.on("connect", () => {
      console.log("✅ Đã kết nối MQTT");
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

  // Cập nhật MQTT status (giả định active nếu server online)
  checkServerStatus().then((online) => {
    updateMQTTStatus(online ? "connected" : "disconnected");
  });

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

  console.log("✅ Ứng dụng đã khởi tạo");
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
