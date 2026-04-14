const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const resultBox = document.getElementById("resultBox");
const alertsList = document.getElementById("alertsList");
const detectionsList = document.getElementById("detectionsList");
const animalProfile = document.getElementById("animalProfile");
const speciesSearchInput = document.getElementById("speciesSearch");
const searchSpeciesBtn = document.getElementById("searchSpecies");

const startBtn = document.getElementById("startCamera");
const stopBtn = document.getElementById("stopCamera");

const ctx = overlay.getContext("2d");
let stream = null;
let localModel = null;
let localLoopHandle = null;
let uploadLoopHandle = null;

function renderAnimalProfile(profile) {
  if (!profile) {
    animalProfile.textContent = "No stored profile matched this scan yet.";
    return;
  }

  const habitats = profile.habitats?.length ? profile.habitats.join(", ") : "Unknown";
  const regions = profile.regions?.length ? profile.regions.join(", ") : "Unknown";
  const aliases = profile.aliases?.length ? profile.aliases.join(", ") : "None";
  const facts = profile.facts?.length
    ? `<ul>${profile.facts.map((f) => `<li>${f}</li>`).join("")}</ul>`
    : "<p>No facts stored.</p>";

  animalProfile.innerHTML = `
    <h3>${profile.species_name}</h3>
    <p><strong>Scientific:</strong> ${profile.scientific_name}</p>
    <p><strong>Family:</strong> ${profile.family}</p>
    <p><strong>Status:</strong> ${profile.conservation_status}</p>
    <p><strong>Diet:</strong> ${profile.diet}</p>
    <p><strong>Lifespan:</strong> ${profile.average_lifespan_years} years</p>
    <p><strong>Top speed:</strong> ${profile.top_speed_kmh ?? "Unknown"} km/h</p>
    <p><strong>Habitats:</strong> ${habitats}</p>
    <p><strong>Regions:</strong> ${regions}</p>
    <p><strong>Aliases:</strong> ${aliases}</p>
    <p><strong>Safety:</strong> ${profile.safety_notes}</p>
    <p><strong>Record file:</strong> ${profile.record_path}</p>
    <div><strong>Facts:</strong>${facts}</div>
  `;
}

async function loadModel() {
  if (!localModel) {
    localModel = await cocoSsd.load();
  }
}

function drawPredictions(predictions) {
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.strokeStyle = "#ffe600";
  ctx.lineWidth = 2;
  ctx.fillStyle = "#ffe600";
  ctx.font = "14px IBM Plex Mono";

  predictions.forEach((prediction) => {
    const [x, y, w, h] = prediction.bbox;
    ctx.strokeRect(x, y, w, h);
    ctx.fillText(`${prediction.class} (${Math.round(prediction.score * 100)}%)`, x, y > 15 ? y - 6 : y + 15);
  });
}

async function localDetectLoop() {
  if (!localModel || video.readyState < 2) {
    localLoopHandle = requestAnimationFrame(localDetectLoop);
    return;
  }

  const predictions = await localModel.detect(video, 20, 0.35);
  drawPredictions(predictions);

  if (predictions.length > 0) {
    const classes = predictions.map((p) => `${p.class} ${Math.round(p.score * 100)}%`).join(", ");
    resultBox.textContent = `Browser AI: ${classes}`;
  } else {
    resultBox.textContent = "Browser AI: no known object currently.";
  }

  localLoopHandle = requestAnimationFrame(localDetectLoop);
}

async function uploadSnapshot() {
  if (!stream || video.readyState < 2) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const cctx = canvas.getContext("2d");
  cctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) return;

  const form = new FormData();
  form.append("file", blob, "frame.jpg");
  form.append("source", "web-camera");

  const response = await fetch("/api/detect/image", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Server detection failed (${response.status})`);
  }

  const data = await response.json();
  resultBox.textContent += `\nServer AI: ${data.label} (${Math.round(data.confidence * 100)}%)`;
  renderAnimalProfile(data.animal_info || null);
}

async function searchSpecies() {
  const species = speciesSearchInput.value.trim();
  if (!species) {
    animalProfile.textContent = "Enter a species name to search.";
    return;
  }

  const response = await fetch(`/api/animals/${encodeURIComponent(species)}`);
  if (response.status === 404) {
    animalProfile.textContent = `No profile found for '${species}'.`;
    return;
  }
  if (!response.ok) {
    throw new Error(`Lookup failed (${response.status})`);
  }

  const profile = await response.json();
  renderAnimalProfile(profile);
}

async function pollTelemetry() {
  const [alertsRes, detectionsRes] = await Promise.all([
    fetch("/api/alerts?limit=8"),
    fetch("/api/detections?limit=8"),
  ]);

  const alerts = await alertsRes.json();
  const detections = await detectionsRes.json();

  alertsList.innerHTML = alerts
    .map((a) => `<li><strong>${a.channel}</strong> ${a.status}<br>${a.message}</li>`)
    .join("");

  detectionsList.innerHTML = detections
    .map((d) => `<li>${new Date(d.created_at).toLocaleTimeString()} - ${d.top_label} (${Math.round(d.confidence * 100)}%)</li>`)
    .join("");
}

async function startCamera() {
  if (stream) return;

  await loadModel();
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
  video.srcObject = stream;

  localDetectLoop();
  uploadLoopHandle = setInterval(() => {
    uploadSnapshot().catch((err) => {
      resultBox.textContent = `Upload error: ${err.message}`;
    });
    pollTelemetry().catch(() => {});
  }, 2500);
}

function stopCamera() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;

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

startBtn.addEventListener("click", () => {
  startCamera().catch((err) => {
    resultBox.textContent = `Camera error: ${err.message}`;
  });
});

stopBtn.addEventListener("click", stopCamera);
searchSpeciesBtn.addEventListener("click", () => {
  searchSpecies().catch((err) => {
    animalProfile.textContent = `Lookup error: ${err.message}`;
  });
});
speciesSearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchSpecies().catch((err) => {
      animalProfile.textContent = `Lookup error: ${err.message}`;
    });
  }
});

pollTelemetry().catch(() => {});
setInterval(() => pollTelemetry().catch(() => {}), 5000);
