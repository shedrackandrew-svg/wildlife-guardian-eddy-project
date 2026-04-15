import { clearIntelVault, computeIntelSummary, exportIntelVault, importIntelVault, readObservations } from "./intel.js";

const themeSelect = document.getElementById("themeSelect");
const masterVolume = document.getElementById("masterVolume");
const voiceRate = document.getElementById("voiceRate");
const captureMs = document.getElementById("captureMs");
const minConfidence = document.getElementById("minConfidence");
const strictAnimalMode = document.getElementById("strictAnimalMode");
const doubleVerifyDetection = document.getElementById("doubleVerifyDetection");
const mapRadarIntensity = document.getElementById("mapRadarIntensity");
const slideshowQuality = document.getElementById("slideshowQuality");
const mapAutoFocus = document.getElementById("mapAutoFocus");
const menuDensity = document.getElementById("menuDensity");
const advancedMenu = document.getElementById("advancedMenu");
const refreshDbInfo = document.getElementById("refreshDbInfo");
const saveBtn = document.getElementById("saveGlobalSettings");
const dbInfo = document.getElementById("dbInfo");
const vaultInfo = document.getElementById("vaultInfo");
const exportVaultBtn = document.getElementById("exportVault");
const importVaultBtn = document.getElementById("importVault");
const clearVaultBtn = document.getElementById("clearVault");
const vaultPayload = document.getElementById("vaultPayload");

const defaults = {
  theme: "forest",
  masterVolume: 0.75,
  voiceRate: 0.96,
  autoCaptureMs: 1300,
  minConfidence: 0.35,
  strictAnimalMode: true,
  doubleVerifyDetection: true,
  mapRadarIntensity: "medium",
  slideshowQuality: "balanced",
  mapAutoFocus: true,
  menuDensity: "comfortable",
  advancedMenu: "on",
};

let settings = { ...defaults };

function loadSettings() {
  try {
    const raw = localStorage.getItem("wg_global_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      settings = {
        theme: parsed.theme || defaults.theme,
        masterVolume: Number(parsed.masterVolume) || defaults.masterVolume,
        voiceRate: Number(parsed.voiceRate) || defaults.voiceRate,
        autoCaptureMs: Number(parsed.autoCaptureMs) || defaults.autoCaptureMs,
        minConfidence: Number(parsed.minConfidence) || defaults.minConfidence,
        strictAnimalMode: parsed.strictAnimalMode !== false,
        doubleVerifyDetection: parsed.doubleVerifyDetection !== false,
        mapRadarIntensity: parsed.mapRadarIntensity || defaults.mapRadarIntensity,
        slideshowQuality: parsed.slideshowQuality || defaults.slideshowQuality,
        mapAutoFocus: parsed.mapAutoFocus !== false,
        menuDensity: parsed.menuDensity || defaults.menuDensity,
        advancedMenu: parsed.advancedMenu || defaults.advancedMenu,
      };
    }
  } catch {
    settings = { ...defaults };
  }
}

function syncUi() {
  themeSelect.value = settings.theme;
  masterVolume.value = String(settings.masterVolume);
  voiceRate.value = String(settings.voiceRate);
  captureMs.value = String(settings.autoCaptureMs);
  minConfidence.value = String(settings.minConfidence);
  strictAnimalMode.checked = settings.strictAnimalMode;
  doubleVerifyDetection.checked = settings.doubleVerifyDetection;
  mapRadarIntensity.value = settings.mapRadarIntensity;
  slideshowQuality.value = settings.slideshowQuality;
  mapAutoFocus.checked = settings.mapAutoFocus;
  menuDensity.value = settings.menuDensity;
  advancedMenu.value = settings.advancedMenu;
}

function collectUi() {
  settings.theme = themeSelect.value;
  settings.masterVolume = Number(masterVolume.value) || defaults.masterVolume;
  settings.voiceRate = Number(voiceRate.value) || defaults.voiceRate;
  settings.autoCaptureMs = Math.max(700, Number(captureMs.value) || defaults.autoCaptureMs);
  settings.minConfidence = Math.min(0.99, Math.max(0.1, Number(minConfidence.value) || defaults.minConfidence));
  settings.strictAnimalMode = strictAnimalMode.checked;
  settings.doubleVerifyDetection = doubleVerifyDetection.checked;
  settings.mapRadarIntensity = mapRadarIntensity.value;
  settings.slideshowQuality = slideshowQuality.value;
  settings.mapAutoFocus = mapAutoFocus.checked;
  settings.menuDensity = menuDensity.value;
  settings.advancedMenu = advancedMenu.value;
}

function saveSettings() {
  collectUi();
  localStorage.setItem("wg_global_settings", JSON.stringify(settings));
  localStorage.setItem(
    "wg_ui_settings",
    JSON.stringify({
      themeTone: settings.theme,
      voiceRate: settings.voiceRate,
      voiceStyle: "auto",
      menuDensity: settings.menuDensity,
    }),
  );
}

async function loadDbInfo() {
  try {
    const res = await fetch("/api/settings/database-info");
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    dbInfo.innerHTML = `
      <p><strong>Database:</strong> ${data.database_url}</p>
      <p><strong>Detections:</strong> ${data.detections}</p>
      <p><strong>Inventory Items:</strong> ${data.inventory_items}</p>
      <p><strong>Alerts:</strong> ${data.alerts}</p>
      <p><strong>Users:</strong> ${data.users}</p>
    `;
  } catch (err) {
    dbInfo.textContent = `Unable to load database info: ${err.message}`;
  }
}

function refreshVaultInfo(message = "") {
  const summary = computeIntelSummary(readObservations());
  const top = summary.topSpecies.slice(0, 3).map((row) => `${row.species} (${row.count})`).join(", ") || "none";
  vaultInfo.innerHTML = `
    <p><strong>Stored Observations:</strong> ${summary.totalSightings}</p>
    <p><strong>Species Diversity:</strong> ${summary.uniqueSpecies}</p>
    <p><strong>Risk Score:</strong> ${summary.riskScore}</p>
    <p><strong>Top Species:</strong> ${top}</p>
    ${message ? `<p><strong>Status:</strong> ${message}</p>` : ""}
  `;
}

exportVaultBtn.addEventListener("click", () => {
  const payload = exportIntelVault();
  vaultPayload.value = JSON.stringify(payload, null, 2);
  refreshVaultInfo("Vault exported to text area.");
});

importVaultBtn.addEventListener("click", () => {
  try {
    const parsed = JSON.parse(vaultPayload.value || "{}");
    const summary = importIntelVault(parsed);
    refreshVaultInfo(`Vault imported. ${summary.totalSightings} events restored.`);
  } catch (err) {
    refreshVaultInfo(`Import failed: ${err.message}`);
  }
});

clearVaultBtn.addEventListener("click", () => {
  clearIntelVault();
  refreshVaultInfo("Vault cleared.");
});

saveBtn.addEventListener("click", () => {
  saveSettings();
  loadDbInfo().catch(() => {});
  dbInfo.textContent = "Settings saved. Open Home/Dashboard to see changes.";
});

refreshDbInfo.addEventListener("click", () => {
  loadDbInfo().catch(() => {});
});

loadSettings();
syncUi();
loadDbInfo().catch(() => {});
refreshVaultInfo();
