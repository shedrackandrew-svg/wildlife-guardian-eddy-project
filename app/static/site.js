function isGithubPagesHost() {
  return window.location.hostname.endsWith("github.io");
}

function getRepoBasePath() {
  if (!isGithubPagesHost()) return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (!parts.length) return "";
  return `/${parts[0]}`;
}

function normalizeApiBase(raw) {
  const value = String(raw || "").trim().replace(/\/$/, "");
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return "";
  return value;
}

const WILDLIFE_BACKDROP_SPECIES = [
  { type: "animal", name: "lion", tags: "lion,savanna,grassland", habitat: "African savanna", caption: "Lion pride crossing open grassland." },
  { type: "animal", name: "elephant", tags: "elephant,forest,africa", habitat: "River woodland", caption: "Elephants moving through shaded woodland." },
  { type: "animal", name: "giraffe", tags: "giraffe,savanna,acacia", habitat: "Acacia savanna", caption: "Giraffes feeding under acacia trees." },
  { type: "animal", name: "zebra", tags: "zebra,grassland,savanna", habitat: "Open grassland", caption: "Zebra herd grazing in open grassland." },
  { type: "animal", name: "rhino", tags: "rhinoceros,grassland,africa", habitat: "Grassland basin", caption: "Rhinos moving across tall grass." },
  { type: "animal", name: "cheetah", tags: "cheetah,savanna,africa", habitat: "Warm savanna", caption: "Cheetah scanning the horizon." },
  { type: "animal", name: "leopard", tags: "leopard,forest,africa", habitat: "Misty forest", caption: "Leopard resting in a forest canopy." },
  { type: "animal", name: "gorilla", tags: "gorilla,rainforest,congo", habitat: "Tropical rainforest", caption: "Mountain gorillas in dense rainforest." },
  { type: "animal", name: "panda", tags: "panda,forest,bamboo", habitat: "Bamboo forest", caption: "Pandas feeding in a bamboo grove." },
  { type: "animal", name: "koala", tags: "koala,eucalyptus,forest", habitat: "Eucalyptus woodland", caption: "Koalas resting among eucalyptus leaves." },
  { type: "animal", name: "tiger", tags: "tiger,jungle,forest", habitat: "Rainforest edge", caption: "Tiger moving through lush jungle." },
  { type: "animal", name: "penguin", tags: "penguin,ice,coast", habitat: "Polar coast", caption: "Penguins clustered on a cold shoreline." },
  { type: "animal", name: "flamingo", tags: "flamingo,wetland,lake", habitat: "Wetland lagoon", caption: "Flamingos feeding in shallow water." },
  { type: "animal", name: "otter", tags: "otter,river,wetland", habitat: "Freshwater river", caption: "Otters playing in a river channel." },
  { type: "animal", name: "eagle", tags: "eagle,mountain,sky", habitat: "Mountain ridge", caption: "Eagle soaring above a mountain ridge." },
  { type: "animal", name: "camel", tags: "camel,desert,dune", habitat: "Desert dunes", caption: "Camels traveling across desert dunes." },
  { type: "plant", name: "orchid", tags: "orchid,rainforest,flower", habitat: "Rainforest understory", caption: "Orchids growing in humid forest shade." },
  { type: "plant", name: "mangrove", tags: "mangrove,coast,wetland", habitat: "Coastal wetland", caption: "Mangrove roots along the shoreline." },
  { type: "plant", name: "water-lily", tags: "water-lily,pond,wetland", habitat: "Freshwater pond", caption: "Water lilies on a still pond." },
  { type: "plant", name: "fern", tags: "fern,forest,green", habitat: "Temperate forest", caption: "Ferns carpeting a forest floor." },
  { type: "plant", name: "bamboo", tags: "bamboo,forest,green", habitat: "Bamboo grove", caption: "Tall bamboo in soft green light." },
  { type: "plant", name: "cactus", tags: "cactus,desert,plant", habitat: "Desert scrub", caption: "Cactus standing in desert scrub." },
  { type: "plant", name: "palm", tags: "palm,coast,tropical", habitat: "Tropical coast", caption: "Palm trees swaying at the coast." },
  { type: "plant", name: "moss", tags: "moss,forest,macro", habitat: "Mossy woodland", caption: "Moss covering a damp woodland floor." },
  { type: "plant", name: "wildflower", tags: "wildflower,meadow,flower", habitat: "Wildflower meadow", caption: "Wildflowers blooming in a meadow." },
  { type: "plant", name: "pine", tags: "pine,forest,trees", habitat: "Mountain forest", caption: "Pine forest on a mountain slope." },
  { type: "plant", name: "lotus", tags: "lotus,pond,flower", habitat: "Garden pond", caption: "Lotus blossoms over calm water." },
  { type: "plant", name: "seagrass", tags: "seagrass,ocean,coast", habitat: "Shallow coast", caption: "Seagrass below a clear coastal surface." },
  { type: "plant", name: "baobab", tags: "baobab,savanna,tree", habitat: "Savanna plain", caption: "Baobab silhouette across the savanna." },
  { type: "plant", name: "mushroom", tags: "mushroom,forest,macro", habitat: "Forest floor", caption: "Mushrooms on a shaded forest floor." },
  { type: "plant", name: "lily", tags: "lily,garden,flower", habitat: "Botanical garden", caption: "Lilies blooming in a botanical garden." },
  { type: "plant", name: "aloe", tags: "aloe,desert,succulent", habitat: "Dry hillside", caption: "Aloe thriving on a dry hillside." },
];

const WILDLIFE_BACKDROP_VARIANTS = [
  { key: "dawn", label: "Dawn light", suffix: "soft dawn light" },
  { key: "morning", label: "Morning calm", suffix: "bright morning calm" },
  { key: "midday", label: "Midday sun", suffix: "clear midday sun" },
  { key: "golden", label: "Golden hour", suffix: "golden hour glow" },
  { key: "canopy", label: "Canopy shade", suffix: "green canopy shade" },
  { key: "water", label: "Water edge", suffix: "at the water edge" },
  { key: "mist", label: "Forest mist", suffix: "forest mist and dew" },
  { key: "rain", label: "After rain", suffix: "after a light rain" },
];

function backdropPalette(scene) {
  if (scene.type === "plant") {
    return ["#f2fbf2", "#d5efd9", "#9ccfa5", "#4c9d68"];
  }
  return ["#f8f7ef", "#ebdeaf", "#c9ad68", "#7f6534"];
}

function backdropSvgDataUri(scene, variant, sceneIndex, variantIndex) {
  const [bg1, bg2, bg3, accent] = backdropPalette(scene);
  const title = String(scene.name || "Wildlife");
  const habitat = String(scene.habitat || "natural habitat");
  const subject = scene.type === "plant" ? `
    <path d="M600 560 C 600 470, 590 380, 600 260" stroke="#245335" stroke-width="24" stroke-linecap="round" fill="none" />
    <path d="M600 390 C 515 345, 430 285, 385 220 C 470 225, 540 270, 600 330" fill="#4a9d68" fill-opacity="0.44" />
    <path d="M600 355 C 690 320, 765 250, 820 172 C 735 174, 670 222, 600 305" fill="#5bb877" fill-opacity="0.42" />
    <path d="M600 475 C 515 455, 440 415, 365 346 C 445 338, 525 384, 600 438" fill="#67c081" fill-opacity="0.34" />
    <circle cx="600" cy="244" r="48" fill="#ddf4df" fill-opacity="0.92" />
  ` : `
    <ellipse cx="610" cy="430" rx="185" ry="112" fill="#231f16" fill-opacity="0.22" />
    <circle cx="760" cy="350" r="42" fill="#231f16" fill-opacity="0.24" />
    <circle cx="784" cy="335" r="10" fill="#ffffff" fill-opacity="0.42" />
    <path d="M430 430 Q 330 360 250 430" fill="none" stroke="#231f16" stroke-width="22" stroke-linecap="round" stroke-opacity="0.22" />
    <path d="M520 520 Q 470 620 380 660" fill="none" stroke="#231f16" stroke-width="18" stroke-linecap="round" stroke-opacity="0.2" />
    <path d="M675 520 Q 730 620 820 656" fill="none" stroke="#231f16" stroke-width="18" stroke-linecap="round" stroke-opacity="0.2" />
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bg1}" />
          <stop offset="55%" stop-color="${bg2}" />
          <stop offset="100%" stop-color="${bg3}" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="35%" r="72%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.84" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#g)" />
      <ellipse cx="960" cy="360" rx="760" ry="430" fill="url(#glow)" />
      <rect x="0" y="710" width="1920" height="370" fill="#ffffff" fill-opacity="0.18" />
      <path d="M0 730 C 260 620, 510 690, 760 648 S 1240 606, 1560 694 S 1790 724, 1920 658 L1920 1080 L0 1080 Z" fill="#ffffff" fill-opacity="0.2" />
      <path d="M0 820 C 320 760, 520 890, 840 822 S 1360 720, 1920 834 L1920 1080 L0 1080 Z" fill="#ffffff" fill-opacity="0.12" />
      <circle cx="1560" cy="174" r="104" fill="#ffffff" fill-opacity="0.24" />
      <circle cx="280" cy="170" r="72" fill="#ffffff" fill-opacity="0.18" />
      <g transform="translate(300 140) scale(1.18)">${subject}</g>
      <g fill="#1b2d22" fill-opacity="0.1">
        <circle cx="220" cy="540" r="16" />
        <circle cx="280" cy="570" r="10" />
        <circle cx="1670" cy="530" r="14" />
        <circle cx="1620" cy="600" r="9" />
      </g>
      <g font-family="Manrope, Arial, sans-serif" text-anchor="middle">
        <text x="960" y="90" font-size="42" font-weight="700" fill="#19311f">${title}</text>
        <text x="960" y="136" font-size="24" fill="#254736">${variant.label} • ${habitat}</text>
        <text x="960" y="1000" font-size="28" fill="#203d29">${scene.caption}</text>
      </g>
    </svg>
  `)}`;
}

const WILDLIFE_BACKDROP_FRAMES = WILDLIFE_BACKDROP_SPECIES.flatMap((scene, sceneIndex) =>
  WILDLIFE_BACKDROP_VARIANTS.map((variant, variantIndex) => {
    return {
      title: `${scene.name} - ${variant.label}`,
      caption: `${scene.caption} ${scene.habitat}`,
      alt: `${scene.name} in ${scene.habitat}`,
      image: backdropSvgDataUri(scene, variant, sceneIndex, variantIndex),
    };
  }),
).slice(0, 128);

function preloadBackdropFrame(src) {
  if (!src) return;
  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image.src = src;
}

function initWildlifeBackdrop() {
  const body = document.body;
  if (!body || !WILDLIFE_BACKDROP_FRAMES.length) return;

  // Try to build frames from backend species gallery images for photographic clarity
  const tryBuildFromApi = async () => {
    try {
      const res = await fetch('/api/species', { cache: 'no-store' });
      if (!res.ok) return null;
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) return null;
      const photoFrames = [];
      for (const r of rows) {
        const imgs = Array.isArray(r.gallery_images) && r.gallery_images.length ? r.gallery_images : (r.image_url ? [r.image_url] : []);
        if (!imgs.length) continue;
        for (const img of imgs.slice(0, 3)) {
          photoFrames.push({ title: r.name || r.common_name || r.species_name, alt: `${r.name || r.species_name}`, image: img });
          if (photoFrames.length >= 128) break;
        }
        if (photoFrames.length >= 128) break;
      }
      return photoFrames.length ? photoFrames : null;
    } catch (e) {
      return null;
    }
  };

  let framesPromise = tryBuildFromApi();

  let backdrop = document.querySelector(".wildlife-slideback");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "wildlife-slideback";
    backdrop.innerHTML = `
      <div class="slide-layer layer-a"></div>
      <div class="slide-layer layer-b"></div>
      <div class="overlay-a"></div>
      <div class="overlay-b"></div>
    `;
    body.prepend(backdrop);
  }

  const layerA = backdrop.querySelector(".layer-a");
  const layerB = backdrop.querySelector(".layer-b");
  if (!layerA || !layerB) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeLayer = layerA;
  let frameIndex = 0;

  const applyFrame = (frame, layer) => {
    layer.style.backgroundImage = `url("${frame.image}")`;
    layer.style.backgroundSize = "cover";
    layer.style.backgroundPosition = "center";
    layer.setAttribute("aria-label", frame.alt);
  };

  const activateFrame = (frame) => {
    const nextLayer = activeLayer === layerA ? layerB : layerA;
    applyFrame(frame, nextLayer);
    backdrop.classList.add("is-transitioning");
    window.setTimeout(() => {
      backdrop.classList.remove("is-transitioning");
      activeLayer = nextLayer;
    }, 50);
  };

  // resolve frames (prefer API-built photographic frames)
  (async () => {
    const apiFrames = await framesPromise.catch(() => null);
    const frames = apiFrames && apiFrames.length ? apiFrames : WILDLIFE_BACKDROP_FRAMES;
    applyFrame(frames[0], layerA);
    applyFrame(frames[1] || frames[0], layerB);
    frames.slice(0, 16).forEach((frame) => preloadBackdropFrame(frame.image));

    if (reducedMotion) return;

    window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      activateFrame(frames[frameIndex]);
      preloadBackdropFrame(frames[(frameIndex + 8) % frames.length].image);
    }, 7600);
  })();
}

function bootstrapApiBase() {
  const query = new URLSearchParams(window.location.search);
  const queryBase = normalizeApiBase(query.get("api_base"));
  const storedBase = normalizeApiBase(localStorage.getItem("wg_api_base"));
  const defaultBase = normalizeApiBase(window.WG_DEFAULT_API_BASE || "");
  const selectedBase = queryBase || storedBase || defaultBase;

  if (queryBase) {
    localStorage.setItem("wg_api_base", queryBase);
  } else if (selectedBase) {
    localStorage.setItem("wg_api_base", selectedBase);
  }

  window.WG_API_BASE = selectedBase;

  if (query.has("api_base")) {
    query.delete("api_base");
    const next = `${window.location.pathname}${query.toString() ? `?${query.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", next);
  }
}

function appRoute(path) {
  const clean = (path || "/").replace(/\/$/, "") || "/";
  if (!isGithubPagesHost()) return clean;

  const base = getRepoBasePath();
  if (clean === base || clean.startsWith(`${base}/`)) {
    return clean;
  }

  const routeMap = {
    "/": "/index.html",
    "/dashboard": "/dashboard.html",
    "/library": "/library.html",
    "/plants": "/plants.html",
    "/inventory": "/inventory.html",
    "/history": "/history.html",
    "/map": "/map.html",
    "/live": "/live.html",
    "/settings": "/settings.html",
    "/onboarding": "/onboarding.html",
    "/admin": "/admin.html",
  };

  const mapped = routeMap[clean] || clean;
  return `${base}${mapped}`;
}

function normalizePageLinks() {
  const base = getRepoBasePath();
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  for (const anchor of anchors) {
    const rawHref = anchor.getAttribute("href") || "";
    if (!rawHref.startsWith("/") || rawHref.startsWith("//") || rawHref.startsWith("/api/")) {
      continue;
    }
    if (base && (rawHref === base || rawHref.startsWith(`${base}/`))) {
      continue;
    }
    anchor.setAttribute("href", appRoute(rawHref));
  }
}

function setActiveNav() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const activePath = isGithubPagesHost() ? path.replace(getRepoBasePath(), "") || "/" : path;
  const links = Array.from(document.querySelectorAll(".nav-links a"));
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const parsed = href.startsWith("http") ? new URL(href).pathname : href;
    const normalizedHref = (parsed.replace(/\/$/, "") || "/").replace(getRepoBasePath(), "") || "/";
    if (normalizedHref === activePath) {
      link.classList.add("active");
    }
  }
}

function ensureSettingsLink() {
  const navs = Array.from(document.querySelectorAll(".nav-links"));
  for (const nav of navs) {
    const existing = Array.from(nav.querySelectorAll("a")).find((a) => {
      const href = a.getAttribute("href") || "";
      return href.includes("/settings") || href.includes("settings.html");
    });
    if (existing) continue;
    const link = document.createElement("a");
    link.href = appRoute("/settings");
    link.textContent = "Settings";
    nav.appendChild(link);
  }
}

function ensurePlantsLink() {
  const navs = Array.from(document.querySelectorAll(".nav-links"));
  for (const nav of navs) {
    const existing = Array.from(nav.querySelectorAll("a")).find((a) => {
      const href = a.getAttribute("href") || "";
      return href.includes("/plants") || href.includes("plants.html");
    });
    if (existing) continue;
    const link = document.createElement("a");
    link.href = appRoute("/plants");
    link.textContent = "Plants";
    nav.appendChild(link);
  }
}

function ensureGlobalFooter() {
  if (document.querySelector("footer")) return;
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="site-footer__inner">
      <div>
        <strong>Global Wildlife Platform</strong>
        <p>Wildlife and plant intelligence for conservation, learning, and field readiness.</p>
      </div>
      <div class="site-footer__links">
        <a href="${appRoute("/")}">Home</a>
        <a href="${appRoute("/library")}">Animals</a>
        <a href="${appRoute("/plants")}">Plants</a>
        <a href="${appRoute("/map")}">Map</a>
      </div>
    </div>
  `;
  document.body.appendChild(footer);
}

function getGlobalSettings() {
  const defaults = {
    theme: "forest",
    masterVolume: 0.75,
    voiceRate: 0.96,
    autoCaptureMs: 1300,
    minConfidence: 0.35,
    strictAnimalMode: true,
    menuDensity: "comfortable",
    advancedMenu: "on",
  };

  try {
    const raw = localStorage.getItem("wg_global_settings");
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme || defaults.theme,
      masterVolume: Number(parsed.masterVolume) || defaults.masterVolume,
      voiceRate: Number(parsed.voiceRate) || defaults.voiceRate,
      autoCaptureMs: Number(parsed.autoCaptureMs) || defaults.autoCaptureMs,
      minConfidence: Number(parsed.minConfidence) || defaults.minConfidence,
      strictAnimalMode: parsed.strictAnimalMode !== false,
      menuDensity: parsed.menuDensity || defaults.menuDensity,
      advancedMenu: parsed.advancedMenu || defaults.advancedMenu,
    };
  } catch {
    return defaults;
  }
}

function applyMenuFeatures() {
  const settings = getGlobalSettings();
  const role = (localStorage.getItem("wg_user_role") || "user").toLowerCase();
  document.body.classList.toggle("menu-compact", settings.menuDensity === "compact");

  if (settings.advancedMenu === "off") {
    return;
  }

  const navs = Array.from(document.querySelectorAll(".nav-links"));
  for (const nav of navs) {
    nav.querySelectorAll("[data-role-only='admin']").forEach((element) => {
      element.remove();
    });

    const hasOnboarding = Array.from(nav.querySelectorAll("a")).find((a) => {
      const href = a.getAttribute("href") || "";
      return href.includes("/onboarding") || href.includes("onboarding.html");
    });
    if (!hasOnboarding) {
      const onboardingLink = document.createElement("a");
      onboardingLink.href = appRoute("/onboarding");
      onboardingLink.textContent = "Pair Device";
      nav.appendChild(onboardingLink);
    }

    const hasAdmin = Array.from(nav.querySelectorAll("a")).find((a) => {
      const href = a.getAttribute("href") || "";
      return href.includes("/admin") || href.includes("admin.html");
    });
    if (role === "admin" && !hasAdmin) {
      const adminLink = document.createElement("a");
      adminLink.href = appRoute("/admin");
      adminLink.textContent = "Admin";
      adminLink.dataset.roleOnly = "admin";
      nav.appendChild(adminLink);
    }

    const hasInventory = Array.from(nav.querySelectorAll("a")).find((a) => {
      const href = a.getAttribute("href") || "";
      return href.includes("/inventory") || href.includes("inventory.html");
    });
    if (role === "admin" && !hasInventory) {
      const inventoryLink = document.createElement("a");
      inventoryLink.href = appRoute("/inventory");
      inventoryLink.textContent = "Inventory";
      inventoryLink.dataset.roleOnly = "admin";
      nav.appendChild(inventoryLink);
    }
  }
}

function applyGlobalTheme() {
  const settings = getGlobalSettings();
  document.body.classList.remove("theme-forest", "theme-savanna", "theme-ocean", "theme-noir");
  document.body.classList.add(`theme-${settings.theme}`);
}

function applyAuthState() {
  const role = (localStorage.getItem("wg_user_role") || "user").toLowerCase();
  const username = localStorage.getItem("wg_username") || "Guest";
  document.body.dataset.userRole = role;
  document.body.dataset.username = username;

  document.querySelectorAll("[data-admin-only]").forEach((element) => {
    element.hidden = role !== "admin";
  });
}

function initAuthModal() {
  const modal = document.getElementById("authModal");
  const form = document.getElementById("authForm");
  const title = document.getElementById("authModalTitle");
  const hint = document.getElementById("authModalHint");
  const username = document.getElementById("authUsername");
  const password = document.getElementById("authPassword");
  const roleSelect = document.getElementById("authRole");
  const submit = document.getElementById("authSubmit");
  const modeButtons = Array.from(document.querySelectorAll("[data-auth-mode]"));
  const openButtons = Array.from(document.querySelectorAll("[data-auth-action]"));
  const closeButtons = Array.from(document.querySelectorAll("[data-auth-close]"));

  if (!modal || !form || !title || !hint || !username || !password || !roleSelect || !submit || !openButtons.length) {
    return;
  }

  let mode = "signin";

  const syncMode = (nextMode) => {
    mode = nextMode;
    title.textContent = nextMode === "signup" ? "Sign Up" : "Sign In";
    hint.textContent = nextMode === "signup" ? "Create an account for a regular user or admin." : "Use your account to continue.";
    submit.textContent = nextMode === "signup" ? "Create Account" : "Continue";
    modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.authMode === nextMode);
    });
  };

  const openModal = (nextMode) => {
    syncMode(nextMode);
    modal.hidden = false;
    username.focus();
  };

  const closeModal = () => {
    modal.hidden = true;
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.authAction || "signin"));
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => syncMode(button.dataset.authMode || "signin"));
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) {
      closeModal();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nextRole = roleSelect.value === "admin" ? "admin" : "user";
    localStorage.setItem("wg_username", username.value.trim() || "Guest");
    localStorage.setItem("wg_user_role", nextRole);
    localStorage.setItem("wg_auth_state", `${mode}:${username.value.trim()}`);
    applyAuthState();
    applyMenuFeatures();
    closeModal();
  });

  syncMode("signin");
}

function initHomeSettings() {
  const settingsBtn = document.getElementById("menuSettingsBtn");
  const panel = document.getElementById("homeSettingsPanel");
  const closeBtn = document.getElementById("closeHomeSettings");
  const speedSelect = document.getElementById("homeSlideSpeed");
  const highContrastCheck = document.getElementById("homeHighContrast");
  const reducedMotionCheck = document.getElementById("homeReduceMotion");

  if (!settingsBtn || !panel || !closeBtn || !speedSelect || !highContrastCheck || !reducedMotionCheck) {
    return;
  }

  let homeSettings = {
    slideMs: 4200,
    highContrast: false,
    reduceMotion: false,
  };

  try {
    const raw = localStorage.getItem("wg_home_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      homeSettings = {
        slideMs: Number(parsed.slideMs) || 4200,
        highContrast: Boolean(parsed.highContrast),
        reduceMotion: Boolean(parsed.reduceMotion),
      };
    }
  } catch {
    // Ignore invalid local settings.
  }

  function applyHomeSettings() {
    speedSelect.value = String(homeSettings.slideMs);
    highContrastCheck.checked = homeSettings.highContrast;
    reducedMotionCheck.checked = homeSettings.reduceMotion;

    document.body.classList.toggle("high-contrast", homeSettings.highContrast);
    document.body.classList.toggle("reduced-motion", homeSettings.reduceMotion);
    localStorage.setItem("wg_home_settings", JSON.stringify(homeSettings));
    window.dispatchEvent(new CustomEvent("wg-home-settings-changed", { detail: homeSettings }));
  }

  settingsBtn.addEventListener("click", () => panel.classList.remove("hidden"));
  closeBtn.addEventListener("click", () => panel.classList.add("hidden"));
  panel.addEventListener("click", (event) => {
    if (event.target === panel) {
      panel.classList.add("hidden");
    }
  });

  speedSelect.addEventListener("change", () => {
    homeSettings.slideMs = Number(speedSelect.value) || 4200;
    applyHomeSettings();
  });

  highContrastCheck.addEventListener("change", () => {
    homeSettings.highContrast = highContrastCheck.checked;
    applyHomeSettings();
  });

  reducedMotionCheck.addEventListener("change", () => {
    homeSettings.reduceMotion = reducedMotionCheck.checked;
    applyHomeSettings();
  });

  applyHomeSettings();
}

function hidePreloader() {
  const preloader = document.getElementById("preloader");
  if (!preloader) return;
  window.setTimeout(() => {
    preloader.classList.add("hide");
  }, 420);
}

bootstrapApiBase();
normalizePageLinks();
setActiveNav();
ensureSettingsLink();
ensurePlantsLink();
applyGlobalTheme();
applyMenuFeatures();
applyAuthState();
initAuthModal();
normalizePageLinks();
window.setTimeout(normalizePageLinks, 50);
window.setTimeout(normalizePageLinks, 400);
initHomeSettings();
initWildlifeBackdrop();
ensureGlobalFooter();
if (document.readyState === "complete") {
  hidePreloader();
} else {
  window.addEventListener("load", hidePreloader, { once: true });
}
