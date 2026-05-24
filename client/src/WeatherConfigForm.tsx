import { useState, useRef } from 'react'

interface GeoResult {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

interface Props {
  config: Record<string, unknown>
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
