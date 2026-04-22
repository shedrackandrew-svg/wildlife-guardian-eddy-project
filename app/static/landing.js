const slideA = document.getElementById("slideA");
const slideB = document.getElementById("slideB");
const slideMeta = document.getElementById("slideMeta");
const slideProgress = document.getElementById("slideProgress");
const spotlightTrack = document.getElementById("spotlightTrack");

const FALLBACK_WILDLIFE_IMAGES = [
  "https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1516934024742-b461fba47600?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?auto=format&fit=crop&w=1800&q=85",
  "https://images.unsplash.com/photo-1501706362039-c6e13b7b8d6e?auto=format&fit=crop&w=1800&q=85",
];

let items = [];
let index = 0;
let showingA = true;
let progressTimer = null;
let slideshowTimer = null;

let slideMs = 4200;
const TARGET_SPECIES_COUNT = 1000;
const TARGET_SLIDE_COUNT = 1200;
const CATALOG_BOOTSTRAP_KEY = "wg_catalog_bootstrap_v1";
const CATALOG_BOOTSTRAP_TTL_MS = 1000 * 60 * 60 * 12;
const CATALOG_SYNC_CLASSES = [
  "Mammalia",
  "Aves",
  "Reptilia",
  "Amphibia",
  "Actinopterygii",
  "Insecta",
  "Arachnida",
  "Malacostraca",
];

function normalizeApiBase(raw) {
  const value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return "";
  return value;
}

function hasConfiguredBackend() {
  if (!window.location.hostname.endsWith("github.io")) return true;
  return Boolean(String(window.WG_API_BASE || "").trim());
}

function apiUrl(path) {
  const cleanPath = String(path || "");
  const base = normalizeApiBase(window.WG_API_BASE || window.WG_DEFAULT_API_BASE || "");
  return base ? `${base}${cleanPath}` : cleanPath;
}

async function fetchJson(path, fallback = []) {
  try {
    const res = await fetch(apiUrl(path));
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}

async function tryBootstrapCatalog() {
  if (!hasConfiguredBackend()) return 0;

  const now = Date.now();
  const lastRun = Number(localStorage.getItem(CATALOG_BOOTSTRAP_KEY) || "0");
  if (lastRun > 0 && now - lastRun < CATALOG_BOOTSTRAP_TTL_MS) {
    return 0;
  }

  localStorage.setItem(CATALOG_BOOTSTRAP_KEY, String(now));

  let total = 0;
  try {
    const seedRes = await fetch(apiUrl("/api/species-catalog/seed-foundation"), { method: "POST" });
    if (seedRes.ok) {
      const seedPayload = await seedRes.json();
      total = Number(seedPayload.total_catalog_size || 0);
    }
  } catch {
    // Continue sync attempts even if seed fails.
  }

  if (total >= TARGET_SPECIES_COUNT) {
    return total;
  }

  for (const taxClass of CATALOG_SYNC_CLASSES) {
    for (let offset = 0; offset <= 900; offset += 300) {
      const params = new URLSearchParams({
        class_name: taxClass,
        limit: "300",
        offset: String(offset),
      });
      try {
        const response = await fetch(apiUrl(`/api/species-catalog/sync?${params.toString()}`), { method: "POST" });
        if (!response.ok) {
          continue;
        }
        const payload = await response.json();
        total = Math.max(total, Number(payload.total_catalog_size || 0));
        if (total >= TARGET_SPECIES_COUNT) {
          return total;
        }
      } catch {
        // Keep trying other classes/offsets.
      }
    }
  }

  return total;
}

function uniqueBySpecies(records) {
  const seen = new Set();
  const output = [];
  for (const item of records) {
    const species = String(item.species_name || item.label || "").trim().toLowerCase();
    if (!species || seen.has(species)) continue;
    seen.add(species);
    output.push(item);
  }
  return output;
}

function loadSlideSettings() {
  try {
    const raw = localStorage.getItem("wg_home_settings");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    slideMs = Number(parsed.slideMs) || 4200;
  } catch {
    slideMs = 4200;
  }
}

function startProgress() {
  if (!slideProgress) return;
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }

  slideProgress.style.width = "0%";
  const started = Date.now();
  progressTimer = setInterval(() => {
    const elapsed = Date.now() - started;
    const pct = Math.min(100, (elapsed / slideMs) * 100);
    slideProgress.style.width = `${pct}%`;
    if (pct >= 100) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }, 120);
}

function setupReveal() {
  const targets = Array.from(document.querySelectorAll(".reveal"));
  if (!targets.length) return;

  if (!("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );

  targets.forEach((el) => observer.observe(el));
}

function renderSpotlight(profiles) {
  if (!spotlightTrack) return;
  if (!profiles.length) {
    spotlightTrack.innerHTML = '<span class="spotlight-pill">No species loaded</span>';
    return;
  }

  const pills = profiles
    .slice(0, 18)
    .map((p) => `<span class="spotlight-pill">${p.species_name} • ${p.conservation_status}</span>`)
    .join("");
  spotlightTrack.innerHTML = `${pills}${pills}`;
  spotlightTrack.classList.add("marquee");
}

function restartSlideshowLoop() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
  }

  slideshowTimer = setInterval(() => {
    if (!items.length) return;
    index += 1;
    renderSlide(items[index % items.length]);
  }, slideMs);
}

function preloadSlideImages(slides) {
  for (const item of slides.slice(0, 50)) {
    const src = item.image_url || item.fallback_image_url;
    if (!src) continue;
    const img = new Image();
    img.decoding = "async";
    img.loading = "eager";
    img.src = src;
  }
}

function cardBackground(item) {
  if (item.image_url) {
    return `url(${item.image_url})`;
  }
  if (item.fallback_image_url) {
    return `url(${item.fallback_image_url})`;
  }
  const seed = item.species_name || item.label || "wild";
  const hue = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
  return `linear-gradient(140deg, hsl(${hue} 35% 24%), hsl(${(hue + 45) % 360} 40% 14%))`;
}

function renderSlide(item) {
  if (!slideA || !slideB || !slideMeta) {
    return;
  }
  if (!item) {
    const fallback = "linear-gradient(140deg, #0f2b1c, #152a3e)";
    slideA.style.backgroundImage = fallback;
    slideA.classList.add("is-visible");
    slideB.classList.remove("is-visible");
    slideMeta.innerHTML = "<h2>Global Wildlife Intelligence</h2><p>No wildlife media yet. Open Dashboard to start captures and build your slideshow.</p>";
    startProgress();
    return;
  }

  const incoming = showingA ? slideB : slideA;
  const outgoing = showingA ? slideA : slideB;
  incoming.style.backgroundImage = cardBackground(item);
  incoming.classList.add("is-visible");
  outgoing.classList.remove("is-visible");
  showingA = !showingA;

  slideMeta.innerHTML = `
    <h2>${item.label || item.species_name || "Wildlife"}</h2>
    <p>Continuous habitat stream for biodiversity awareness and field intelligence.</p>
    <p><strong>Scientific:</strong> ${item.scientific_name || "Unknown"}</p>
    <p><strong>Conservation:</strong> ${item.conservation_status || "Not evaluated"}</p>
  `;
  startProgress();
}

async function init() {
  loadSlideSettings();

  const backendEnabled = hasConfiguredBackend();
  const animals = await fetchJson("/api/animals?limit=600", []);
  const gallery = await fetchJson("/api/gallery?limit=240", []);

  let speciesCatalog = await fetchJson(`/api/species-catalog?limit=${TARGET_SLIDE_COUNT}`, []);
  if (backendEnabled && speciesCatalog.length < TARGET_SPECIES_COUNT) {
    await tryBootstrapCatalog();
    speciesCatalog = await fetchJson(`/api/species-catalog?limit=${TARGET_SLIDE_COUNT}`, speciesCatalog);
  }

  const catalogSlides = speciesCatalog.map((row, idx) => ({
    species_name: row.species_name,
    label: row.common_name || row.species_name,
    scientific_name: row.scientific_name || row.species_name,
    conservation_status: row.conservation_status || "Not evaluated",
    image_url: row.image_url || "",
    fallback_image_url: FALLBACK_WILDLIFE_IMAGES[idx % FALLBACK_WILDLIFE_IMAGES.length],
  }));

  const animalSlides = animals.map((a, idx) => ({
    species_name: a.species_name,
    label: a.species_name,
    scientific_name: a.scientific_name,
    conservation_status: a.conservation_status,
    image_url: a.image_urls?.[0] || "",
    fallback_image_url: FALLBACK_WILDLIFE_IMAGES[idx % FALLBACK_WILDLIFE_IMAGES.length],
  }));

  items = uniqueBySpecies([...gallery, ...catalogSlides, ...animalSlides]).slice(0, TARGET_SLIDE_COUNT);

  if (!items.length) {
    items = FALLBACK_WILDLIFE_IMAGES.map((img, idx) => ({
      species_name: `wildlife-${idx + 1}`,
      scientific_name: "Wildlife",
      conservation_status: "Observe and protect",
      image_url: img,
    }));
  }

  slideMeta.innerHTML = `
    <h2>Global Wildlife Intelligence</h2>
    <p>Building slideshow from ${items.length} wildlife entries across diverse species.</p>
  `;

  renderSpotlight(speciesCatalog.length ? speciesCatalog : animals);
  preloadSlideImages(items);

  renderSlide(items[0]);
  setupReveal();
  restartSlideshowLoop();

  window.addEventListener("keydown", (event) => {
    if (!items.length) return;
    if (event.key === "ArrowRight") {
      index += 1;
      renderSlide(items[index % items.length]);
      startProgress();
    }
    if (event.key === "ArrowLeft") {
      index = (index - 1 + items.length) % items.length;
      renderSlide(items[index % items.length]);
      startProgress();
    }
  });

  window.addEventListener("wg-home-settings-changed", (event) => {
    const next = Number(event.detail?.slideMs) || 4200;
    slideMs = next;
    startProgress();
    restartSlideshowLoop();
  });
}

init().catch(() => {
  renderSlide(null);
});
