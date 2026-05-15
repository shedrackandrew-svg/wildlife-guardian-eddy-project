const searchInput = document.getElementById("inventorySearch");
const classInput = document.getElementById("inventoryClass");
const searchBtn = document.getElementById("inventorySearchBtn");
const meta = document.getElementById("inventoryMeta");
const grid = document.getElementById("inventoryGrid");
const syncClassName = document.getElementById("syncClassName");
const syncLimit = document.getElementById("syncLimit");
const syncOffset = document.getElementById("syncOffset");
const syncBtn = document.getElementById("syncSpeciesBtn");
const detailHint = document.getElementById("inventoryDetailHint");
const modal = document.getElementById("inventoryModal");
const modalTitle = document.getElementById("inventoryModalTitle");
const modalGallery = document.getElementById("inventoryModalGallery");
const modalInfo = document.getElementById("inventoryModalInfo");
const closeModalBtn = document.getElementById("closeInventoryModal");

let loading = false;
let lastRows = [];

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

function speciesSlug(speciesName) {
  return String(speciesName || "species")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "species";
}

function buildFolderThumbs(species) {
  const slug = speciesSlug(species.species_name);
  const label = encodeURIComponent(species.species_name);
  const images = [];
  for (let index = 1; index <= 20; index += 1) {
    images.push(`https://loremflickr.com/480/320/${label}?lock=${slug}-${index}`);
  }
  return images;
}

function openSpeciesFolder(species) {
  if (!modal || !modalTitle || !modalGallery || !modalInfo) return;
  const thumbs = buildFolderThumbs(species);
  modalTitle.textContent = species.species_name;
  modalGallery.innerHTML = thumbs
    .map(
      (url, index) => `
        <figure class="inventory-thumb-card">
          <img src="${url}" alt="${species.species_name} view ${index + 1}" loading="lazy" />
          <figcaption>Image ${index + 1}</figcaption>
        </figure>
      `,
    )
    .join("");
  modalInfo.innerHTML = `
    <div class="inventory-meta-list">
      <p><strong>Scientific:</strong> ${species.scientific_name}</p>
      <p><strong>Common:</strong> ${species.common_name || "Unknown"}</p>
      <p><strong>Class:</strong> ${species.taxonomy_class}</p>
      <p><strong>Order:</strong> ${species.taxonomy_order}</p>
      <p><strong>Family:</strong> ${species.family}</p>
      <p><strong>Kingdom:</strong> ${species.kingdom}</p>
      <p><strong>Phylum:</strong> ${species.phylum}</p>
      <p><strong>Status:</strong> ${species.conservation_status}</p>
      <p><strong>Habitats:</strong> ${(species.habitats || []).join(", ") || "Unknown"}</p>
      <p><strong>Regions:</strong> ${(species.regions || []).join(", ") || "Unknown"}</p>
      <p><strong>Details:</strong> ${species.details || "No details yet."}</p>
      <p><strong>Source:</strong> ${species.source}</p>
      <p><strong>Sightings:</strong> ${species.sightings}</p>
    </div>
  `;
  modal.hidden = false;
  detailHint.textContent = `${species.species_name} folder opened with 20 gallery slots.`;
}

function closeSpeciesFolder() {
  if (modal) {
    modal.hidden = true;
  }
}

function render(rows) {
  lastRows = Array.isArray(rows) ? rows : [];
  if (!Array.isArray(rows) || !rows.length) {
    grid.innerHTML = "<p class='tiny-note'>No species in inventory yet. Use Sync Class To DB or run detections.</p>";
    return;
  }

  grid.innerHTML = rows
    .map((row) => {
      const habitats = (row.habitats || []).join(", ") || "Unknown";
      const regions = (row.regions || []).join(", ") || "Unknown";
      return `
        <article class="gallery-card species-folder-card" data-species="${row.species_name}">
          <div class="species-folder-hero">
            ${buildImage(row)}
            <span class="species-folder-count">20 images</span>
          </div>
          <div class="species-folder-body">
            <h4>${row.species_name}</h4>
            <p><strong>Scientific:</strong> ${row.scientific_name}</p>
            <p><strong>Class:</strong> ${row.taxonomy_class}</p>
            <p><strong>Family:</strong> ${row.family}</p>
            <p><strong>Status:</strong> ${row.conservation_status}</p>
            <p><strong>Habitats:</strong> ${habitats}</p>
            <p><strong>Regions:</strong> ${regions}</p>
            <button type="button" class="folder-open-btn" data-open-folder="${row.species_name}">Open Folder</button>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll("[data-open-folder]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.getAttribute("data-open-folder");
      const selected = lastRows.find((row) => row.species_name === name);
      if (selected) openSpeciesFolder(selected);
    });
  });
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

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", closeSpeciesFolder);
}

if (modal) {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeSpeciesFolder();
  });
}

loadSpecies().catch(() => {});
