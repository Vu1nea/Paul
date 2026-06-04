import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import db from '../db'
import { buildScriptFromJson } from '../pipeline'
import type { ConnectorRow } from '../pipeline'
import { registerCronJob, runScript, stopCronJob } from '../services/runner'

const router = Router()

function getConnector(id: string): ConnectorRow | undefined {
  return db.prepare('SELECT id, url_template, method, headers_json, body_template FROM connectors WHERE id = ?')
    .get(id) as ConnectorRow | undefined
}

function parseOutput(raw: string | null): unknown {
  return raw ? JSON.parse(raw) : null
}

function resolveScript(pipelineJson: string | undefined, script: string | undefined): string {
  return pipelineJson ? buildScriptFromJson(pipelineJson, getConnector) : (script ?? '')
}

function fetchSource(id: string) {
  return db.prepare('SELECT id, name, script, schedule FROM data_sources WHERE id = ?').get(id) as {
    id: string; name: string; script: string; schedule: string
  }
}

router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT id, name, schedule, last_output, last_run_at FROM data_sources').all() as {
    id: string; name: string; schedule: string; last_output: string | null; last_run_at: string | null
  }[]
  res.json(rows.map(r => ({ ...r, last_output: parseOutput(r.last_output) })))
})

router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM data_sources WHERE id = ?').get(req.params.id) as {
    id: string; name: string; script: string; pipeline_json: string | null
    schedule: string; last_output: string | null; last_run_at: string | null
  } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({ ...row, last_output: parseOutput(row.last_output) })
})

router.post('/', (req: Request, res: Response) => {
  const { name, script, pipeline_json, schedule } = req.body as {
    name: string; script?: string; pipeline_json?: string; schedule: string
  }
  const id = randomUUID()
  const resolvedScript = resolveScript(pipeline_json, script)
  db.prepare('INSERT INTO data_sources (id, name, script, pipeline_json, schedule) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, resolvedScript, pipeline_json ?? null, schedule)
  registerCronJob(fetchSource(id))
  res.json({ id, ok: true })
})

router.put('/:id', (req: Request, res: Response) => {
  const { name, script, pipeline_json, schedule } = req.body as {
    name: string; script?: string; pipeline_json?: string; schedule: string
  }
  const existing = db.prepare('SELECT id FROM data_sources WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })

  const resolvedScript = resolveScript(pipeline_json, script)
  db.prepare('UPDATE data_sources SET name=?, script=?, pipeline_json=?, schedule=? WHERE id=?')
    .run(name, resolvedScript, pipeline_json ?? null, schedule, req.params.id)
  registerCronJob(fetchSource(req.params.id as string))
  res.json({ ok: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT id FROM data_sources WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM data_sources WHERE id = ?').run(req.params.id)
  stopCronJob(req.params.id as string)
  res.json({ ok: true })
})

router.post('/:id/run', async (req: Request, res: Response) => {
  const row = db.prepare('SELECT id, name, script, schedule FROM data_sources WHERE id = ?').get(req.params.id) as {
    id: string; name: string; script: string; schedule: string
  } | undefined
  if (!row) return res.status(404).json({ error: 'Not found' })
  await runScript(row)
  const updated = db.prepare('SELECT last_output FROM data_sources WHERE id = ?').get(row.id) as { last_output: string | null }
  res.json({ output: parseOutput(updated.last_output) })
})

export default router
