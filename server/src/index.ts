import express, { Request, Response } from 'express'
import cors from 'cors'
import db from './db'
import { startAllCronJobs } from './runner'
import { seedBuiltinConnectors } from './seed'
import sourcesRouter from './routes/sources'
import connectorsRouter from './routes/connectors'
import secretsRouter from './routes/secrets'

const app = express()

app.use(cors())
app.use(express.json())

// Existing routes
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

app.get('/api/layout', (req: Request, res: Response) => {
  const layoutRow = db.prepare('SELECT layout_json FROM layouts WHERE id = ?').get('main') as { layout_json: string } | undefined
  const widgetRows = db.prepare('SELECT id, type, config_json FROM widgets').all() as { id: string; type: string; config_json: string }[]
  const configs: Record<string, { type: string; config: unknown }> = {}
  for (const row of widgetRows) {
    configs[row.id] = { type: row.type, config: JSON.parse(row.config_json) }
  }
  res.json({ layout: layoutRow ? JSON.parse(layoutRow.layout_json) : null, configs })
})

app.post('/api/layout', (req: Request, res: Response) => {
  const { layout, configs } = req.body as {
    layout: unknown
    configs?: Record<string, { type: string; config: unknown }>
  }
  db.prepare('INSERT OR REPLACE INTO layouts (id, layout_json) VALUES (?, ?)').run('main', JSON.stringify(layout))
  if (configs) {
    const deleteAll = db.prepare('DELETE FROM widgets')
    const insert = db.prepare('INSERT INTO widgets (id, type, config_json) VALUES (?, ?, ?)')
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

app.get('/api/weather', async (req: Request, res: Response) => {
  const { latitude, longitude, units = 'imperial' } = req.query
  const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius'
  const windUnit = units === 'imperial' ? 'mph' : 'kmh'
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}`
  try {
    const response = await fetch(url)
    const data = await response.json() as { current_weather: { temperature: number; windspeed: number; weathercode: number } }
    res.json({ temperature: data.current_weather.temperature, windspeed: data.current_weather.windspeed, weathercode: data.current_weather.weathercode })
  } catch {
    res.status(500).json({ error: 'Failed to fetch weather data' })
  }
})

// New routes
app.use('/api/sources', sourcesRouter)
app.use('/api/connectors', connectorsRouter)
app.use('/api/secrets', secretsRouter)

// Seed built-ins and start cron jobs
seedBuiltinConnectors()
startAllCronJobs()

app.listen(3001, () => console.log('Server running on port 3001: http://localhost:3001'))
