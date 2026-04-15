const sourceName = document.getElementById("sourceName");
const generateLink = document.getElementById("generateLink");
const pairUrl = document.getElementById("pairUrl");
const pairQr = document.getElementById("pairQr");
const copyPairLink = document.getElementById("copyPairLink");
const openRemotePage = document.getElementById("openRemotePage");

function isGithubPagesHost() {
  return window.location.hostname.endsWith("github.io");
}

function getRepoBasePath() {
  if (!isGithubPagesHost()) return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length ? `/${parts[0]}` : "";
}

function buildLink() {
  const source = (sourceName.value || "phone-cam-1").trim().toLowerCase();
  const prefix = getRepoBasePath();
  const path = isGithubPagesHost() ? "/remote_camera.html" : "/remote-camera";
  const url = `${window.location.origin}${prefix}${path}?source=${encodeURIComponent(source)}`;
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

renderPairing().catch(() => {});
