import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(__dirname, '..', 'paul.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS layouts (
    id   TEXT PRIMARY KEY,
    layout_json TEXT NOT NULL
  )
`)

export default db
