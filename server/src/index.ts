import express, { Request, Response } from 'express'
import cors from 'cors'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

app.get('/api/weather', async (req: Request, res: Response) => {
  const { latitude, longitude, units = 'metric' } = req.query

  const tempUnit = units === 'imperial' ? 'fahrenheit' : 'celsius'
  const windUnit = units === 'imperial' ? 'mph' : 'kmh'

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current_weather=true&temperature_unit=${tempUnit}&windspeed_unit=${windUnit}`

  try {
    const response = await fetch(url)
    const data = await response.json() as { current_weather: { temperature: number; windspeed: number; weathercode: number } }

    res.json({
      temperature: data.current_weather.temperature,
      windspeed: data.current_weather.windspeed,
      weathercode: data.current_weather.weathercode,
    })
  } catch {
    res.status(500).json({ error: 'Failed to fetch weather data' })
  }
})

app.listen(3001, () => console.log('Server running on port 3001'))
