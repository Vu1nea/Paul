import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import db from '../db'

export const BUILTIN_CONNECTORS = [
  {
    id: 'builtin-open-meteo',
    name: 'Open-Meteo Weather',
    description: 'Free current weather data. No API key required.',
    url_template: 'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true',
    method: 'GET',
    headers_json: '[]',
    body_template: null,
    variables_json: JSON.stringify([
      { name: 'lat', label: 'Latitude', placeholder: 'e.g. 45.5017' },
      { name: 'lon', label: 'Longitude', placeholder: 'e.g. -73.5673' },
    ]),
    is_builtin: 1,
  },
]

export function seedBuiltinConnectors(): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO connectors
      (id, name, description, url_template, method, headers_json, body_template, variables_json, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const c of BUILTIN_CONNECTORS) {
    insert.run(c.id, c.name, c.description, c.url_template, c.method, c.headers_json, c.body_template, c.variables_json, c.is_builtin)
  }
}

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM connectors').all()
  res.json(rows)
})

router.post('/', (req: Request, res: Response) => {
  const { name, description, url_template, method, headers_json, body_template, variables_json } = req.body as {
    name: string
    description?: string
    url_template: string
    method?: string
    headers_json?: string
    body_template?: string
    variables_json?: string
  }
  const id = randomUUID()
  db.prepare(`
    INSERT INTO connectors (id, name, description, url_template, method, headers_json, body_template, variables_json, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, name, description ?? null, url_template, method ?? 'GET', headers_json ?? '[]', body_template ?? null, variables_json ?? '[]')
  res.json({ id, ok: true })
})

router.put('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT is_builtin FROM connectors WHERE id = ?').get(req.params.id) as { is_builtin: number } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.is_builtin) return res.status(403).json({ error: 'Cannot modify built-in connectors' })

  const { name, description, url_template, method, headers_json, body_template, variables_json } = req.body as {
    name: string; description?: string; url_template: string
    method?: string; headers_json?: string; body_template?: string; variables_json?: string
  }
  db.prepare(`
    UPDATE connectors SET name=?, description=?, url_template=?, method=?, headers_json=?, body_template=?, variables_json=? WHERE id=?
  `).run(name, description ?? null, url_template, method ?? 'GET', headers_json ?? '[]', body_template ?? null, variables_json ?? '[]', req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT is_builtin FROM connectors WHERE id = ?').get(req.params.id) as { is_builtin: number } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  if (row.is_builtin) return res.status(403).json({ error: 'Cannot delete built-in connectors' })
  db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
