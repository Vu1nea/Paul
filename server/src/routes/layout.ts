import { Router, Request, Response } from 'express'
import db from '../db'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const layoutRow = db.prepare('SELECT layout_json FROM layouts WHERE id = ?').get('main') as { layout_json: string } | undefined
  const widgetRows = db.prepare('SELECT id, type, config_json FROM widgets').all() as { id: string; type: string; config_json: string }[]
  const configs: Record<string, { type: string; config: unknown }> = {}
  for (const row of widgetRows) {
    configs[row.id] = { type: row.type, config: JSON.parse(row.config_json) }
  }
  res.json({ layout: layoutRow ? JSON.parse(layoutRow.layout_json) : null, configs })
})

router.post('/', (req: Request, res: Response) => {
  const { layout, configs } = req.body as {
    layout: unknown
    configs?: Record<string, { type: string; config: unknown }>
  }
  db.prepare('INSERT OR REPLACE INTO layouts (id, layout_json) VALUES (?, ?)').run('main', JSON.stringify(layout))
  if (configs) {
    const deleteAll = db.prepare('DELETE FROM widgets')
    const insert = db.prepare('INSERT INTO widgets (id, type, config_json) VALUES (?, ?, ?)')
    // Full replace inside a transaction: simpler than diffing and handles deletions automatically.
    const saveWidgets = db.transaction((entries: [string, { type: string; config: unknown }][]) => {
      deleteAll.run()
      for (const [id, { type, config }] of entries) {
        insert.run(id, type, JSON.stringify(config))
      }
    })
    saveWidgets(Object.entries(configs))
  }
  res.json({ ok: true })
})

export default router
