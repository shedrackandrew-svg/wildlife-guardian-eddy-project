const adminTokenInput = document.getElementById("adminToken");
const saveTokenBtn = document.getElementById("saveToken");
const adminStatus = document.getElementById("adminStatus");
const searchSpeciesInput = document.getElementById("searchSpecies");
const refreshListBtn = document.getElementById("refreshList");
const profilesList = document.getElementById("profilesList");
const profileForm = document.getElementById("profileForm");
const deleteProfileBtn = document.getElementById("deleteProfile");
const bootstrapBtn = document.getElementById("bootstrapProfiles");
const saveStatus = document.getElementById("saveStatus");

let selectedSpecies = "";

function getToken() {
  return localStorage.getItem("adminToken") || "";
}

function setToken(token) {
  localStorage.setItem("adminToken", token);
}

function headers(includeJson = false) {
  const h = {};
  const token = getToken();
  if (token) {
    h["x-admin-token"] = token;
  }
  if (includeJson) {
    h["content-type"] = "application/json";
  }
  return h;
}

function toList(text) {
  return text
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function toLines(text) {
  return text
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}

function setForm(profile) {
  profileForm.elements.species_name.value = profile.species_name || "";
  profileForm.elements.scientific_name.value = profile.scientific_name || "";
  profileForm.elements.family.value = profile.family || "";
  profileForm.elements.conservation_status.value = profile.conservation_status || "";
  profileForm.elements.diet.value = profile.diet || "";
  profileForm.elements.average_lifespan_years.value = profile.average_lifespan_years || "";
  profileForm.elements.top_speed_kmh.value = profile.top_speed_kmh ?? "";
  profileForm.elements.habitats.value = (profile.habitats || []).join(", ");
  profileForm.elements.regions.value = (profile.regions || []).join(", ");
  profileForm.elements.aliases.value = (profile.aliases || []).join(", ");
  profileForm.elements.facts.value = (profile.facts || []).join("\n");
  profileForm.elements.safety_notes.value = profile.safety_notes || "";
}

async function loadProfiles() {
  const q = searchSpeciesInput.value.trim();
  const response = await fetch(`/api/animals?search=${encodeURIComponent(q)}&limit=500`);
  const data = await response.json();
  profilesList.innerHTML = data
    .map(
      (p) =>
        `<li><button class="link-btn" data-species="${p.species_name}">${p.species_name}</button><br><small>${p.conservation_status}</small></li>`,
    )
    .join("");

  profilesList.querySelectorAll("button[data-species]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const species = btn.getAttribute("data-species");
      selectedSpecies = species;
      const res = await fetch(`/api/animals/${encodeURIComponent(species)}`);
      const profile = await res.json();
      setForm(profile);
      saveStatus.textContent = `Loaded profile ${species}`;
    });
  });
}

saveTokenBtn.addEventListener("click", () => {
  setToken(adminTokenInput.value.trim());
  adminStatus.textContent = "Token saved in this browser.";
});

refreshListBtn.addEventListener("click", () => {
  loadProfiles().catch((err) => {
    saveStatus.textContent = `Refresh failed: ${err.message}`;
  });
});

searchSpeciesInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadProfiles().catch((err) => {
      saveStatus.textContent = `Search failed: ${err.message}`;
    });
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    species_name: profileForm.elements.species_name.value.trim().toLowerCase(),
    scientific_name: profileForm.elements.scientific_name.value.trim(),
    family: profileForm.elements.family.value.trim(),
    conservation_status: profileForm.elements.conservation_status.value.trim(),
    diet: profileForm.elements.diet.value.trim(),
    average_lifespan_years: profileForm.elements.average_lifespan_years.value.trim(),
    top_speed_kmh: profileForm.elements.top_speed_kmh.value ? Number(profileForm.elements.top_speed_kmh.value) : null,
    habitats: toList(profileForm.elements.habitats.value),
    regions: toList(profileForm.elements.regions.value),
    aliases: toList(profileForm.elements.aliases.value),
    facts: toLines(profileForm.elements.facts.value),
    safety_notes: profileForm.elements.safety_notes.value.trim(),
  };

  const response = await fetch("/api/admin/animals", {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Save failed (${response.status})`);
  }

  const saved = await response.json();
  selectedSpecies = saved.species_name;
  setForm(saved);
  saveStatus.textContent = `Saved profile ${saved.species_name}`;
  await loadProfiles();
});

deleteProfileBtn.addEventListener("click", async () => {
  const species = profileForm.elements.species_name.value.trim().toLowerCase();
  if (!species) {
    saveStatus.textContent = "Enter species_name to delete.";
    return;
  }

  const response = await fetch(`/api/admin/animals/${encodeURIComponent(species)}`, {
    method: "DELETE",
    headers: headers(false),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Delete failed (${response.status})`);
  }

  saveStatus.textContent = `Deleted profile ${species}`;
  selectedSpecies = "";
  profileForm.reset();
  await loadProfiles();
});

bootstrapBtn.addEventListener("click", async () => {
  const response = await fetch("/api/admin/bootstrap", {
    method: "POST",
    headers: headers(false),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Bootstrap failed (${response.status})`);
  }

  const info = await response.json();
  saveStatus.textContent = `Bootstrapped ${info.count} species files from labels.`;
  await loadProfiles();
});

(async function init() {
  adminTokenInput.value = getToken();
  adminStatus.textContent = getToken() ? "Token loaded from this browser." : "No token in this browser yet.";
  try {
    await loadProfiles();
  } catch (err) {
    saveStatus.textContent = `Initial load failed: ${err.message}`;
  }
})();
