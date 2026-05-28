import { runScript } from '../runner'
import Database from 'better-sqlite3'

// Use an in-memory DB for runner tests
jest.mock('../db', () => {
  const db = new (require('better-sqlite3'))(':memory:')
  db.exec(`CREATE TABLE data_sources (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, script TEXT NOT NULL,
    pipeline_json TEXT, schedule TEXT NOT NULL, last_output TEXT, last_run_at TEXT
  )`)
  return { default: db, __esModule: true }
})

describe('runScript', () => {
  beforeEach(() => {
    const db = require('../db').default
    db.prepare('DELETE FROM data_sources').run()
    db.prepare('INSERT INTO data_sources (id, name, script, schedule) VALUES (?, ?, ?, ?)')
      .run('s1', 'Test', '', '*/5 * * * *')
  })

  it('stores output JSON on success', async () => {
    const db = require('../db').default
    const source = { id: 's1', name: 'Test', script: 'return { value: 42 }', schedule: '*/5 * * * *' }
    await runScript(source)
    const row = db.prepare('SELECT last_output FROM data_sources WHERE id = ?').get('s1') as { last_output: string }
    expect(JSON.parse(row.last_output)).toEqual({ value: 42 })
  })

  it('stores error JSON on script failure', async () => {
    const db = require('../db').default
    const source = { id: 's1', name: 'Test', script: 'throw new Error("oops")', schedule: '*/5 * * * *' }
    await runScript(source)
    const row = db.prepare('SELECT last_output FROM data_sources WHERE id = ?').get('s1') as { last_output: string }
    expect(JSON.parse(row.last_output)).toHaveProperty('error')
  })
})
