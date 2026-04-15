const searchInput = document.getElementById("librarySearch");
const searchBtn = document.getElementById("librarySearchBtn");
const libraryMeta = document.getElementById("libraryMeta");
const libraryGrid = document.getElementById("libraryGrid");

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
  const url = search ? `/api/animals?limit=1200&search=${encodeURIComponent(search)}` : "/api/animals?limit=1200";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load animal library.");
  const rows = await res.json();
  libraryMeta.textContent = `Species loaded: ${rows.length}`;
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
