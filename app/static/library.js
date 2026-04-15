const searchInput = document.getElementById("librarySearch");
const searchBtn = document.getElementById("librarySearchBtn");
const libraryMeta = document.getElementById("libraryMeta");
const libraryGrid = document.getElementById("libraryGrid");

const DEMO_LIBRARY = [
  { species_name: "lion", scientific_name: "Panthera leo", family: "Felidae", conservation_status: "Vulnerable", habitats: ["Savanna"], regions: ["Africa"], diet: "Carnivore", average_lifespan_years: 14, safety_notes: "Keep distance in open range.", image_urls: [] },
  { species_name: "tiger", scientific_name: "Panthera tigris", family: "Felidae", conservation_status: "Endangered", habitats: ["Forest"], regions: ["South Asia"], diet: "Carnivore", average_lifespan_years: 15, safety_notes: "Avoid close approach in dense vegetation.", image_urls: [] },
  { species_name: "elephant", scientific_name: "Loxodonta africana", family: "Elephantidae", conservation_status: "Endangered", habitats: ["Grassland"], regions: ["Africa"], diet: "Herbivore", average_lifespan_years: 60, safety_notes: "Observe from sheltered distance.", image_urls: [] },
  { species_name: "zebra", scientific_name: "Equus quagga", family: "Equidae", conservation_status: "Near Threatened", habitats: ["Savanna"], regions: ["Africa"], diet: "Herbivore", average_lifespan_years: 25, safety_notes: "Approach calmly and slowly.", image_urls: [] },
  { species_name: "giraffe", scientific_name: "Giraffa camelopardalis", family: "Giraffidae", conservation_status: "Vulnerable", habitats: ["Savanna"], regions: ["Africa"], diet: "Herbivore", average_lifespan_years: 26, safety_notes: "Do not approach calves or herd center.", image_urls: [] },
  { species_name: "bear", scientific_name: "Ursus arctos", family: "Ursidae", conservation_status: "Least Concern", habitats: ["Forest"], regions: ["North America"], diet: "Omnivore", average_lifespan_years: 22, safety_notes: "Stay downwind and keep exits clear.", image_urls: [] },
  { species_name: "wolf", scientific_name: "Canis lupus", family: "Canidae", conservation_status: "Least Concern", habitats: ["Taiga"], regions: ["Europe"], diet: "Carnivore", average_lifespan_years: 13, safety_notes: "Do not block movement corridor.", image_urls: [] },
  { species_name: "deer", scientific_name: "Cervus elaphus", family: "Cervidae", conservation_status: "Least Concern", habitats: ["Woodland"], regions: ["Europe"], diet: "Herbivore", average_lifespan_years: 18, safety_notes: "Avoid sudden noise near herd.", image_urls: [] },
];

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

function localSpeciesRows() {
  const names = new Set(readLocalObservations().map((r) => String(r.species || "").toLowerCase()).filter(Boolean));
  if (!names.size) return DEMO_LIBRARY;

  const out = [];
  for (const species of names) {
    const found = DEMO_LIBRARY.find((d) => d.species_name === species);
    if (found) {
      out.push(found);
    } else {
      out.push({
        species_name: species,
        scientific_name: "Unknown",
        family: "Unknown",
        conservation_status: "Not evaluated",
        habitats: ["Unknown"],
        regions: ["Unknown"],
        diet: "Unknown",
        average_lifespan_years: "Unknown",
        safety_notes: "Observe carefully and keep safe distance.",
        image_urls: [],
      });
    }
  }
  return out;
}

function filterRows(rows, search) {
  if (!search) return rows;
  const q = search.toLowerCase();
  return rows.filter((row) => {
    const text = [
      row.species_name,
      row.scientific_name,
      row.family,
      ...(row.habitats || []),
      ...(row.regions || []),
    ]
      .join(" ")
      .toLowerCase();
    return text.includes(q);
  });
}

function renderCards(rows) {
  libraryGrid.innerHTML = rows.length
    ? rows
        .map((row) => {
          const img = row.image_urls?.[0]
            ? `<img src="${row.image_urls[0]}" alt="${row.species_name}" />`
            : `<div class="gallery-fallback">${row.species_name}</div>`;
          return `
            <article class="gallery-card species-card">
              ${img}
              <h4>${row.species_name}</h4>
              <p><strong>Scientific:</strong> ${row.scientific_name}</p>
              <p><strong>Family:</strong> ${row.family}</p>
              <p><strong>Status:</strong> ${row.conservation_status}</p>
              <p><strong>Habitats:</strong> ${(row.habitats || []).join(", ") || "Unknown"}</p>
              <p><strong>Regions:</strong> ${(row.regions || []).join(", ") || "Unknown"}</p>
              <p><strong>Diet:</strong> ${row.diet}</p>
              <p><strong>Lifespan:</strong> ${row.average_lifespan_years}</p>
              <p><strong>Safety:</strong> ${row.safety_notes}</p>
            </article>
          `;
        })
        .join("")
    : "<p class='tiny-note'>No species found.</p>";
}

async function loadLibrary() {
  const search = searchInput.value.trim();
  if (hasConfiguredBackend()) {
    try {
      const url = search ? `/api/animals?limit=1200&search=${encodeURIComponent(search)}` : "/api/animals?limit=1200";
      const res = await fetch(url);
      if (res.ok) {
        const rows = await res.json();
        libraryMeta.textContent = `Species loaded: ${rows.length}`;
        renderCards(rows);
        return;
      }
    } catch {
      // Fall through to local/demo data.
    }
  }

  const rows = filterRows(localSpeciesRows(), search);
  libraryMeta.textContent = `Local intelligence mode: ${rows.length} species`;
  renderCards(rows);
}

searchBtn.addEventListener("click", () => {
  loadLibrary().catch((err) => {
    libraryMeta.textContent = err.message;
  });
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadLibrary().catch((err) => {
      libraryMeta.textContent = err.message;
    });
  }
});

loadLibrary().catch((err) => {
  libraryMeta.textContent = err.message;
});
