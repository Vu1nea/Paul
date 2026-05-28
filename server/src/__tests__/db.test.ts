import Database from 'better-sqlite3'

describe('database schema', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
    db.exec(`
      CREATE TABLE IF NOT EXISTS data_sources (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, script TEXT NOT NULL,
        pipeline_json TEXT, schedule TEXT NOT NULL, last_output TEXT, last_run_at TEXT
      );
      CREATE TABLE IF NOT EXISTS connectors (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
        url_template TEXT NOT NULL, method TEXT NOT NULL DEFAULT 'GET',
        headers_json TEXT NOT NULL DEFAULT '[]', body_template TEXT,
        variables_json TEXT NOT NULL DEFAULT '[]', is_builtin INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS secrets (
        key TEXT PRIMARY KEY, encrypted_value TEXT NOT NULL
      );
    `)
  })

  afterEach(() => db.close())

  it('inserts and reads a data_source row', () => {
    db.prepare('INSERT INTO data_sources (id, name, script, schedule) VALUES (?, ?, ?, ?)')
      .run('s1', 'Test', 'return {}', '*/5 * * * *')
    const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get('s1') as { name: string }
    expect(row.name).toBe('Test')
  })

  it('data_source pipeline_json defaults to null', () => {
    db.prepare('INSERT INTO data_sources (id, name, script, schedule) VALUES (?, ?, ?, ?)')
      .run('s2', 'Test', 'return {}', '*/5 * * * *')
    const row = db.prepare('SELECT pipeline_json FROM data_sources WHERE id = ?').get('s2') as { pipeline_json: null }
    expect(row.pipeline_json).toBeNull()
  })
})
