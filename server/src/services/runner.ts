import vm from 'vm'
import * as cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import db from '../db'
import { decryptValue } from './encryption'
import type { DataSource } from '../types'

const activeJobs = new Map<string, ScheduledTask>()

/**
 * Runs a data source script inside a sandboxed VM with a 10s timeout.
 * Persists the return value (or an error message object) to `last_output`.
 */
export async function runScript(source: DataSource): Promise<void> {
  const wrappedScript = `(async () => { ${source.script} })()`
  const getSecret = (key: string): string => {
    const row = db.prepare('SELECT encrypted_value FROM secrets WHERE key = ?').get(key) as { encrypted_value: string } | undefined
    if (!row) throw new Error('Secret not found: ' + key)
    return decryptValue(row.encrypted_value)
  }
  const sandbox = { fetch, console, getSecret, Promise }

  const persistOutput = (data: unknown) =>
    db.prepare('UPDATE data_sources SET last_output = ?, last_run_at = ? WHERE id = ?')
      .run(JSON.stringify(data), new Date().toISOString(), source.id)

  try {
    const result = await vm.runInNewContext(wrappedScript, sandbox, { timeout: 10000 })
    persistOutput(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    persistOutput({ error: message })
  }
}

/** Loads all data sources from the DB and registers a cron job for each. Called once on startup. */
export function startAllCronJobs(): void {
  const sources = db.prepare('SELECT id, name, script, schedule FROM data_sources').all() as DataSource[]
  for (const source of sources) {
    registerCronJob(source)
  }
}

/**
 * Registers (or replaces) the cron job for a single data source.
 * Silently skips sources with an invalid cron schedule.
 */
export function registerCronJob(source: DataSource): void {
  stopCronJob(source.id)
  if (cron.validate(source.schedule)) {
    const task = cron.schedule(source.schedule, () => { runScript(source) })
    activeJobs.set(source.id, task)
  }
}

/** Stops and removes the active cron job for the given source ID. No-op if not running. */
export function stopCronJob(id: string): void {
  const task = activeJobs.get(id)
  if (task) {
    task.stop()
    activeJobs.delete(id)
  }
}
