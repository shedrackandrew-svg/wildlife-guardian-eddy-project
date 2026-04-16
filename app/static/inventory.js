const searchInput = document.getElementById("inventorySearch");
const classInput = document.getElementById("inventoryClass");
const searchBtn = document.getElementById("inventorySearchBtn");
const meta = document.getElementById("inventoryMeta");
const grid = document.getElementById("inventoryGrid");
const syncClassName = document.getElementById("syncClassName");
const syncLimit = document.getElementById("syncLimit");
const syncOffset = document.getElementById("syncOffset");
const syncBtn = document.getElementById("syncSpeciesBtn");

let loading = false;

function hasConfiguredBackend() {
  if (!window.location.hostname.endsWith("github.io")) return true;
  return Boolean(String(window.WG_API_BASE || "").trim());
}

function buildImage(species) {
  if (species.image_url) {
    return `<img src="${species.image_url}" alt="${species.species_name}" />`;
  }
  return `<div class="gallery-fallback">${species.species_name}</div>`;
}

function render(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    grid.innerHTML = "<p class='tiny-note'>No species in inventory yet. Use Sync Class To DB or run detections.</p>";
    return;
  }

  grid.innerHTML = rows
    .map((row) => {
      const habitats = (row.habitats || []).join(", ") || "Unknown";
      const regions = (row.regions || []).join(", ") || "Unknown";
      return `
        <article class="gallery-card species-card">
          ${buildImage(row)}
          <h4>${row.species_name}</h4>
          <p><strong>Scientific:</strong> ${row.scientific_name}</p>
          <p><strong>Common:</strong> ${row.common_name || "Unknown"}</p>
          <p><strong>Class:</strong> ${row.taxonomy_class}</p>
          <p><strong>Order:</strong> ${row.taxonomy_order}</p>
          <p><strong>Family:</strong> ${row.family}</p>
          <p><strong>Status:</strong> ${row.conservation_status}</p>
          <p><strong>Habitats:</strong> ${habitats}</p>
          <p><strong>Regions:</strong> ${regions}</p>
          <p><strong>Sightings:</strong> ${row.sightings}</p>
          <p><strong>Source:</strong> ${row.source}</p>
          <p><strong>Details:</strong> ${row.details || "No details yet."}</p>
        </article>
      `;
    })
    .join("");
}

async function loadSpecies() {
  if (loading) return;
  loading = true;
  try {
    if (!hasConfiguredBackend()) {
      meta.textContent = "Backend API not configured. Set wg_api_base first, then refresh.";
      render([]);
      return;
    }

    const q = searchInput.value.trim();
    const className = classInput.value.trim();
    const params = new URLSearchParams({ limit: "1200", offset: "0" });
    if (q) params.set("search", q);
    if (className) params.set("tax_class", className);

    const res = await fetch(`/api/species-catalog?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Inventory load failed (${res.status})`);
    }

    const rows = await res.json();
    meta.textContent = `Global species rows: ${rows.length}`;
    render(rows);
  } catch (err) {
    meta.textContent = err.message;
    render([]);
  } finally {
    loading = false;
  }
}

async function syncSpeciesClass() {
  if (!hasConfiguredBackend()) {
    meta.textContent = "Cannot sync without backend API.";
    return;
  }

  const className = (syncClassName.value || "Mammalia").trim();
  const limit = Math.max(1, Math.min(1200, Number(syncLimit.value || 300)));
  const offset = Math.max(0, Number(syncOffset.value || 0));
  meta.textContent = `Syncing ${className} species...`;

  const params = new URLSearchParams({
    class_name: className,
    limit: String(limit),
    offset: String(offset),
  });

  try {
    const res = await fetch(`/api/species-catalog/sync?${params.toString()}`, { method: "POST" });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.detail || `Sync failed (${res.status})`);
    }
    const out = await res.json();
    meta.textContent = `Synced class ${out.class_name}: imported ${out.imported}, updated ${out.updated}, total ${out.total_catalog_size}.`;
    await loadSpecies();
  } catch (err) {
    meta.textContent = err.message;
  }
}

searchBtn.addEventListener("click", () => {
  loadSpecies().catch(() => {});
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadSpecies().catch(() => {});
});

classInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") loadSpecies().catch(() => {});
});

syncBtn.addEventListener("click", () => {
  syncSpeciesClass().catch(() => {});
});

loadSpecies().catch(() => {});
