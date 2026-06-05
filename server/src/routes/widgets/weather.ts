import { Router, Request, Response } from 'express'

/**
 * GET /api/weather?latitude=&longitude=&units=
 * Proxies Open-Meteo's forecast endpoint and returns only the current_weather fields
 * the client needs: `{ temperature, windspeed, weathercode }`.
 * `units` defaults to 'imperial' if omitted. Translates to Open-Meteo's
 * temperature_unit (celsius/fahrenheit) and windspeed_unit (kmh/mph) params.
 * Returns 500 if the upstream Open-Meteo request fails.
 */
const router = Router()

router.get('/', async (req: Request, res: Response) => {
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

export default router
