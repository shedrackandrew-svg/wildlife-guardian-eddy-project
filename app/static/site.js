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
  document.body.classList.toggle("menu-compact", settings.menuDensity === "compact");

  if (settings.advancedMenu === "off") {
    return;
  }

  const navs = Array.from(document.querySelectorAll(".nav-links"));
  for (const nav of navs) {
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
    if (!hasAdmin) {
      const adminLink = document.createElement("a");
      adminLink.href = appRoute("/admin");
      adminLink.textContent = "Admin";
      nav.appendChild(adminLink);
    }

    const hasInventory = Array.from(nav.querySelectorAll("a")).find((a) => {
      const href = a.getAttribute("href") || "";
      return href.includes("/inventory") || href.includes("inventory.html");
    });
    if (!hasInventory) {
      const inventoryLink = document.createElement("a");
      inventoryLink.href = appRoute("/inventory");
      inventoryLink.textContent = "Inventory";
      nav.appendChild(inventoryLink);
    }
  }
}

function applyGlobalTheme() {
  const settings = getGlobalSettings();
  document.body.classList.remove("theme-forest", "theme-savanna", "theme-ocean", "theme-noir");
  document.body.classList.add(`theme-${settings.theme}`);
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
applyGlobalTheme();
applyMenuFeatures();
normalizePageLinks();
window.setTimeout(normalizePageLinks, 50);
window.setTimeout(normalizePageLinks, 400);
initHomeSettings();
if (document.readyState === "complete") {
  hidePreloader();
} else {
  window.addEventListener("load", hidePreloader, { once: true });
}
