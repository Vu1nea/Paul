import Database from 'better-sqlite3'
import path from 'path'

// All DB calls must be synchronous — never use async/await with better-sqlite3.
const DB_PATH = path.join(__dirname, '..', 'paul.db')
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS layouts (
    id          TEXT PRIMARY KEY,  -- always 'main'; single-row store
    layout_json TEXT NOT NULL      -- { lg: LayoutItem[] } as JSON
  );
  CREATE TABLE IF NOT EXISTS widgets (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    config_json TEXT NOT NULL  -- widget-specific user settings as JSON
  );
  CREATE TABLE IF NOT EXISTS data_sources (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    -- script holds the resolved, executable JS stored after pipeline generation.
    -- pipeline_json holds the raw pipeline definition (optional; null for hand-written scripts).
    -- When both exist, pipeline_json is the source of truth — script is derived from it.
    script        TEXT NOT NULL,
    pipeline_json TEXT,
    schedule      TEXT NOT NULL,  -- node-cron expression, e.g. '*/5 * * * *'
    last_output   TEXT,           -- JSON-serialised result (or { error } on failure)
    last_run_at   TEXT            -- ISO 8601 timestamp of last execution
  );
  CREATE TABLE IF NOT EXISTS connectors (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT,
    url_template   TEXT NOT NULL,  -- supports {variable} placeholders
    method         TEXT NOT NULL DEFAULT 'GET',
    headers_json   TEXT NOT NULL DEFAULT '[]',  -- [{ key, value }]
    body_template  TEXT,
    variables_json TEXT NOT NULL DEFAULT '[]',  -- variable definitions for the UI
    is_builtin     INTEGER NOT NULL DEFAULT 0   -- 1 = shipped with Paul, immutable
  );
  CREATE TABLE IF NOT EXISTS secrets (
    key             TEXT PRIMARY KEY,
    encrypted_value TEXT NOT NULL  -- AES-256-GCM; format: iv:authTag:ciphertext (hex)
  );
`)

export default db
