const mapLegend = document.getElementById("mapLegend");
const zoneGrid = document.getElementById("zoneGrid");
const selectedSpecies = document.getElementById("selectedSpecies");
const worldMap = document.getElementById("worldMap");

let leafletMap;
let radarLayer;
let zones = [];

function getGlobalSettings() {
  try {
    const raw = localStorage.getItem("wg_global_settings");
    if (!raw) return { mapAutoFocus: true, mapRadarIntensity: "medium" };
    const parsed = JSON.parse(raw);
    return {
      mapAutoFocus: parsed.mapAutoFocus !== false,
      mapRadarIntensity: parsed.mapRadarIntensity || "medium",
    };
  } catch {
    return { mapAutoFocus: true, mapRadarIntensity: "medium" };
  }
}

function formatLatLng(lat, lng) {
  if (lat === null || lng === null || lat === undefined || lng === undefined) {
    return "Coordinates not assigned";
  }
  return `${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)}`;
}

function speciesFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("species") || "").trim().toLowerCase();
}

function initMap() {
  if (!worldMap) return;
  leafletMap = L.map(worldMap, { worldCopyJump: true, zoomControl: true }).setView([14, 15], 2);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 8,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(leafletMap);
  radarLayer = L.layerGroup().addTo(leafletMap);
}

function clearRadar() {
  if (!radarLayer) return;
  radarLayer.clearLayers();
}

function radarIcon() {
  return L.divIcon({
    className: "radar-icon-wrap",
    html: '<div class="radar-ping"></div><div class="radar-core"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function markerPopup(row, point) {
  return `
    <div class="map-popup">
      <h4>${row.species_name}</h4>
      <p><strong>Region:</strong> ${point.region || row.zone || "Unknown"}</p>
      <p><strong>Class/Order:</strong> ${row.taxonomy_class || "Unknown"} / ${row.taxonomy_order || "Unknown"}</p>
      <p><strong>Conservation:</strong> ${row.conservation_status || "Not evaluated"}</p>
      <p><strong>Sightings:</strong> ${row.sightings ?? 0}</p>
      <p><strong>Coordinates:</strong> ${formatLatLng(point.lat, point.lng)}</p>
    </div>
  `;
}

function focusSpecies(row) {
  if (!leafletMap || !row) return;

  clearRadar();
  const points = Array.isArray(row.geo_points) && row.geo_points.length ? row.geo_points : [{ region: row.zone, lat: row.lat, lng: row.lng }];

  const validPoints = points.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");

  if (!validPoints.length) {
    selectedSpecies.textContent = `${row.species_name}: no mapped coordinates yet.`;
    return;
  }

  selectedSpecies.innerHTML = `
    <h3>${row.species_name}</h3>
    <p><strong>Scientific:</strong> ${row.scientific_name || "Unknown"}</p>
    <p><strong>Classification:</strong> ${row.taxonomy_class || "Unknown"} • ${row.taxonomy_order || "Unknown"}</p>
    <p><strong>Conservation:</strong> ${row.conservation_status || "Not evaluated"}</p>
    <p><strong>Regions:</strong> ${(row.regions || []).join(", ") || "Unknown"}</p>
  `;

  const latLngs = [];
  for (const point of validPoints) {
    latLngs.push([point.lat, point.lng]);

    L.marker([point.lat, point.lng], { icon: radarIcon() })
      .addTo(radarLayer)
      .bindPopup(markerPopup(row, point));

    const gs = getGlobalSettings();
    const radiusByIntensity = {
      soft: 180000,
      medium: 320000,
      high: 450000,
    };
    L.circle([point.lat, point.lng], {
      radius: radiusByIntensity[gs.mapRadarIntensity] || 320000,
      color: "#3fe58d",
      weight: 1,
      fillColor: "#2bd979",
      fillOpacity: 0.14,
    }).addTo(radarLayer);
  }

  const gs = getGlobalSettings();
  if (!gs.mapAutoFocus) {
    return;
  }

  if (latLngs.length === 1) {
    leafletMap.setView(latLngs[0], 4);
  } else {
    leafletMap.fitBounds(latLngs, { padding: [35, 35] });
  }
}

function cardHtml(row) {
  const img = row.image_url
    ? `<img src="${row.image_url}" alt="${row.species_name}" class="species-card-image" />`
    : `<div class="species-card-image fallback">${row.species_name}</div>`;

  return `
    <article class="gallery-card species-card" data-species="${row.species_name.toLowerCase()}">
      ${img}
      <h4>${row.species_name}</h4>
      <p><strong>Class:</strong> ${row.taxonomy_class || "Unknown"}</p>
      <p><strong>Order:</strong> ${row.taxonomy_order || "Unknown"}</p>
      <p><strong>Zone:</strong> ${row.zone || "Unknown"}</p>
      <p><strong>Sightings:</strong> ${row.sightings ?? 0}</p>
      <p><strong>Coordinates:</strong> ${formatLatLng(row.lat, row.lng)}</p>
      <button class="map-focus-btn" type="button" data-focus="${row.species_name.toLowerCase()}">Focus On Map</button>
    </article>
  `;
}

function renderZones(rows) {
  zones = rows;
  mapLegend.textContent = `Map loaded for ${rows.length} species. Click any species card to show live radar habitat points.`;

  zoneGrid.innerHTML = rows.length
    ? rows.slice(0, 400).map((row) => cardHtml(row)).join("")
    : "<p class='tiny-note'>No zone data available.</p>";

  const requested = speciesFromQuery();
  const initial = (requested && rows.find((r) => r.species_name.toLowerCase() === requested)) || rows[0] || null;
  if (initial) focusSpecies(initial);

  zoneGrid.querySelectorAll("[data-focus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-focus") || "";
      const row = zones.find((z) => z.species_name.toLowerCase() === key);
      if (row) {
        focusSpecies(row);
        const url = new URL(window.location.href);
        url.searchParams.set("species", row.species_name.toLowerCase());
        window.history.replaceState({}, "", url.toString());
      }
    });
  });
}

async function loadZones() {
  const res = await fetch("/api/wildlife/zones?limit=1500");
  if (!res.ok) throw new Error("Failed to load habitat zones.");
  return res.json();
}

initMap();
loadZones()
  .then((rows) => renderZones(rows))
  .catch((err) => {
    mapLegend.textContent = err.message;
    selectedSpecies.textContent = "Map loading failed.";
  });
