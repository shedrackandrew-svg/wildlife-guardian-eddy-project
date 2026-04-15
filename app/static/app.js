import { appendObservation, buildPredictiveAlerts, computeIntelSummary, readObservations } from "./intel.js";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const resultBox = document.getElementById("resultBox");
const alertsList = document.getElementById("alertsList");
const detectionsList = document.getElementById("detectionsList");
const inventoryList = document.getElementById("inventoryList");
const animalProfile = document.getElementById("animalProfile");
const speciesSearchInput = document.getElementById("speciesSearch");
const searchSpeciesBtn = document.getElementById("searchSpecies");
const startBtn = document.getElementById("startCamera");
const stopBtn = document.getElementById("stopCamera");
const toggleAnimalModeBtn = document.getElementById("toggleAnimalMode");
const toggleVoiceBtn = document.getElementById("toggleVoice");
const cameraSelect = document.getElementById("cameraSelect");
const refreshCamerasBtn = document.getElementById("refreshCameras");
const connectExternalCameraBtn = document.getElementById("connectExternalCamera");
const externalCameraHint = document.getElementById("externalCameraHint");
const scanBluetoothBtn = document.getElementById("scanBluetooth");
const bluetoothScanMode = document.getElementById("bluetoothScanMode");
const connectStatus = document.getElementById("connectStatus");
const qrCanvas = document.getElementById("qrCanvas");
const slideMeta = document.getElementById("slideMeta");
const slideshowBg = document.getElementById("slideshowBg");
const galleryGrid = document.getElementById("galleryGrid");
const logoutBtn = document.getElementById("logoutBtn");
const openSettingsBtn = document.getElementById("openSettings");
const closeSettingsBtn = document.getElementById("closeSettings");
const settingsPanel = document.getElementById("settingsPanel");
const themeToneSelect = document.getElementById("themeTone");
const voiceStyleSelect = document.getElementById("voiceStyle");
const voiceRateInput = document.getElementById("voiceRate");

const authGate = document.getElementById("authGate");
const authForm = document.getElementById("authForm");
const authStatus = document.getElementById("authStatus");
const tabSignIn = document.getElementById("tabSignIn");
const tabSignUp = document.getElementById("tabSignUp");
const mcTotalSightings = document.getElementById("mcTotalSightings");
const mcSpeciesDiversity = document.getElementById("mcSpeciesDiversity");
const mcRiskScore = document.getElementById("mcRiskScore");
const mcHealthScore = document.getElementById("mcHealthScore");
const mcSignalText = document.getElementById("mcSignalText");

const ctx = overlay.getContext("2d");
let stream = null;
let localModel = null;
let localLoopHandle = null;
let uploadLoopHandle = null;
let uploadInFlight = false;
let voiceEnabled = true;
let voicePrimed = true;
let lastSpokenLabel = "";
let lastSpokenAt = 0;
let slideshowItems = [];
let slideshowIndex = 0;
let animalOnlyMode = true;
let availableVoices = [];
let stableServerLabel = "";
let stableServerHits = 0;
let globalSettings = {
  theme: "forest",
  masterVolume: 0.75,
  voiceRate: 0.96,
  autoCaptureMs: 1300,
  minConfidence: 0.35,
  strictAnimalMode: true,
  doubleVerifyDetection: true,
};

const defaultSettings = {
  themeTone: "forest",
  voiceStyle: "female",
  voiceRate: 0.95,
};

let uiSettings = { ...defaultSettings };
let lastLocalObservationAt = 0;
let localPulse = 0;

function isGithubPagesHost() {
  return window.location.hostname.endsWith("github.io");
}

function getRepoBasePath() {
  if (!isGithubPagesHost()) return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length ? `/${parts[0]}` : "";
}

function appPageUrl(pathWithQuery) {
  const [rawPath, rawQuery] = String(pathWithQuery || "/").split("?");
  const normalized = (rawPath.replace(/\/$/, "") || "/");
  const routeMap = {
    "/": "/index.html",
    "/dashboard": "/dashboard.html",
    "/library": "/library.html",
    "/history": "/history.html",
    "/map": "/map.html",
    "/live": "/live.html",
    "/settings": "/settings.html",
    "/onboarding": "/onboarding.html",
    "/admin": "/admin.html",
    "/remote-camera": "/remote_camera.html",
  };

  const mapped = isGithubPagesHost() ? (routeMap[normalized] || normalized) : normalized;
  const prefix = isGithubPagesHost() ? getRepoBasePath() : "";
  const url = `${window.location.origin}${prefix}${mapped}`;
  return rawQuery ? `${url}?${rawQuery}` : url;
}

function hasConfiguredBackend() {
  if (!isGithubPagesHost()) return true;
  return Boolean(String(window.WG_API_BASE || "").trim());
}

const backendEnabled = hasConfiguredBackend();

function recordLocalObservation(species, confidence, source = "local-ai") {
  if (!species) return;
  const now = Date.now();
  if (now - lastLocalObservationAt < 2500) return;
  lastLocalObservationAt = now;
  appendObservation(species, confidence, source);
}

function renderMissionControl() {
  if (!mcTotalSightings) return;
  const summary = computeIntelSummary(readObservations());
  const signal = buildPredictiveAlerts(summary)[0];

  mcTotalSightings.textContent = String(summary.totalSightings);
  mcSpeciesDiversity.textContent = String(summary.uniqueSpecies);
  mcRiskScore.textContent = `${summary.riskScore}`;
  mcHealthScore.textContent = `${summary.healthScore}`;

  const lastSeen = summary.lastSeenAt ? new Date(summary.lastSeenAt).toLocaleTimeString() : "no recent event";
  mcSignalText.textContent = `${signal.message} Last seen: ${lastSeen}.`;
}

const ANIMAL_CLASSES = new Set([
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "lion",
  "tiger",
  "leopard",
  "deer",
  "boar",
  "goat",
  "buffalo",
  "monkey",
  "snake",
  "cow",
  "sheep",
  "butterfly",
  "bee",
  "ant",
  "spider",
  "insect",
]);

function loadGlobalSettings() {
  try {
    const raw = localStorage.getItem("wg_global_settings");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    globalSettings = {
      ...globalSettings,
      theme: parsed.theme || globalSettings.theme,
      masterVolume: Number(parsed.masterVolume) || globalSettings.masterVolume,
      voiceRate: Number(parsed.voiceRate) || globalSettings.voiceRate,
      autoCaptureMs: Number(parsed.autoCaptureMs) || globalSettings.autoCaptureMs,
      minConfidence: Number(parsed.minConfidence) || globalSettings.minConfidence,
      strictAnimalMode: parsed.strictAnimalMode !== false,
      doubleVerifyDetection: parsed.doubleVerifyDetection !== false,
    };
    animalOnlyMode = globalSettings.strictAnimalMode;
  } catch {
    // Keep defaults if parsing fails.
  }
}

function getToken() {
  return localStorage.getItem("wg_access_token") || "";
}

function setToken(token) {
  localStorage.setItem("wg_access_token", token);
}

function clearToken() {
  localStorage.removeItem("wg_access_token");
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("wg_ui_settings");
    if (!raw) {
      uiSettings = { ...defaultSettings };
      return;
    }
    const parsed = JSON.parse(raw);
    uiSettings = {
      themeTone: parsed.themeTone || defaultSettings.themeTone,
      voiceStyle: parsed.voiceStyle || defaultSettings.voiceStyle,
      voiceRate: Number(parsed.voiceRate) || defaultSettings.voiceRate,
    };
  } catch {
    uiSettings = { ...defaultSettings };
  }
}

function saveSettings() {
  localStorage.setItem("wg_ui_settings", JSON.stringify(uiSettings));
}

function applyTheme() {
  const tone = uiSettings.themeTone;
  if (tone === "savanna") {
    document.documentElement.style.setProperty("--accent", "#e1b866");
    document.documentElement.style.setProperty("--accent-2", "#b87f2f");
    return;
  }
  if (tone === "ocean") {
    document.documentElement.style.setProperty("--accent", "#5ed6da");
    document.documentElement.style.setProperty("--accent-2", "#2f82c8");
    return;
  }
  document.documentElement.style.setProperty("--accent", "#49d39f");
  document.documentElement.style.setProperty("--accent-2", "#1ea8c2");
}

function syncSettingsInputs() {
  if (themeToneSelect) themeToneSelect.value = uiSettings.themeTone;
  if (voiceStyleSelect) voiceStyleSelect.value = uiSettings.voiceStyle;
  if (voiceRateInput) voiceRateInput.value = String(uiSettings.voiceRate);
}

function pickVoice() {
  if (!window.speechSynthesis) return null;
  if (!availableVoices.length) {
    availableVoices = window.speechSynthesis.getVoices();
  }
  if (!availableVoices.length) return null;

  const wantMale = uiSettings.voiceStyle === "male";
  const wantFemale = uiSettings.voiceStyle === "female";
  if (!wantMale && !wantFemale) return availableVoices[0];

  const preferred = availableVoices.find((v) => {
    const name = String(v.name || "").toLowerCase();
    if (wantMale) {
      return name.includes("male") || name.includes("david") || name.includes("guy");
    }
    return name.includes("female") || name.includes("zira") || name.includes("susan") || name.includes("aria");
  });
  return preferred || availableVoices[0];
}

function authHeaders(includeJson = false) {
  const headers = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function isLikelyExternalCamera(label) {
  const text = String(label || "").toLowerCase();
  return ["sony", "canon", "nikon", "usb", "cam link", "capture", "dslr", "mirrorless", "webcam utility"].some((k) =>
    text.includes(k),
  );
}

function setAuthMode(mode) {
  if (!tabSignIn || !tabSignUp) return;
  tabSignIn.classList.toggle("active", mode === "signin");
  tabSignUp.classList.toggle("active", mode === "signup");
}

function unlockApp() {
  if (authGate) authGate.classList.add("hidden");
}

function lockApp() {
  if (authGate) authGate.classList.add("hidden");
}

function primeVoice() {
  if (voicePrimed || !window.speechSynthesis) {
    return;
  }
  voicePrimed = true;
  try {
    const initSpeech = new SpeechSynthesisUtterance("WildGuard voice ready.");
    initSpeech.volume = Math.min(1, Math.max(0.1, globalSettings.masterVolume));
    initSpeech.rate = globalSettings.voiceRate || uiSettings.voiceRate;
    const voice = pickVoice();
    if (voice) initSpeech.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(initSpeech);
  } catch {
    // Browser may block speech until another gesture.
  }
}

function renderAnimalProfile(profile) {
  if (!profile) {
    animalProfile.textContent = "No stored profile matched this scan yet.";
    return;
  }

  const facts = profile.facts?.length ? `<ul>${profile.facts.map((f) => `<li>${f}</li>`).join("")}</ul>` : "<p>No facts stored.</p>";
  const imageBlock = profile.image_urls?.length
    ? `<div class="image-strip">${profile.image_urls
        .slice(0, 4)
        .map((url) => `<img src="${url}" alt="${profile.species_name}" style="width:74px;height:54px;object-fit:cover;border-radius:8px;margin-right:6px;" />`)
        .join("")}</div>`
    : "";

  animalProfile.innerHTML = `
    <h3>${profile.species_name}</h3>
    <p><strong>Scientific:</strong> ${profile.scientific_name}</p>
    <p><strong>Status:</strong> ${profile.conservation_status}</p>
    <p><strong>Diet:</strong> ${profile.diet}</p>
    <p><strong>Lifespan:</strong> ${profile.average_lifespan_years}</p>
    <p><strong>Top speed:</strong> ${profile.top_speed_kmh ?? "Unknown"} km/h</p>
    <p><strong>Habitats:</strong> ${(profile.habitats || []).join(", ") || "Unknown"}</p>
    <p><strong>Regions:</strong> ${(profile.regions || []).join(", ") || "Unknown"}</p>
    <p><strong>Safety:</strong> ${profile.safety_notes || "Observe from a safe distance."}</p>
    ${imageBlock}
    <div><strong>Findings:</strong>${facts}</div>
  `;
}

function speakProfile(label, profile) {
  if (!voiceEnabled || !window.speechSynthesis) return;
  const now = Date.now();
  if (label === lastSpokenLabel && now - lastSpokenAt < 8000) return;
  lastSpokenLabel = label;
  lastSpokenAt = now;

  const speech = new SpeechSynthesisUtterance();
  const fact = profile?.facts?.[0] || "No additional fact available right now.";
  speech.text = `WildGuard detected ${label}. Conservation status: ${profile?.conservation_status || "unknown"}. ${fact}`;
  speech.rate = globalSettings.voiceRate || uiSettings.voiceRate;
  speech.volume = Math.min(1, Math.max(0.1, globalSettings.masterVolume));
  const voice = pickVoice();
  if (voice) speech.voice = voice;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}

async function loadModel() {
  if (!localModel) localModel = await cocoSsd.load();
}

function drawPredictions(predictions) {
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.strokeStyle = "#f1be48";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#f7dc8e";
  ctx.font = "13px JetBrains Mono";
  predictions.forEach((prediction) => {
    const [x, y, w, h] = prediction.bbox;
    ctx.strokeRect(x, y, w, h);
    ctx.fillText(`${prediction.class} ${Math.round(prediction.score * 100)}%`, x, y > 15 ? y - 6 : y + 15);
  });
}

async function localDetectLoop() {
  if (!localModel || video.readyState < 2) {
    localLoopHandle = requestAnimationFrame(localDetectLoop);
    return;
  }

  const predictions = await localModel.detect(video, 16, 0.45);
  const visiblePredictions = animalOnlyMode
    ? predictions.filter((p) => ANIMAL_CLASSES.has(String(p.class || "").toLowerCase()))
    : predictions;

  drawPredictions(visiblePredictions);
  if (!uploadInFlight) {
    localPulse = (localPulse + 1) % 4;
    const pulseDots = ".".repeat(localPulse + 1);
    const topAnimal = visiblePredictions.length
      ? visiblePredictions.slice().sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0]
      : null;
    if (topAnimal && Number(topAnimal.score || 0) >= 0.55) {
      recordLocalObservation(topAnimal.class, topAnimal.score, "local-camera");
    }

    if (animalOnlyMode) {
      resultBox.textContent = visiblePredictions.length
        ? `Animal mode${pulseDots} ${visiblePredictions.length} tracked | top: ${topAnimal.class} ${Math.round(topAnimal.score * 100)}%`
        : `Animal-only scene${pulseDots} scanning for wildlife...`;
    } else {
      resultBox.textContent = predictions.length
        ? `Scene objects: ${predictions.map((p) => `${p.class} ${Math.round(p.score * 100)}%`).join(", ")}`
        : `Scene objects${pulseDots} scanning...`;
    }
  }

  localLoopHandle = requestAnimationFrame(localDetectLoop);
}

async function uploadSnapshot() {
  if (!stream || video.readyState < 2 || uploadInFlight) return;
  if (!backendEnabled) return;
  uploadInFlight = true;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    if (!blob) return;

    const form = new FormData();
    form.append("file", blob, "frame.jpg");
    form.append("source", "web-camera");
    const response = await fetch("/api/detect/image", { method: "POST", body: form });
    if (!response.ok) {
      // Keep local camera loop responsive even if backend is temporarily unavailable.
      resultBox.textContent = "Camera is running. Server detection temporarily unavailable.";
      return;
    }

    const data = await response.json();
    const requiredConfidence = Math.max(0.42, Number(globalSettings.minConfidence || 0.35));
    const confidence = Number(data.confidence || 0);
    if (data.label === "no_animal_detected" || confidence < requiredConfidence) {
      stableServerLabel = "";
      stableServerHits = 0;
      resultBox.textContent = "No confident animal detected yet. Scanning continues...";
      return;
    }

    if (data.label === stableServerLabel) {
      stableServerHits += 1;
    } else {
      stableServerLabel = data.label;
      stableServerHits = 1;
    }

    const requiredHits = globalSettings.doubleVerifyDetection ? 2 : 1;
    if (stableServerHits < requiredHits) {
      resultBox.textContent = `Verifying detection: ${data.label} (${Math.round(confidence * 100)}%)`;
      return;
    }

    resultBox.textContent = `Detected animal: ${data.label} (${Math.round(confidence * 100)}%)`;
    recordLocalObservation(data.label, confidence, "server-verify");
    renderAnimalProfile(data.animal_info || null);
    speakProfile(data.label, data.animal_info || null);
  } catch {
    resultBox.textContent = "Camera is running. Network detection temporarily unavailable.";
  } finally {
    uploadInFlight = false;
  }
}

async function loadCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    cameraSelect.innerHTML = '<option value="">Camera list unavailable</option>';
    return;
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((d) => d.kind === "videoinput");
  const sorted = cameras.sort((a, b) => {
    const aExt = isLikelyExternalCamera(a.label) ? 1 : 0;
    const bExt = isLikelyExternalCamera(b.label) ? 1 : 0;
    return bExt - aExt;
  });
  cameraSelect.innerHTML = sorted.length
    ? sorted.map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`).join("")
    : '<option value="">No camera found</option>';

  const hasExternal = sorted.some((d) => isLikelyExternalCamera(d.label));
  if (externalCameraHint && hasExternal) {
    externalCameraHint.textContent = "External camera detected. Select it and click Start Camera.";
  }
}

async function connectExternalCamera() {
  await loadCameraDevices();
  const options = Array.from(cameraSelect.options);
  const external = options.find((opt) => isLikelyExternalCamera(opt.textContent));
  if (!external) {
    if (externalCameraHint) {
      externalCameraHint.textContent =
        "No external camera detected yet. Ensure USB/capture card is connected and the camera is in webcam/stream mode.";
    }
    return;
  }

  cameraSelect.value = external.value;
  if (externalCameraHint) {
    externalCameraHint.textContent = `Selected external camera: ${external.textContent}`;
  }
}

async function startCamera() {
  if (stream) return;
  await loadModel();
  const selected = cameraSelect.value;
  const constraints = selected
    ? { video: { deviceId: { exact: selected } }, audio: false }
    : { video: { facingMode: "environment" }, audio: false };
  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  localDetectLoop();
  uploadLoopHandle = setInterval(() => {
    uploadSnapshot().catch(() => {});
    pollTelemetry().catch(() => {});
    pollInventory().catch(() => {});
  }, Math.max(700, globalSettings.autoCaptureMs));
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  if (localLoopHandle) {
    cancelAnimationFrame(localLoopHandle);
    localLoopHandle = null;
  }
  if (uploadLoopHandle) {
    clearInterval(uploadLoopHandle);
    uploadLoopHandle = null;
  }
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  resultBox.textContent = "Camera stopped.";
}

async function searchSpecies() {
  if (!backendEnabled) {
    animalProfile.textContent = "Species lookup needs a connected backend API. Camera scanning still works in this mode.";
    return;
  }
  const species = speciesSearchInput.value.trim();
  if (!species) {
    animalProfile.textContent = "Enter a species name to search.";
    return;
  }
  try {
    const response = await fetch(`/api/animals/${encodeURIComponent(species)}`);
    if (response.status === 404) {
      animalProfile.textContent = `No profile found for '${species}'.`;
      return;
    }
    if (!response.ok) throw new Error(`Lookup failed (${response.status})`);
    const profile = await response.json();
    renderAnimalProfile(profile);
    speakProfile(profile.species_name, profile);
  } catch {
    animalProfile.textContent = "Species lookup is temporarily unavailable. Camera scanning can still run.";
  }
}

function renderInventory(rows) {
  inventoryList.innerHTML = rows.length
    ? rows
        .slice(0, 16)
        .map((item) => {
          const img = item.image_url
            ? `<img class="inventory-thumb" src="${item.image_url}" alt="${item.species_name}" />`
            : `<div class="inventory-thumb fallback">${item.species_name}</div>`;
          return `
            <li class="inventory-card">
              ${img}
              <div class="inventory-meta">
                <strong>${item.species_name}</strong>
                <span>Seen ${item.count_seen}x</span>
                <span>${item.taxonomy_class || "Unknown"} / ${item.taxonomy_order || "Unknown"}</span>
                <span>Region: ${item.habitat_region || "Unknown"}</span>
                <a class="inventory-map-link" href="${appPageUrl(`/map?species=${encodeURIComponent(item.species_name.toLowerCase())}`)}">Open On Globe Map</a>
              </div>
            </li>
          `;
        })
        .join("")
    : "<li>No inventory records yet.</li>";
}

function alertChipKind(message, status) {
  const text = `${message || ""} ${status || ""}`.toLowerCase();
  if (text.includes("critical") || text.includes("danger") || text.includes("attack")) return "is-critical";
  if (text.includes("warning") || text.includes("high") || text.includes("risk")) return "is-elevated";
  return "is-info";
}

async function pollInventory() {
  if (!backendEnabled) {
    renderInventory([]);
    return;
  }
  try {
    const invRes = await fetch("/api/inventory");
    if (!invRes.ok) {
      renderInventory([]);
      return;
    }
    const rows = await invRes.json();
    renderInventory(Array.isArray(rows) ? rows : []);
  } catch {
    renderInventory([]);
  }
}

async function pollTelemetry() {
  if (!backendEnabled) {
    alertsList.innerHTML = "<li>Backend not connected. Alerts will appear once API is configured.</li>";
    detectionsList.innerHTML = "<li>Backend not connected. Live detections list will appear once API is configured.</li>";
    return;
  }
  let alerts = [];
  let detections = [];

  try {
    const [alertsRes, detectionsRes] = await Promise.all([fetch("/api/alerts?limit=8"), fetch("/api/detections?limit=8")]);
    alerts = alertsRes.ok ? await alertsRes.json() : [];
    detections = detectionsRes.ok ? await detectionsRes.json() : [];
  } catch {
    alerts = [];
    detections = [];
  }

  if (!Array.isArray(alerts)) alerts = [];
  if (!Array.isArray(detections)) detections = [];

  alertsList.innerHTML = alerts.length
    ? alerts
        .map((a) => {
          const chip = alertChipKind(a.message, a.status);
          return `<li class="live-item"><strong>${a.channel}</strong> ${a.status}<span class="chip ${chip}">${chip.replace("is-", "")}</span><br>${a.message}</li>`;
        })
        .join("")
    : "<li>Alerts unavailable right now.</li>";
  detectionsList.innerHTML = detections.length
    ? detections
        .map((d) => {
          const confidencePct = Math.round(Number(d.confidence || 0) * 100);
          const chip = confidencePct >= 85 ? "is-critical" : confidencePct >= 70 ? "is-elevated" : "is-info";
          return `<li class="live-item">${new Date(d.created_at).toLocaleTimeString()} - ${d.top_label} (${confidencePct}%)<span class="chip ${chip}">${confidencePct >= 85 ? "high" : confidencePct >= 70 ? "medium" : "low"}</span></li>`;
        })
        .join("")
    : "<li>Detections unavailable right now.</li>";
}

function buildSlide(item) {
  const confidence = typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}%` : "n/a";
  slideMeta.innerHTML = `
    <h3>${item.label || item.species_name}</h3>
    <p><strong>Confidence:</strong> ${confidence}</p>
    <p><strong>Scientific:</strong> ${item.scientific_name || "Unknown"}</p>
    <p><strong>Status:</strong> ${item.conservation_status || "Not evaluated"}</p>
  `;
}

function renderGallery(items) {
  galleryGrid.innerHTML = items.length
    ? items
        .slice(0, 9)
        .map((item) => {
          const img = item.image_url
            ? `<img src="${item.image_url}" alt="${item.label}" />`
            : `<div class="gallery-fallback">${item.label || item.species_name || "animal"}</div>`;
          return `<article class="gallery-card">${img}<h4>${item.label || item.species_name}</h4></article>`;
        })
        .join("")
    : "<p class='tiny-note'>No captured animal images yet.</p>";
}

function renderSlide(index) {
  if (!slideshowItems.length) {
    slideshowBg.style.backgroundImage = "linear-gradient(120deg, #1d3b2c, #1a2231)";
    slideMeta.textContent = "No gallery items yet. Start scanning animals to build the slideshow.";
    return;
  }
  const item = slideshowItems[index % slideshowItems.length];
  if (item.image_url) {
    slideshowBg.style.backgroundImage = `linear-gradient(rgba(11,22,15,0.25), rgba(11,22,15,0.72)), url(${item.image_url})`;
  } else {
    const seed = item.species_name || item.label || "wild";
    const hue = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
    slideshowBg.style.backgroundImage = `linear-gradient(140deg, hsl(${hue} 45% 28%), hsl(${(hue + 65) % 360} 42% 20%))`;
  }
  buildSlide(item);
}

async function loadSlideshow() {
  if (!backendEnabled) {
    slideshowItems = [];
    renderGallery(slideshowItems);
    renderSlide(0);
    return;
  }
  try {
    const galleryRes = await fetch("/api/gallery?limit=24");
    if (galleryRes.ok) {
      const gallery = await galleryRes.json();
      slideshowItems = Array.isArray(gallery) ? gallery : [];
    }
    if (!slideshowItems.length) {
      const animalsRes = await fetch("/api/animals?limit=24");
      const animals = animalsRes.ok ? await animalsRes.json() : [];
      slideshowItems = Array.isArray(animals)
        ? animals.map((a) => ({ species_name: a.species_name, scientific_name: a.scientific_name, conservation_status: a.conservation_status }))
        : [];
    }
  } catch {
    slideshowItems = [];
  }

  renderGallery(slideshowItems);
  renderSlide(0);
  setInterval(() => {
    slideshowIndex += 1;
    renderSlide(slideshowIndex);
  }, 4200);
}

async function initQrCode() {
  const shareUrl = appPageUrl("/live");
  if (window.QRCode?.toCanvas) {
    await window.QRCode.toCanvas(qrCanvas, shareUrl, {
      width: 180,
      margin: 1,
      color: { dark: "#0f1f15", light: "#f4f1df" },
    });
  }
}

function bluetoothRequestOptions(mode) {
  if (mode === "wildlife") {
    return {
      filters: [
        { namePrefix: "Wild" },
        { namePrefix: "BLE" },
        { services: ["battery_service"] },
      ],
      optionalServices: ["battery_service", "device_information"],
    };
  }
  if (mode === "wearable") {
    return {
      filters: [{ namePrefix: "MI" }, { namePrefix: "Fit" }, { namePrefix: "Watch" }],
      optionalServices: ["heart_rate", "battery_service", "device_information"],
    };
  }
  return {
    acceptAllDevices: true,
    optionalServices: ["battery_service", "device_information"],
  };
}

async function scanBluetooth() {
  if (!navigator.bluetooth?.requestDevice) {
    connectStatus.textContent = "Web Bluetooth not available in this browser/device.";
    return;
  }
  const mode = bluetoothScanMode?.value || "general";
  const options = bluetoothRequestOptions(mode);
  connectStatus.textContent = "Scanning nearby Bluetooth devices...";
  try {
    const device = await navigator.bluetooth.requestDevice(options);
    connectStatus.textContent = `Found ${device.name || "Unnamed"} (${device.id.slice(0, 8)}...). Use onboarding QR/link for internet pairing.`;
  } catch (err) {
    connectStatus.textContent = `Bluetooth pairing canceled or failed: ${err.message}`;
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  unlockApp();
  primeVoice();
  if (authStatus) {
    authStatus.textContent = "Authentication is disabled on this dashboard build.";
  }
}

function attachEvents() {
  startBtn.addEventListener("click", () => {
    primeVoice();
    startCamera().catch((err) => (resultBox.textContent = `Camera error: ${err.message}`));
  });
  stopBtn.addEventListener("click", stopCamera);
  refreshCamerasBtn.addEventListener("click", () => loadCameraDevices().catch(() => {}));
  if (connectExternalCameraBtn) {
    connectExternalCameraBtn.addEventListener("click", () => {
      connectExternalCamera().catch((err) => {
        if (externalCameraHint) externalCameraHint.textContent = `External camera link error: ${err.message}`;
      });
    });
  }
  searchSpeciesBtn.addEventListener("click", () => searchSpecies().catch((err) => (animalProfile.textContent = `Lookup error: ${err.message}`)));
  speciesSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchSpecies().catch((err) => (animalProfile.textContent = `Lookup error: ${err.message}`));
  });
  toggleVoiceBtn.addEventListener("click", () => {
    voiceEnabled = !voiceEnabled;
    toggleVoiceBtn.textContent = voiceEnabled ? "Voice On" : "Voice Off";
    if (voiceEnabled) {
      primeVoice();
      speakProfile("system", { conservation_status: "active", facts: ["Voice narration enabled."] });
    }
  });
  toggleAnimalModeBtn.addEventListener("click", () => {
    animalOnlyMode = !animalOnlyMode;
    toggleAnimalModeBtn.textContent = animalOnlyMode ? "Animal-Only On" : "Animal-Only Off";
  });
  scanBluetoothBtn.addEventListener("click", () => {
    scanBluetooth().catch(() => {});
  });
  if (tabSignIn) tabSignIn.addEventListener("click", () => setAuthMode("signin"));
  if (tabSignUp) tabSignUp.addEventListener("click", () => setAuthMode("signup"));
  if (authForm) {
    authForm.addEventListener("submit", (event) => {
      handleAuthSubmit(event).catch((err) => {
        if (authStatus) authStatus.textContent = err.message;
      });
    });
  }
  logoutBtn.addEventListener("click", () => {
    stopCamera();
    if (authStatus) authStatus.textContent = "Camera stopped.";
  });

  if (openSettingsBtn && closeSettingsBtn && settingsPanel) {
    openSettingsBtn.addEventListener("click", () => settingsPanel.classList.remove("hidden"));
    closeSettingsBtn.addEventListener("click", () => settingsPanel.classList.add("hidden"));
  }

  if (themeToneSelect) {
    themeToneSelect.addEventListener("change", () => {
      uiSettings.themeTone = themeToneSelect.value;
      saveSettings();
      applyTheme();
    });
  }

  if (voiceStyleSelect) {
    voiceStyleSelect.addEventListener("change", () => {
      uiSettings.voiceStyle = voiceStyleSelect.value;
      saveSettings();
    });
  }

  if (voiceRateInput) {
    voiceRateInput.addEventListener("input", () => {
      uiSettings.voiceRate = Number(voiceRateInput.value) || defaultSettings.voiceRate;
      saveSettings();
    });
  }
}

async function init() {
  loadGlobalSettings();
  loadSettings();
  applyTheme();
  syncSettingsInputs();
  unlockApp();

  if (window.speechSynthesis) {
    availableVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      availableVoices = window.speechSynthesis.getVoices();
    };
  }

  attachEvents();
  resultBox.classList.add("feed-live");

  await Promise.all([loadCameraDevices(), initQrCode(), loadSlideshow(), pollTelemetry(), pollInventory()]);
  renderMissionControl();
  setInterval(() => pollTelemetry().catch(() => {}), 1800);
  setInterval(() => pollInventory().catch(() => {}), 2600);
  setInterval(() => renderMissionControl(), 1500);

  resultBox.textContent = backendEnabled
    ? "Ready. Click Start Camera to begin secure scanning."
    : "Ready in non-expiring web mode. Click Start Camera for local animal scanning.";
}

init().catch((err) => {
  // Do not block camera usage if non-critical data loading fails.
  resultBox.textContent = `System partially loaded (${err.message}). Camera can still be started.`;
});
