const phoneVideo = document.getElementById("phoneVideo");
const startStreamBtn = document.getElementById("startStream");
const stopStreamBtn = document.getElementById("stopStream");
const phoneStatus = document.getElementById("phoneStatus");
const streamIntervalInput = document.getElementById("streamInterval");
const streamQualityInput = document.getElementById("streamQuality");

const query = new URLSearchParams(window.location.search);
const sourceId = (query.get("source") || "phone-cam-1").trim().toLowerCase();

function normalizeApiBase(raw) {
  const value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return "";
  return value;
}

const queryApiBase = normalizeApiBase(query.get("api_base") || "");
const storedApiBase = normalizeApiBase(localStorage.getItem("wg_api_base") || "");
const injectedApiBase = normalizeApiBase(window.WG_API_BASE || window.WG_DEFAULT_API_BASE || "");
const apiBase = queryApiBase || storedApiBase || injectedApiBase;

if (apiBase) {
  localStorage.setItem("wg_api_base", apiBase);
  window.WG_API_BASE = apiBase;
}

const backendEnabled = !window.location.hostname.endsWith("github.io") || Boolean(apiBase);

let stream = null;
let timer = null;
let busy = false;

function apiUrl(path) {
  const cleanPath = String(path || "");
  return apiBase ? `${apiBase}${cleanPath}` : cleanPath;
}

function getIntervalMs() {
  const parsed = Number(streamIntervalInput.value || 1300);
  return Math.max(700, Math.min(4000, Number.isFinite(parsed) ? parsed : 1300));
}

function getQuality() {
  const parsed = Number(streamQualityInput.value || 0.82);
  return Math.max(0.4, Math.min(1.0, Number.isFinite(parsed) ? parsed : 0.82));
}

async function uploadFrame() {
  if (!backendEnabled) {
    phoneStatus.textContent = "Backend API not configured for this static link. Pair this page with a backend URL to stream detections.";
    return;
  }
  if (!stream || busy || phoneVideo.readyState < 2) {
    return;
  }
  busy = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = phoneVideo.videoWidth;
    canvas.height = phoneVideo.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(phoneVideo, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", getQuality()));
    if (!blob) {
      return;
    }

    const form = new FormData();
    form.append("file", blob, "phone-frame.jpg");
    form.append("source", sourceId);

    const res = await fetch(apiUrl("/api/detect/image"), {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      phoneStatus.textContent = `Upload failed (${res.status}).`;
      return;
    }

    const data = await res.json();
    phoneStatus.textContent = `Streaming from ${sourceId}. Last detection: ${data.label} (${Math.round(data.confidence * 100)}%).`;
  } finally {
    busy = false;
  }
}

async function start() {
  if (stream) {
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    phoneStatus.textContent = "Camera API is unavailable in this browser/device.";
    return;
  }
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  phoneVideo.srcObject = stream;
  phoneStatus.textContent = backendEnabled
    ? `Camera started for source ${sourceId}.`
    : `Camera preview started for source ${sourceId}. Connect a backend URL for live detection uploads.`;
  timer = setInterval(() => {
    uploadFrame().catch((err) => {
      phoneStatus.textContent = `Upload error: ${err.message}`;
    });
  }, getIntervalMs());
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  phoneStatus.textContent = "Stream stopped.";
}

startStreamBtn.addEventListener("click", () => {
  start().catch((err) => {
    phoneStatus.textContent = `Camera start failed: ${err.message}`;
  });
});
stopStreamBtn.addEventListener("click", stop);

if (!backendEnabled) {
  phoneStatus.textContent = "Backend not configured for this static link. Open onboarding and set API Link, then generate a new pair link.";
} else {
  phoneStatus.textContent = `Ready for source ${sourceId}. Backend linked.`;
}
