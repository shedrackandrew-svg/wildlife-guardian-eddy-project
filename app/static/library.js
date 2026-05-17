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
const pageMode = (document.body.dataset.pageMode || "animals").toLowerCase();
const catalogUrl = "/static/wildlife-catalog.json";
const plantClasses = new Set(["plantae", "magnoliopsida", "liliopsida", "coniferophyta", "bryophyta", "pteridophyta"]);

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
    gallery_images: Array.isArray(row.gallery_images) ? row.gallery_images.filter(Boolean) : [],
  }));
}

function pageLabel() {
  return pageMode === "plants" ? "plant" : "species";
}

function choosePalette(row) {
  const className = String(row.taxonomy_class || "").toLowerCase();
  if (pageMode === "plants") {
    return ["#dff5e3", "#9ed9ad", "#4fa86e", "#1e5f38"];
  }
  if (className.includes("aqua") || className.includes("fish")) {
    return ["#dff7fb", "#9cdce8", "#4fa8c8", "#1d5f7f"];
  }
  if (className.includes("aves") || className.includes("insect") || className.includes("arachn")) {
    return ["#f8f1dd", "#e7c97a", "#c38f2f", "#7b4f12"];
  }
  return ["#edf7e8", "#bbdfb7", "#5da86a", "#245335"];
}

function svgDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildLocalSlides(row) {
  const title = String(row.common_name || row.species_name || "Wildlife");
  const subtitle = String((row.habitats || ["natural habitat"])[0] || "natural habitat");
  const [bg1, bg2, bg3, accent] = choosePalette(row);
  const baseText = `${title} • ${subtitle}`;
  const createSlide = (label, motif) => svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg1}" />
          <stop offset="50%" stop-color="${bg2}" />
          <stop offset="100%" stop-color="${bg3}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="34%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)" />
      <ellipse cx="600" cy="300" rx="420" ry="240" fill="url(#glow)" />
      <circle cx="960" cy="150" r="80" fill="#ffffff" fill-opacity="0.26" />
      <circle cx="180" cy="160" r="58" fill="#ffffff" fill-opacity="0.16" />
      <path d="M0 610 C 180 520, 330 570, 470 540 S 780 520, 1200 610 L1200 800 L0 800 Z" fill="#ffffff" fill-opacity="0.24" />
      <path d="M0 680 C 220 620, 410 710, 600 660 S 990 610, 1200 700 L1200 800 L0 800 Z" fill="#ffffff" fill-opacity="0.16" />
      <g transform="translate(135 120) scale(0.92)">
        ${motif}
      </g>
      <g fill="#102017" fill-opacity="0.12">
        <circle cx="220" cy="550" r="14" />
        <circle cx="280" cy="585" r="10" />
        <circle cx="955" cy="560" r="12" />
        <circle cx="1025" cy="606" r="8" />
      </g>
      <g font-family="Manrope, Arial, sans-serif" text-anchor="middle">
        <text x="600" y="82" font-size="34" font-weight="700" fill="#14311f">${title}</text>
        <text x="600" y="122" font-size="20" fill="#234532">${label}</text>
        <text x="600" y="742" font-size="24" fill="#173723">${baseText}</text>
      </g>
    </svg>
  `);

  const animalMotif = `
    <ellipse cx="610" cy="430" rx="180" ry="110" fill="#1f2c24" fill-opacity="0.26" />
    <circle cx="760" cy="350" r="42" fill="#1f2c24" fill-opacity="0.28" />
    <circle cx="785" cy="335" r="10" fill="#ffffff" fill-opacity="0.42" />
    <path d="M430 430 Q 330 360 250 430" fill="none" stroke="#1f2c24" stroke-width="22" stroke-linecap="round" stroke-opacity="0.24" />
    <path d="M520 520 Q 470 620 380 660" fill="none" stroke="#1f2c24" stroke-width="18" stroke-linecap="round" stroke-opacity="0.2" />
    <path d="M675 520 Q 730 620 820 656" fill="none" stroke="#1f2c24" stroke-width="18" stroke-linecap="round" stroke-opacity="0.2" />
  `;

  const habitatMotif = `
    <path d="M250 520 C 320 390, 420 335, 520 360 C 610 384, 680 470, 760 420 C 830 376, 930 320, 980 250" fill="none" stroke="#ffffff" stroke-width="24" stroke-opacity="0.34" stroke-linecap="round" />
    <path d="M280 530 C 370 430, 500 430, 600 510 C 680 575, 820 620, 965 560" fill="none" stroke="#ffffff" stroke-width="28" stroke-opacity="0.18" stroke-linecap="round" />
  `;

  const plantMotif = `
    <path d="M600 560 C 600 460, 590 360, 600 250" stroke="#245335" stroke-width="22" stroke-linecap="round" fill="none" />
    <path d="M600 390 C 510 350, 440 290, 410 220 C 485 225, 555 270, 600 340" fill="#3b8f54" fill-opacity="0.45" />
    <path d="M600 360 C 700 320, 780 250, 820 170 C 740 175, 670 220, 600 310" fill="#4fa86e" fill-opacity="0.42" />
    <path d="M600 470 C 510 455, 430 420, 365 350 C 440 338, 525 380, 600 440" fill="#57b56f" fill-opacity="0.38" />
    <circle cx="600" cy="248" r="46" fill="#d7f2dc" fill-opacity="0.88" />
  `;

  const chosenMotif = pageMode === "plants" ? plantMotif : animalMotif;
  return [
    createSlide("Field portrait", chosenMotif),
    createSlide("Habitat frame", habitatMotif),
    createSlide("Profile view", chosenMotif),
  ];
}

function matchesPageMode(row) {
  if (pageMode !== "plants") {
    return !plantClasses.has(String(row.taxonomy_class || "").toLowerCase()) || String(row.kind || "").toLowerCase() === "animal";
  }
  return plantClasses.has(String(row.taxonomy_class || "").toLowerCase()) || String(row.kind || "").toLowerCase() === "plant";
}

function buildGalleryImages(row) {
  const localSlides = buildLocalSlides(row);
  return localSlides;
}

function filterRows(rows) {
  const q = (searchInput.value || "").trim().toLowerCase();
  const group = (groupSelect.value || "").trim().toLowerCase();

  return rows.filter((row) => {
    if (!matchesPageMode(row)) return false;
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
  const gallery = buildGalleryImages(row);
  const activeImage = gallery[0] || row.image_url || "";
  const historicalNote = row.historical_note || `${row.common_name || row.species_name} is documented in the catalog as a ${pageLabel()} of conservation interest.`;
  const biologicalNote = row.biological_note || row.details || `Biological notes for ${row.common_name || row.species_name} can be expanded from the catalog JSON.`;

  libraryDetail.innerHTML = `
    <div class="detail-view">
      <section class="detail-gallery">
        ${activeImage ? `<img class="detail-gallery-main" id="detailGalleryMain" src="${activeImage}" alt="${row.species_name}" />` : `<div class="detail-gallery-main gallery-fallback">${row.species_name}</div>`}
        <div class="detail-thumbs" id="detailThumbs">
          ${gallery
            .map((image, index) => `<button type="button" class="detail-thumb" data-image-index="${index}"><img src="${image}" alt="${row.species_name} view ${index + 1}" /></button>`)
            .join("")}
        </div>
      </section>
      <aside class="detail-side">
        <h3>${row.common_name || row.species_name}</h3>
        <p><strong>Scientific:</strong> ${row.scientific_name || "Unknown"}</p>
        <p><strong>Class:</strong> ${row.taxonomy_class || "Unknown"}</p>
        <p><strong>Family:</strong> ${row.family || "Unknown"}</p>
        <p><strong>Status:</strong> ${row.conservation_status || "Not evaluated"}</p>
        <p><strong>Habitats:</strong> ${habitats}</p>
        <p><strong>Regions:</strong> ${regions}</p>
        <p><strong>Historical:</strong> ${historicalNote}</p>
        <p><strong>Biological:</strong> ${biologicalNote}</p>
        <p><strong>Sightings:</strong> ${row.sightings || 0}</p>
        <div class="actions">
          <button type="button" id="speakSelected">Speak Details</button>
        </div>
      </aside>
    </div>
  `;

  const detailMain = document.getElementById("detailGalleryMain");
  const thumbs = Array.from(document.querySelectorAll(".detail-thumb"));
  for (const thumb of thumbs) {
    thumb.addEventListener("click", () => {
      const index = Number(thumb.getAttribute("data-image-index"));
      const next = gallery[index];
      if (detailMain && next) {
        detailMain.src = next;
      }
    });
  }

  const speakBtn = document.getElementById("speakSelected");
  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      speak(`${row.common_name || row.species_name}. Class ${row.taxonomy_class || "unknown"}. ${row.details || row.biological_note || "No details available."}`);
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
      const gallery = buildGalleryImages(row);
      const imageSource = gallery[0] || row.image_url || "";
      const image = imageSource ? `<img src="${imageSource}" alt="${row.species_name}" />` : `<div class="gallery-fallback">${row.species_name}</div>`;
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
  try {
    const staticResponse = await fetch(catalogUrl, { cache: "no-store" });
    if (staticResponse.ok) {
      const staticRows = await staticResponse.json();
      if (Array.isArray(staticRows) && staticRows.length) {
        return staticRows;
      }
    }
  } catch {
    // Fall back to the embedded catalog.
  }

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
    libraryMeta.textContent = `Interactive ${pageLabel()} catalog loaded: ${currentRows.length} records.`;
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
    libraryMeta.textContent = `Backend not configured. Foundation ${pageLabel()} records are visible in local interactive mode.`;
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
