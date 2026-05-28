import { Router, Request, Response } from 'express'
import db from '../db'
import { encryptValue } from '../secrets'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key FROM secrets').all() as { key: string }[]
  res.json({ keys: rows.map(r => r.key) })
})

router.post('/', (req: Request, res: Response) => {
  const { key, value } = req.body as { key: string; value: string }
  const existing = db.prepare('SELECT key FROM secrets WHERE key = ?').get(key)
  if (existing) return res.status(409).json({ error: 'Key already exists' })
  db.prepare('INSERT INTO secrets (key, encrypted_value) VALUES (?, ?)').run(key, encryptValue(value))
  res.json({ ok: true })
})

router.delete('/:key', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT key FROM secrets WHERE key = ?').get(req.params.key)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM secrets WHERE key = ?').run(req.params.key)
  res.json({ ok: true })
})

export default router
