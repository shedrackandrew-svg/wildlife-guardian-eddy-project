const searchInput = document.getElementById("librarySearch");
const groupSelect = document.getElementById("libraryGroup");
const searchBtn = document.getElementById("librarySearchBtn");
const seedBtn = document.getElementById("librarySeedBtn");
const syncMammalsBtn = document.getElementById("librarySyncMammalsBtn");
const syncBirdsBtn = document.getElementById("librarySyncBirdsBtn");
const syncInsectsBtn = document.getElementById("librarySyncInsectsBtn");
const libraryMeta = document.getElementById("libraryMeta");
const libraryGrid = document.getElementById("libraryGrid");
const libraryDetail = document.getElementById("libraryDetail");

let currentRows = [];

const FOUNDATION_LIBRARY = [
  { species_name: "lion", scientific_name: "Panthera leo", common_name: "Lion", taxonomy_class: "Mammalia", family: "Felidae", conservation_status: "Vulnerable", habitats: ["Savanna"], regions: ["Africa"], details: "Apex social predator.", image_url: "https://upload.wikimedia.org/wikipedia/commons/7/73/Lion_waiting_in_Namibia.jpg", source: "foundation", sightings: 0 },
  { species_name: "bald eagle", scientific_name: "Haliaeetus leucocephalus", common_name: "Bald Eagle", taxonomy_class: "Aves", family: "Accipitridae", conservation_status: "Least Concern", habitats: ["Rivers", "Coasts"], regions: ["North America"], details: "Large fish-hunting raptor.", image_url: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Bald_Eagle_Portrait.jpg", source: "foundation", sightings: 0 },
  { species_name: "komodo dragon", scientific_name: "Varanus komodoensis", common_name: "Komodo Dragon", taxonomy_class: "Reptilia", family: "Varanidae", conservation_status: "Endangered", habitats: ["Dry forest"], regions: ["Indonesia"], details: "Largest extant lizard.", image_url: "https://upload.wikimedia.org/wikipedia/commons/9/99/Komodo_dragon_with_tongue.jpg", source: "foundation", sightings: 0 },
  { species_name: "axolotl", scientific_name: "Ambystoma mexicanum", common_name: "Axolotl", taxonomy_class: "Amphibia", family: "Ambystomatidae", conservation_status: "Critically Endangered", habitats: ["Freshwater"], regions: ["Mexico"], details: "Regeneration model amphibian.", image_url: "https://upload.wikimedia.org/wikipedia/commons/6/63/Ambystoma_mexicanum_1.jpg", source: "foundation", sightings: 0 },
  { species_name: "monarch butterfly", scientific_name: "Danaus plexippus", common_name: "Monarch Butterfly", taxonomy_class: "Insecta", family: "Nymphalidae", conservation_status: "Endangered", habitats: ["Meadows"], regions: ["North America"], details: "Long-distance migratory insect.", image_url: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Danaus_plexippus_Male_Dorsal.jpg", source: "foundation", sightings: 0 },
  { species_name: "jumping spider", scientific_name: "Salticidae", common_name: "Jumping Spider", taxonomy_class: "Arachnida", family: "Salticidae", conservation_status: "Not evaluated", habitats: ["Forests", "Urban edge"], regions: ["Worldwide"], details: "Visually guided predatory spider.", image_url: "https://upload.wikimedia.org/wikipedia/commons/3/30/Marpissa_muscosa_-_side.jpg", source: "foundation", sightings: 0 },
  { species_name: "atlantic salmon", scientific_name: "Salmo salar", common_name: "Atlantic Salmon", taxonomy_class: "Actinopterygii", family: "Salmonidae", conservation_status: "Least Concern", habitats: ["Rivers", "Ocean"], regions: ["North Atlantic"], details: "Anadromous migratory fish.", image_url: "https://upload.wikimedia.org/wikipedia/commons/3/31/Salmo_salar.jpg", source: "foundation", sightings: 0 },
  { species_name: "amanita muscaria", scientific_name: "Amanita muscaria", common_name: "Fly Agaric", taxonomy_class: "Agaricomycetes", family: "Amanitaceae", conservation_status: "Not evaluated", habitats: ["Temperate forest"], regions: ["Northern Hemisphere"], details: "Iconic mushroom species.", image_url: "https://upload.wikimedia.org/wikipedia/commons/3/32/Amanita_muscaria_3_vliegenzwammen_op_rij.jpg", source: "foundation", sightings: 0 },
  { species_name: "escherichia coli", scientific_name: "Escherichia coli", common_name: "E. coli", taxonomy_class: "Gammaproteobacteria", family: "Enterobacteriaceae", conservation_status: "Not evaluated", habitats: ["Gut", "Water"], regions: ["Worldwide"], details: "Model bacterium used in genetics and molecular biology.", image_url: "", source: "foundation", sightings: 0 },
  { species_name: "sars-cov-2", scientific_name: "Severe acute respiratory syndrome coronavirus 2", common_name: "SARS-CoV-2", taxonomy_class: "Pisoniviricetes", family: "Coronaviridae", conservation_status: "Not applicable", habitats: ["Host-associated"], regions: ["Worldwide"], details: "Coronavirus with global public health impact.", image_url: "", source: "foundation", sightings: 0 },
];

function hasConfiguredBackend() {
  if (!window.location.hostname.endsWith("github.io")) return true;
  return Boolean(String(window.WG_API_BASE || "").trim());
}

function speak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);
}

function normalizeRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    habitats: Array.isArray(row.habitats) ? row.habitats : [],
    regions: Array.isArray(row.regions) ? row.regions : [],
  }));
}

function filterRows(rows) {
  const q = (searchInput.value || "").trim().toLowerCase();
  const group = (groupSelect.value || "").trim().toLowerCase();

  return rows.filter((row) => {
    const bag = [
      row.species_name,
      row.scientific_name,
      row.common_name,
      row.family,
      row.taxonomy_class,
      row.details,
      ...(row.habitats || []),
      ...(row.regions || []),
    ]
      .join(" ")
      .toLowerCase();

    if (q && !bag.includes(q)) return false;
    if (group && String(row.taxonomy_class || "").toLowerCase() !== group) return false;
    return true;
  });
}

function renderDetail(row) {
  const habitats = (row.habitats || []).join(", ") || "Unknown";
  const regions = (row.regions || []).join(", ") || "Unknown";
  libraryDetail.innerHTML = `
    <h3>${row.species_name}</h3>
    <p><strong>Scientific:</strong> ${row.scientific_name || "Unknown"}</p>
    <p><strong>Common:</strong> ${row.common_name || "Unknown"}</p>
    <p><strong>Class:</strong> ${row.taxonomy_class || "Unknown"}</p>
    <p><strong>Family:</strong> ${row.family || "Unknown"}</p>
    <p><strong>Status:</strong> ${row.conservation_status || "Not evaluated"}</p>
    <p><strong>Habitats:</strong> ${habitats}</p>
    <p><strong>Regions:</strong> ${regions}</p>
    <p><strong>Sightings:</strong> ${row.sightings || 0}</p>
    <p><strong>Details:</strong> ${row.details || "No details."}</p>
    <div class="actions">
      <button type="button" id="speakSelected">Speak Details</button>
    </div>
  `;

  const speakBtn = document.getElementById("speakSelected");
  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      speak(`${row.common_name || row.species_name}. Class ${row.taxonomy_class || "unknown"}. ${row.details || "No details available."}`);
    });
  }
}

function renderCards(rows) {
  if (!rows.length) {
    libraryGrid.innerHTML = "<p class='tiny-note'>No matching records found.</p>";
    return;
  }

  libraryGrid.innerHTML = rows
    .map((row, idx) => {
      const image = row.image_url
        ? `<img src="${row.image_url}" alt="${row.species_name}" />`
        : `<div class="gallery-fallback">${row.species_name}</div>`;
      return `
        <article class="gallery-card species-card" data-index="${idx}">
          ${image}
          <h4>${row.species_name}</h4>
          <p><strong>Scientific:</strong> ${row.scientific_name || "Unknown"}</p>
          <p><strong>Class:</strong> ${row.taxonomy_class || "Unknown"}</p>
          <p><strong>Status:</strong> ${row.conservation_status || "Not evaluated"}</p>
          <p><strong>Source:</strong> ${row.source || "local"}</p>
          <div class="actions">
            <button type="button" class="open-detail" data-index="${idx}">Open Details</button>
            <button type="button" class="speak-card" data-index="${idx}">Speak</button>
          </div>
        </article>
      `;
    })
    .join("");

  const detailButtons = Array.from(document.querySelectorAll(".open-detail"));
  for (const btn of detailButtons) {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-index"));
      renderDetail(rows[idx]);
    });
  }

  const speakButtons = Array.from(document.querySelectorAll(".speak-card"));
  for (const btn of speakButtons) {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-index"));
      const row = rows[idx];
      speak(`${row.species_name}. ${row.taxonomy_class || "Unknown class"}. ${row.details || "No details available."}`);
    });
  }
}

async function fetchCatalogRows() {
  if (!hasConfiguredBackend()) {
    return FOUNDATION_LIBRARY;
  }

  const params = new URLSearchParams({ limit: "1500", offset: "0" });
  const q = (searchInput.value || "").trim();
  const group = (groupSelect.value || "").trim();
  if (q) params.set("search", q);
  if (group) params.set("tax_class", group);

  const response = await fetch(`/api/species-catalog?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Catalog fetch failed (${response.status})`);
  }

  const rows = await response.json();
  return Array.isArray(rows) && rows.length ? rows : FOUNDATION_LIBRARY;
}

async function refreshLibrary() {
  try {
    const rows = normalizeRows(await fetchCatalogRows());
    currentRows = filterRows(rows);
    libraryMeta.textContent = `Interactive library loaded: ${currentRows.length} records.`;
    renderCards(currentRows);
    if (currentRows[0]) {
      renderDetail(currentRows[0]);
    }
  } catch (err) {
    libraryMeta.textContent = err.message;
    currentRows = filterRows(FOUNDATION_LIBRARY);
    renderCards(currentRows);
    if (currentRows[0]) renderDetail(currentRows[0]);
  }
}

async function seedFoundation() {
  if (!hasConfiguredBackend()) {
    libraryMeta.textContent = "Backend not configured. Foundation records are visible in local interactive mode.";
    currentRows = filterRows(FOUNDATION_LIBRARY);
    renderCards(currentRows);
    if (currentRows[0]) renderDetail(currentRows[0]);
    return;
  }

  libraryMeta.textContent = "Seeding foundation species dataset...";
  const res = await fetch("/api/species-catalog/seed-foundation", { method: "POST" });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.detail || `Foundation seed failed (${res.status})`);
  }
  const out = await res.json();
  libraryMeta.textContent = `Foundation seed complete. Imported ${out.imported}, updated ${out.updated}, total ${out.total_catalog_size}.`;
  await refreshLibrary();
}

async function syncClass(className) {
  if (!hasConfiguredBackend()) {
    libraryMeta.textContent = "Backend not configured for cloud sync. Showing local interactive catalog.";
    return;
  }
  libraryMeta.textContent = `Syncing ${className}...`;
  const params = new URLSearchParams({ class_name: className, limit: "400", offset: "0" });
  const res = await fetch(`/api/species-catalog/sync?${params.toString()}`, { method: "POST" });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.detail || `Sync failed (${res.status})`);
  }
  const out = await res.json();
  libraryMeta.textContent = `${className} sync complete. Imported ${out.imported}, updated ${out.updated}, total ${out.total_catalog_size}.`;
  await refreshLibrary();
}

searchBtn.addEventListener("click", () => {
  refreshLibrary().catch((err) => {
    libraryMeta.textContent = err.message;
  });
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    refreshLibrary().catch((err) => {
      libraryMeta.textContent = err.message;
    });
  }
});

groupSelect.addEventListener("change", () => {
  refreshLibrary().catch((err) => {
    libraryMeta.textContent = err.message;
  });
});

seedBtn.addEventListener("click", () => {
  seedFoundation().catch((err) => {
    libraryMeta.textContent = err.message;
  });
});

syncMammalsBtn.addEventListener("click", () => {
  syncClass("Mammalia").catch((err) => {
    libraryMeta.textContent = err.message;
  });
});

syncBirdsBtn.addEventListener("click", () => {
  syncClass("Aves").catch((err) => {
    libraryMeta.textContent = err.message;
  });
});

syncInsectsBtn.addEventListener("click", () => {
  syncClass("Insecta").catch((err) => {
    libraryMeta.textContent = err.message;
  });
});

refreshLibrary().catch((err) => {
  libraryMeta.textContent = err.message;
});
