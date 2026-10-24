import Database from 'better-sqlite3'

export const db = new Database('data/haymesa.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS restaurantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    direccion TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    ultima_actualizacion TEXT
  );

  CREATE TABLE IF NOT EXISTS mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    capacidad INTEGER NOT NULL,
    zona TEXT NOT NULL,
    ocupada INTEGER NOT NULL DEFAULT 0,
    personas INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS historial (
    restaurante_id INTEGER NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
    minuto TEXT NOT NULL,
    ocupadas INTEGER NOT NULL,
    total INTEGER NOT NULL,
    PRIMARY KEY (restaurante_id, minuto)
  );
`)

// Bases creadas antes de agregar la columna "personas"
const columnasMesas = db.prepare('PRAGMA table_info(mesas)').all() as { name: string }[]
if (!columnasMesas.some((c) => c.name === 'personas')) {
  db.exec('ALTER TABLE mesas ADD COLUMN personas INTEGER NOT NULL DEFAULT 0')
}
