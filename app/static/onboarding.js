const sourceName = document.getElementById("sourceName");
const generateLink = document.getElementById("generateLink");
const pairUrl = document.getElementById("pairUrl");
const pairQr = document.getElementById("pairQr");
const copyPairLink = document.getElementById("copyPairLink");
const openRemotePage = document.getElementById("openRemotePage");
const backendApiBaseInput = document.getElementById("backendApiBase");
const saveBackendApiBtn = document.getElementById("saveBackendApi");
const clearBackendApiBtn = document.getElementById("clearBackendApi");
const backendApiStatus = document.getElementById("backendApiStatus");

function isGithubPagesHost() {
  return window.location.hostname.endsWith("github.io");
}

function getRepoBasePath() {
  if (!isGithubPagesHost()) return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length ? `/${parts[0]}` : "";
}

function normalizeApiBase(raw) {
  const value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return "";
  return value;
}

function getConfiguredApiBase() {
  const query = new URLSearchParams(window.location.search);
  const queryBase = normalizeApiBase(query.get("api_base"));
  const storedBase = normalizeApiBase(localStorage.getItem("wg_api_base"));
  const selected = queryBase || storedBase;
  if (selected) {
    localStorage.setItem("wg_api_base", selected);
  }
  return selected;
}

function renderBackendStatus() {
  const activeBase = normalizeApiBase(localStorage.getItem("wg_api_base"));
  if (backendApiBaseInput) {
    backendApiBaseInput.value = activeBase;
  }
  if (!backendApiStatus) return;
  backendApiStatus.textContent = activeBase
    ? `Backend connected: ${activeBase}`
    : "No backend API set. Frontend-only mode will run.";
}

function buildLink() {
  const source = (sourceName.value || "phone-cam-1").trim().toLowerCase();
  const prefix = getRepoBasePath();
  const path = isGithubPagesHost() ? "/remote_camera.html" : "/remote-camera";
  const apiBase = normalizeApiBase(localStorage.getItem("wg_api_base"));
  const params = new URLSearchParams({ source });
  if (apiBase) {
    params.set("api_base", apiBase);
  }
  const url = `${window.location.origin}${prefix}${path}?${params.toString()}`;
  return { source, url };
}

async function renderPairing() {
  const { source, url } = buildLink();
  pairUrl.innerHTML = `<strong>Source:</strong> ${source}<br><strong>Pair URL:</strong> <a href="${url}">${url}</a>`;
  if (window.QRCode?.toCanvas) {
    await window.QRCode.toCanvas(pairQr, url, {
      width: 220,
      margin: 1,
      color: { dark: "#0f1f15", light: "#d8c33b" },
    });
  }
}

generateLink.addEventListener("click", () => {
  renderPairing().catch((err) => {
    pairUrl.textContent = `QR generation failed: ${err.message}`;
  });
});

copyPairLink.addEventListener("click", async () => {
  const { url } = buildLink();
  try {
    await navigator.clipboard.writeText(url);
    pairUrl.innerHTML += "<br><strong>Copied:</strong> link copied to clipboard.";
  } catch {
    pairUrl.innerHTML += "<br><strong>Copy failed:</strong> please copy the URL manually.";
  }
});

openRemotePage.addEventListener("click", () => {
  const { url } = buildLink();
  window.location.href = url;
});

if (saveBackendApiBtn) {
  saveBackendApiBtn.addEventListener("click", () => {
    const inputValue = normalizeApiBase(backendApiBaseInput?.value || "");
    if (!inputValue) {
      backendApiStatus.textContent = "Invalid backend URL. Use full https://... address.";
      return;
    }
    localStorage.setItem("wg_api_base", inputValue);
    renderBackendStatus();
    renderPairing().catch(() => {});
  });
}

if (clearBackendApiBtn) {
  clearBackendApiBtn.addEventListener("click", () => {
    localStorage.removeItem("wg_api_base");
    renderBackendStatus();
    renderPairing().catch(() => {});
  });
}

const initialApiBase = getConfiguredApiBase();
if (initialApiBase) {
  localStorage.setItem("wg_api_base", initialApiBase);
}
renderBackendStatus();

renderPairing().catch(() => {});
