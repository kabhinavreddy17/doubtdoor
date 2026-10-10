// A tiny "database": everything is kept in one file, data/db.json.
// No database software is needed. Delete data/db.json to reset to the demo data.
const fs = require('fs');
const path = require('path');
const { seed } = require('./seed');

const FILE = path.join(__dirname, '..', 'data', 'db.json');
let db = null;

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

function get() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    db = seed();
    save();
  }
  return db;
}

function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

module.exports = { get, save, newId };
