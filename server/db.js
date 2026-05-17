const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'db.json');

function load() {
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: [], species: [], sightings: [], favorites: [], comments: [] };
  }
}

function save(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf8');
}

const db = {
  data: load(),
  read: async function () { this.data = load(); },
  write: async function () { save(this.data); }
};

module.exports = db;
