const dominantSpecies = document.getElementById("dominantSpecies");
const historyTimeline = document.getElementById("historyTimeline");

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

function buildLocalHistoryPayload() {
  const events = readLocalObservations();
  const counts = new Map();

  for (const row of events) {
    const species = String(row.species || "Unknown");
    counts.set(species, (counts.get(species) || 0) + 1);
  }

  const dominant_species = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([species, detections]) => ({ species, detections }));

  const timeline = events.slice(0, 180).map((row) => ({
    captured_at: row.captured_at || new Date().toISOString(),
    species: row.species || "Unknown",
    confidence: Number(row.confidence || 0),
    source: row.source || "local-ai",
  }));

  return { dominant_species, timeline };
}

function renderHistory(payload, isLocal) {
  dominantSpecies.innerHTML = payload.dominant_species.length
    ? payload.dominant_species
        .map((row) => {
          const chip = row.detections >= 10 ? "is-critical" : row.detections >= 4 ? "is-elevated" : "is-info";
          return `<li class="live-item"><strong>${row.species}</strong> - ${row.detections} detections<span class="chip ${chip}">${chip.replace("is-", "")}</span></li>`;
        })
        .join("")
    : `<li>${isLocal ? "No local history yet. Start camera to build timeline." : "No history yet."}</li>`;

  historyTimeline.innerHTML = payload.timeline.length
    ? payload.timeline
        .slice(0, 180)
        .map(
          (row) => {
            const confidencePct = Math.round(Number(row.confidence || 0) * 100);
            const chip = confidencePct >= 85 ? "is-critical" : confidencePct >= 70 ? "is-elevated" : "is-info";
            return `<li class="live-item">${new Date(row.captured_at).toLocaleString()} | ${row.species} (${confidencePct}%) from ${row.source}<span class="chip ${chip}">${confidencePct >= 85 ? "high" : confidencePct >= 70 ? "medium" : "low"}</span></li>`;
          },
        )
        .join("")
    : `<li>${isLocal ? "Timeline waiting for first local detections." : "No events yet."}</li>`;
}

async function loadHistory() {
  if (hasConfiguredBackend()) {
    try {
      const res = await fetch("/api/wildlife/history?limit=500");
      if (res.ok) {
        const payload = await res.json();
        renderHistory(payload, false);
        return;
      }
    } catch {
      // Fall through to local dataset.
    }
  }

  renderHistory(buildLocalHistoryPayload(), true);
}

loadHistory().catch((err) => {
  dominantSpecies.innerHTML = `<li>${err.message || "History temporarily unavailable."}</li>`;
  historyTimeline.innerHTML = "<li>History unavailable.</li>";
});

setInterval(() => {
  loadHistory().catch(() => {});
}, 2400);
