const path = require('path');
const fs = require('fs');
const db = require('./db');

async function seed() {
  const catalogPath = path.join(__dirname, '..', 'app', 'static', 'wildlife-catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.error('catalog not found:', catalogPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(catalogPath, 'utf8');
  const rows = JSON.parse(raw);
  await db.read();
  const existing = db.data.species || [];
  let imported = 0;
  for (const r of rows) {
    const slug = r.slug || (r.species_name || r.common_name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    const found = existing.find(s => s.slug === slug || String(s.id) === String(r.id));
    if (found) {
      Object.assign(found, { ...r, slug });
    } else {
      const id = (existing.reduce((m, s) => Math.max(m, s.id || 0), 0) || 0) + 1;
      existing.push({ id, slug, name: r.common_name || r.species_name || r.scientific_name || slug, ...r });
      imported++;
    }
  }
  db.data.species = existing;
  await db.write();
  console.log(`Imported ${imported} species, total ${db.data.species.length}`);
}

async function createAdmin() {
  await db.read();
  const hasAdmin = db.data.users && db.data.users.some(u => u.is_admin);
  if (hasAdmin) {
    console.log('Admin user already exists');
    return;
  }
  const bcrypt = require('bcryptjs');
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASS || 'ChangeMe123!';
  const id = (db.data.users.reduce((m, u) => Math.max(m, u.id || 0), 0) || 0) + 1;
  const hash = bcrypt.hashSync(password, 10);
  db.data.users.push({ id, username, password_hash: hash, is_admin: 1 });
  await db.write();
  console.log(`Created admin user '${username}' with password '${password}'`);
}

async function main(){
  await seed();
  await createAdmin();
}

main().catch(err => { console.error(err); process.exit(2); });
