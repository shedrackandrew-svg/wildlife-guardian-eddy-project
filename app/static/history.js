const dominantSpecies = document.getElementById("dominantSpecies");
const historyTimeline = document.getElementById("historyTimeline");

async function loadHistory() {
  const res = await fetch("/api/wildlife/history?limit=500");
  if (!res.ok) throw new Error("Failed to load wildlife history.");
  const payload = await res.json();

  dominantSpecies.innerHTML = payload.dominant_species.length
    ? payload.dominant_species
        .map((row) => `<li><strong>${row.species}</strong> - ${row.detections} detections</li>`)
        .join("")
    : "<li>No history yet.</li>";

  historyTimeline.innerHTML = payload.timeline.length
    ? payload.timeline
        .slice(0, 180)
        .map(
          (row) =>
            `<li>${new Date(row.captured_at).toLocaleString()} | ${row.species} (${Math.round(row.confidence * 100)}%) from ${row.source}</li>`,
        )
        .join("")
    : "<li>No events yet.</li>";
}

loadHistory().catch((err) => {
  dominantSpecies.innerHTML = `<li>${err.message}</li>`;
  historyTimeline.innerHTML = "<li>History unavailable.</li>";
});
