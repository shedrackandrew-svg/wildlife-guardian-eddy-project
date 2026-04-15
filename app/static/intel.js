const LOCAL_OBSERVATIONS_KEY = "wg_local_observations";

function normalizeObservation(row) {
  return {
    species: String(row?.species || "Unknown").toLowerCase(),
    confidence: Number(row?.confidence || 0),
    source: String(row?.source || "local-ai"),
    captured_at: row?.captured_at || new Date().toISOString(),
  };
}

export function readObservations() {
  try {
    const raw = localStorage.getItem(LOCAL_OBSERVATIONS_KEY) || "[]";
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeObservation);
  } catch {
    return [];
  }
}

export function writeObservations(rows) {
  const cleaned = Array.isArray(rows) ? rows.map(normalizeObservation).slice(0, 1200) : [];
  localStorage.setItem(LOCAL_OBSERVATIONS_KEY, JSON.stringify(cleaned));
}

export function appendObservation(species, confidence, source = "local-ai") {
  if (!species) return;
  const rows = readObservations();
  rows.unshift(
    normalizeObservation({
      species,
      confidence,
      source,
      captured_at: new Date().toISOString(),
    }),
  );
  writeObservations(rows);
}

export function computeIntelSummary(rows = readObservations()) {
  const total = rows.length;
  const unique = new Set(rows.map((r) => r.species)).size;
  const recent = rows.filter((r) => Date.now() - new Date(r.captured_at).getTime() < 10 * 60 * 1000);
  const high = rows.filter((r) => Number(r.confidence || 0) >= 0.85);

  const speciesCounts = new Map();
  for (const row of rows) {
    speciesCounts.set(row.species, (speciesCounts.get(row.species) || 0) + 1);
  }

  const topSpecies = Array.from(speciesCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([species, count]) => ({ species, count }));

  const avgConfidence = total
    ? rows.reduce((acc, row) => acc + Number(row.confidence || 0), 0) / total
    : 0;

  const riskRaw = Math.round(avgConfidence * 55 + Math.min(35, recent.length * 2) + Math.min(20, high.length * 3));
  const riskScore = Math.max(0, Math.min(100, riskRaw));
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - riskScore * 0.45 + unique * 1.2)));

  return {
    totalSightings: total,
    uniqueSpecies: unique,
    recentSightings: recent.length,
    highConfidenceSightings: high.length,
    avgConfidence,
    riskScore,
    healthScore,
    topSpecies,
    lastSeenAt: rows[0]?.captured_at || null,
  };
}

export function buildPredictiveAlerts(summary) {
  const alerts = [];
  if (summary.riskScore >= 82) {
    alerts.push({ level: "critical", message: "Escalating wildlife risk pattern detected in latest stream." });
  } else if (summary.riskScore >= 62) {
    alerts.push({ level: "elevated", message: "Risk trend elevated. Increase scan cadence and zone checks." });
  } else {
    alerts.push({ level: "info", message: "Wildlife activity stable. Monitoring remains active." });
  }

  if (summary.recentSightings >= 18) {
    alerts.push({ level: "elevated", message: "High event velocity in the last 10 minutes." });
  }

  if (summary.uniqueSpecies >= 7) {
    alerts.push({ level: "info", message: "Diverse species flow detected across monitored windows." });
  }

  return alerts;
}

export function exportIntelVault() {
  const rows = readObservations();
  const summary = computeIntelSummary(rows);
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    summary,
    observations: rows,
  };
}

export function importIntelVault(payload) {
  if (!payload || !Array.isArray(payload.observations)) {
    throw new Error("Invalid vault payload.");
  }
  writeObservations(payload.observations);
  return computeIntelSummary(readObservations());
}

export function clearIntelVault() {
  localStorage.removeItem(LOCAL_OBSERVATIONS_KEY);
}
