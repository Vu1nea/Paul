import { useState, useRef } from 'react'

/**
 * Config form for the WeatherWidget. Provides a debounced city search (400 ms)
 * backed by the Open-Meteo geocoding API. Selecting a city populates latitude and
 * longitude automatically — the user never enters coordinates manually.
 */

/** A single result from the Open-Meteo geocoding API (geocoding-api.open-meteo.com). */
interface GeoResult {
  name: string
  /** State or region — may be absent for some locations. */
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

interface Props {
  config: Record<string, unknown>
  /** Called on every user action that changes the config (city select, units toggle). */
  onChange: (config: Record<string, unknown>) => void
}

export default function WeatherConfigForm({ config, onChange }: Props) {
  const [search, setSearch] = useState(String(config.city ?? ''))
  const [results, setResults] = useState<GeoResult[]>([])
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(value: string) {
    setSearch(value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=5`
        )
        const data = await res.json() as { results?: GeoResult[] }
        setResults(data.results ?? [])
      } catch {
        setResults([])
      }
    }, 400)
  }

  function handleSelect(result: GeoResult) {
    const label = [result.name, result.admin1, result.country].filter(Boolean).join(', ')
    onChange({ ...config, city: label, latitude: result.latitude, longitude: result.longitude })
    setSearch(label)
    setResults([])
  }

  return (
    <div className="config-form">
      <label>
        City
        <div className="city-search">
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            onBlur={() => setTimeout(() => setResults([]), 150)}
            placeholder="Search for a city..."
          />
          {results.length > 0 && (
            <ul className="city-results">
              {results.map((r, i) => (
                <li key={i} onMouseDown={() => handleSelect(r)}>
                  {[r.name, r.admin1, r.country].filter(Boolean).join(', ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      </label>
      <label>
        Units
        <select
          value={String(config.units ?? 'metric')}
          onChange={e => onChange({ ...config, units: e.target.value })}
        >
          <option value="metric">Metric (°C, km/h)</option>
          <option value="imperial">Imperial (°F, mph)</option>
        </select>
      </label>
    </div>
  )
}
