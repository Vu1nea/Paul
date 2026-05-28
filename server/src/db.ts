import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(__dirname, '..', 'paul.db')
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS layouts (
    id          TEXT PRIMARY KEY,
    layout_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS widgets (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    config_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS data_sources (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    script        TEXT NOT NULL,
    pipeline_json TEXT,
    schedule      TEXT NOT NULL,
    last_output   TEXT,
    last_run_at   TEXT
  );
  CREATE TABLE IF NOT EXISTS connectors (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT,
    url_template   TEXT NOT NULL,
    method         TEXT NOT NULL DEFAULT 'GET',
    headers_json   TEXT NOT NULL DEFAULT '[]',
    body_template  TEXT,
    variables_json TEXT NOT NULL DEFAULT '[]',
    is_builtin     INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS secrets (
    key             TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL
  );
`)

export default db
