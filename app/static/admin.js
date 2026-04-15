const adminUserInput = document.getElementById("adminUser");
const adminPassInput = document.getElementById("adminPass");
const signInBtn = document.getElementById("signIn");
const signUpBtn = document.getElementById("signUp");
const adminStatus = document.getElementById("adminStatus");
const searchSpeciesInput = document.getElementById("searchSpecies");
const refreshListBtn = document.getElementById("refreshList");
const profilesList = document.getElementById("profilesList");
const profileForm = document.getElementById("profileForm");
const deleteProfileBtn = document.getElementById("deleteProfile");
const bootstrapBtn = document.getElementById("bootstrapProfiles");
const saveStatus = document.getElementById("saveStatus");
const imageSpeciesInput = document.getElementById("imageSpecies");
const imageUploadInput = document.getElementById("imageUpload");
const uploadImageBtn = document.getElementById("uploadImage");
const refreshImagesBtn = document.getElementById("refreshImages");
const speciesImagesList = document.getElementById("speciesImagesList");

function getToken() {
  return localStorage.getItem("wg_access_token") || "";
}

function setToken(token) {
  localStorage.setItem("wg_access_token", token);
}

function headers(includeJson = false) {
  const h = {};
  const token = getToken();
  if (token) {
    h.Authorization = `Bearer ${token}`;
  }
  if (includeJson) {
    h["Content-Type"] = "application/json";
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
  imageSpeciesInput.value = profile.species_name || "";
}

async function auth(endpoint) {
  const username = adminUserInput.value.trim().toLowerCase();
  const password = adminPassInput.value;
  if (!username || !password) {
    adminStatus.textContent = "Username and password are required.";
    return;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    adminStatus.textContent = (await response.text()) || "Auth failed.";
    return;
  }

  const data = await response.json();
  setToken(data.access_token);
  adminStatus.textContent = `Signed in as ${data.user.username}. Admin: ${data.user.is_admin ? "yes" : "no"}`;
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
      const res = await fetch(`/api/animals/${encodeURIComponent(species)}`);
      const profile = await res.json();
      setForm(profile);
      saveStatus.textContent = `Loaded profile ${species}`;
      await loadSpeciesImages();
    });
  });
}

async function loadSpeciesImages() {
  const species = (imageSpeciesInput.value || profileForm.elements.species_name.value || "").trim().toLowerCase();
  if (!species) {
    speciesImagesList.innerHTML = "<li>Enter species name first.</li>";
    return;
  }

  const response = await fetch(`/api/admin/species-images/${encodeURIComponent(species)}`, {
    headers: headers(false),
  });

  if (!response.ok) {
    speciesImagesList.innerHTML = `<li>Unable to load images (${response.status}).</li>`;
    return;
  }

  const data = await response.json();
  if (!data.images.length) {
    speciesImagesList.innerHTML = "<li>No curated images yet.</li>";
    return;
  }

  speciesImagesList.innerHTML = data.images
    .map((url) => {
      const filename = url.split("/").pop();
      return `<li><img src="${url}" alt="${species}" style="width:72px;height:52px;object-fit:cover;border-radius:8px;margin-right:8px;vertical-align:middle;" /><span>${filename}</span> <button type="button" class="link-btn" data-cover="${filename}" data-species="${species}">Set Cover</button> <button type="button" class="link-btn" data-delete="${filename}" data-species="${species}">Delete</button></li>`;
    })
    .join("");

  speciesImagesList.querySelectorAll("button[data-cover]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const filename = btn.getAttribute("data-cover");
      const sp = btn.getAttribute("data-species");
      const coverRes = await fetch(
        `/api/admin/species-images/${encodeURIComponent(sp)}/cover?filename=${encodeURIComponent(filename)}`,
        {
          method: "POST",
          headers: headers(false),
        },
      );
      if (!coverRes.ok) {
        saveStatus.textContent = `Set cover failed (${coverRes.status}).`;
        return;
      }
      saveStatus.textContent = `Cover image set to ${filename}`;
      await loadSpeciesImages();
    });
  });

  speciesImagesList.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const filename = btn.getAttribute("data-delete");
      const sp = btn.getAttribute("data-species");
      const delRes = await fetch(
        `/api/admin/species-images/${encodeURIComponent(sp)}?filename=${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
          headers: headers(false),
        },
      );
      if (!delRes.ok) {
        saveStatus.textContent = `Delete image failed (${delRes.status}).`;
        return;
      }
      saveStatus.textContent = `Deleted image ${filename}`;
      await loadSpeciesImages();
    });
  });
}

signInBtn.addEventListener("click", () => {
  auth("/api/auth/sign-in").catch((err) => {
    adminStatus.textContent = err.message;
  });
});

signUpBtn.addEventListener("click", () => {
  auth("/api/auth/sign-up").catch((err) => {
    adminStatus.textContent = err.message;
  });
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
  setForm(saved);
  saveStatus.textContent = `Saved profile ${saved.species_name}`;
  await loadProfiles();
  await loadSpeciesImages();
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
  profileForm.reset();
  await loadProfiles();
  speciesImagesList.innerHTML = "<li>Profile deleted.</li>";
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

uploadImageBtn.addEventListener("click", async () => {
  const species = (imageSpeciesInput.value || profileForm.elements.species_name.value || "").trim().toLowerCase();
  const file = imageUploadInput.files?.[0];
  if (!species || !file) {
    saveStatus.textContent = "Select species and image file first.";
    return;
  }

  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`/api/admin/species-images/${encodeURIComponent(species)}`, {
    method: "POST",
    headers: headers(false),
    body: form,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Upload failed (${response.status})`);
  }

  saveStatus.textContent = `Uploaded image for ${species}`;
  imageUploadInput.value = "";
  await loadSpeciesImages();
});

refreshImagesBtn.addEventListener("click", () => {
  loadSpeciesImages().catch((err) => {
    saveStatus.textContent = `Image refresh failed: ${err.message}`;
  });
});

(async function init() {
  adminStatus.textContent = getToken() ? "Existing session token loaded from this browser." : "Please sign in or sign up.";
  try {
    const me = await fetch("/api/auth/me", { headers: headers(false) });
    if (me.ok) {
      const user = await me.json();
      adminStatus.textContent = `Signed in as ${user.username}. Admin: ${user.is_admin ? "yes" : "no"}`;
    }
    await loadProfiles();
    await loadSpeciesImages();
  } catch (err) {
    saveStatus.textContent = `Initial load failed: ${err.message}`;
  }
})();
