const latestDetection = document.getElementById("latestDetection");
const liveAlerts = document.getElementById("liveAlerts");
const liveDetections = document.getElementById("liveDetections");

function hasConfiguredBackend() {
  if (!window.location.hostname.endsWith("github.io")) return true;
  return Boolean(String(window.WG_API_BASE || "").trim());
}

function readLocalObservations() {
  try {
    const raw = localStorage.getItem("wg_local_observations") || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderLive(detections, alerts, localMode = false) {
  const top = detections[0];
  if (top) {
    latestDetection.innerHTML = `
      <p><strong>Species:</strong> ${top.top_label}</p>
      <p><strong>Confidence:</strong> ${Math.round(Number(top.confidence || 0) * 100)}%</p>
      <p><strong>Time:</strong> ${new Date(top.created_at).toLocaleString()}</p>
      <p><strong>Source:</strong> ${top.source}</p>
      ${localMode ? "<p><strong>Mode:</strong> Local intelligence stream</p>" : ""}
    `;
  } else {
    latestDetection.textContent = localMode ? "No local detections yet. Start camera to generate stream data." : "No detections yet.";
  }

  liveAlerts.innerHTML = alerts.length
    ? alerts.map((a) => `<li><strong>${a.channel}</strong> ${a.status}<br>${a.message}</li>`).join("")
    : `<li>${localMode ? "No local alert patterns yet." : "No alerts yet."}</li>`;

  liveDetections.innerHTML = detections.length
    ? detections
        .map(
          (d) =>
            `<li>${new Date(d.created_at).toLocaleTimeString()} - ${d.top_label} (${Math.round(Number(d.confidence || 0) * 100)}%) from ${d.source}</li>`,
        )
        .join("")
    : `<li>${localMode ? "Waiting for local camera detections." : "No detections yet."}</li>`;
}

function fallbackLiveFromLocal() {
  const observations = readLocalObservations().slice(0, 20);
  const detections = observations.map((row) => ({
    top_label: row.species || "Unknown",
    confidence: Number(row.confidence || 0),
    created_at: row.captured_at || new Date().toISOString(),
    source: row.source || "local-ai",
  }));

  const highCount = detections.filter((d) => d.confidence >= 0.75).length;
  const alerts = highCount
    ? [
        {
          channel: "local",
          status: "active",
          message: `${highCount} high-confidence wildlife events detected in local stream.`,
        },
      ]
    : [];

  return { detections, alerts };
}

async function pollLive() {
  if (hasConfiguredBackend()) {
    try {
      const [detectionsRes, alertsRes] = await Promise.all([fetch("/api/detections?limit=10"), fetch("/api/alerts?limit=10")]);
      if (detectionsRes.ok && alertsRes.ok) {
        const detections = await detectionsRes.json();
        const alerts = await alertsRes.json();
        renderLive(Array.isArray(detections) ? detections : [], Array.isArray(alerts) ? alerts : [], false);
        return;
      }
    } catch {
      // Fall through to local mode.
    }
  }

  const fallback = fallbackLiveFromLocal();
  renderLive(fallback.detections, fallback.alerts, true);
}

pollLive().catch(() => {
  latestDetection.textContent = "Unable to load live data.";
});
setInterval(() => pollLive().catch(() => {}), 4000);
