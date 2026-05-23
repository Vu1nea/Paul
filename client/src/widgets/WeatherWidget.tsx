import type { WidgetProps } from './WidgetBase'

export interface WeatherConfig {
  city: string
  latitude: number
  longitude: number
  units: 'metric' | 'imperial'
}

export interface WeatherData {
  temperature: number
  windspeed: number
  weathercode: number
}

const weatherDescriptions: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Icy fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight showers',
  81: 'Moderate showers',
  82: 'Violent showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with heavy hail',
}

export function WeatherWidget({ config, data }: WidgetProps<WeatherConfig, WeatherData>) {
  if (!data) return <div style={{ padding: '8px' }}>Loading weather...</div>

  const tempUnit = config.units === 'imperial' ? '°F' : '°C'
  const windUnit = config.units === 'imperial' ? 'mph' : 'km/h'
  const description = weatherDescriptions[data.weathercode] ?? 'Unknown'

  return (
    <div style={{ padding: '8px' }}>
      <strong>{config.city}</strong>
      <p style={{ margin: '4px 0' }}>{description}</p>
      <p style={{ margin: '4px 0', fontSize: '24px' }}>{data.temperature}{tempUnit}</p>
      <p style={{ margin: '4px 0', color: '#666' }}>Wind: {data.windspeed} {windUnit}</p>
    </div>
  )
}
