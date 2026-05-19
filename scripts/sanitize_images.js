const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = path.join(repoRoot, 'data', 'db.json');
const speciesDir = path.join(repoRoot, 'app', 'static', 'images', 'species');
const wildlifeDir = path.join(repoRoot, 'app', 'static', 'images', 'wildlife');

if (!fs.existsSync(dbPath)) {
  console.error('data/db.json not found');
  process.exit(1);
}

const raw = fs.readFileSync(dbPath, 'utf8');
let db;
try {
  db = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse db.json:', e.message);
  process.exit(1);
}

let changed = 0;

if (Array.isArray(db.species)) {
  db.species.forEach(s => {
    const slug = s.slug || s.id && String(s.id);
    if (!slug) return;
    const coverJpg = path.join(speciesDir, slug, 'cover.jpg');
    const coverSvg = path.join(speciesDir, slug, 'cover.svg');
    let chosen = '';
    if (fs.existsSync(coverJpg)) chosen = `/static/images/species/${slug}/cover.jpg`;
    else if (fs.existsSync(coverSvg)) chosen = `/static/images/species/${slug}/cover.svg`;
    else if (fs.existsSync(path.join(wildlifeDir, 'lion.jpg'))) chosen = `/static/images/wildlife/lion.jpg`;

    if (chosen) {
      if (s.image_url !== chosen) {
        s.image_url = chosen;
        changed++;
      }
      s.gallery_images = [chosen, chosen, chosen];
    } else {
      // leave as-is if no fallback
    }
  });
}

if (changed) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('Updated', changed, 'species image_url entries in data/db.json');
} else {
  console.log('No changes needed to data/db.json');
}
