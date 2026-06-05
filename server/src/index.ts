import express, { Request, Response } from 'express'
import cors from 'cors'
import { startAllCronJobs } from './services/runner'
import { seedBuiltinConnectors } from './services/seed'
import layoutRouter from './routes/layout'
import weatherRouter from './routes/widgets/weather'
import sourcesRouter from './routes/sources'
import connectorsRouter from './routes/connectors'
import secretsRouter from './routes/secrets'

/**
 * Express server entry point.
 * Routes:
 *   GET  /health              — liveness check
 *   *    /api/layout          — grid layout + widget config persistence
 *   GET  /api/weather         — proxies Open-Meteo current weather
 *   *    /api/sources         — data source CRUD + run-on-demand
 *   *    /api/connectors      — HTTP connector template CRUD
 *   *    /api/secrets         — encrypted secret key/value store
 *
 * Startup order matters: seed runs before startAllCronJobs so built-in
 * connectors exist before any pipeline that references them is scheduled.
 */
const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

app.use('/api/layout', layoutRouter)
app.use('/api/weather', weatherRouter)
app.use('/api/sources', sourcesRouter)
app.use('/api/connectors', connectorsRouter)
app.use('/api/secrets', secretsRouter)

// Seed must run before cron jobs so built-in connectors exist when pipelines resolve them.
seedBuiltinConnectors()
startAllCronJobs()

app.listen(3001, () => console.log('Server running on port 3001: http://localhost:3001'))
