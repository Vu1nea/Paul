import express, { Request, Response } from 'express'
import cors from 'cors'
import { startAllCronJobs } from './runner'
import { seedBuiltinConnectors } from './seed'
import layoutRouter from './routes/layout'
import weatherRouter from './routes/weather'
import sourcesRouter from './routes/sources'
import connectorsRouter from './routes/connectors'
import secretsRouter from './routes/secrets'

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

// Seed built-ins and start cron jobs
seedBuiltinConnectors()
startAllCronJobs()

app.listen(3001, () => console.log('Server running on port 3001: http://localhost:3001'))
