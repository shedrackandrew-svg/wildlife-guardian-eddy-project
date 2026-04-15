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
  for (const item of slides.slice(0, 20)) {
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

  const animalsRes = await fetch("/api/animals?limit=30");
  const animals = animalsRes.ok ? await animalsRes.json() : [];

  const galleryRes = await fetch("/api/gallery?limit=30");
  if (galleryRes.ok) {
    items = await galleryRes.json();
  }
  if (!items.length) {
    if (animals.length) {
      items = animals.map((a) => ({
        species_name: a.species_name,
        scientific_name: a.scientific_name,
        conservation_status: a.conservation_status,
        image_url: a.image_urls?.[0] || "",
        fallback_image_url: FALLBACK_WILDLIFE_IMAGES[Math.floor(Math.random() * FALLBACK_WILDLIFE_IMAGES.length)],
      }));
    }
  }

  if (!items.length) {
    items = FALLBACK_WILDLIFE_IMAGES.map((img, idx) => ({
      species_name: `wildlife-${idx + 1}`,
      scientific_name: "Wildlife",
      conservation_status: "Observe and protect",
      image_url: img,
    }));
  }

  renderSpotlight(animals);
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
