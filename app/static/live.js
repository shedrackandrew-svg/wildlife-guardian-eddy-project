const latestDetection = document.getElementById("latestDetection");
const liveAlerts = document.getElementById("liveAlerts");
const liveDetections = document.getElementById("liveDetections");

async function pollLive() {
  const [detectionsRes, alertsRes] = await Promise.all([
    fetch("/api/detections?limit=10"),
    fetch("/api/alerts?limit=10"),
  ]);

  const detections = await detectionsRes.json();
  const alerts = await alertsRes.json();

  const top = detections[0];
  if (top) {
    latestDetection.innerHTML = `
      <p><strong>Species:</strong> ${top.top_label}</p>
      <p><strong>Confidence:</strong> ${Math.round(top.confidence * 100)}%</p>
      <p><strong>Time:</strong> ${new Date(top.created_at).toLocaleString()}</p>
      <p><strong>Source:</strong> ${top.source}</p>
    `;
  } else {
    latestDetection.textContent = "No detections yet.";
  }

  liveAlerts.innerHTML = alerts
    .map((a) => `<li><strong>${a.channel}</strong> ${a.status}<br>${a.message}</li>`)
    .join("");

  liveDetections.innerHTML = detections
    .map(
      (d) =>
        `<li>${new Date(d.created_at).toLocaleTimeString()} - ${d.top_label} (${Math.round(d.confidence * 100)}%) from ${d.source}</li>`,
    )
    .join("");
}

pollLive().catch(() => {
  latestDetection.textContent = "Unable to load live data.";
});
setInterval(() => pollLive().catch(() => {}), 4000);
