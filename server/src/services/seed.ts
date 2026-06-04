import db from '../db'

const BUILTIN_CONNECTORS = [
  {
    id: 'builtin-open-meteo',
    name: 'Open-Meteo Weather',
    description: 'Free current weather data. No API key required.',
    url_template: 'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true',
    method: 'GET',
    headers_json: '[]',
    body_template: null,
    variables_json: JSON.stringify([
      { name: 'lat', label: 'Latitude', placeholder: 'e.g. 45.5017' },
      { name: 'lon', label: 'Longitude', placeholder: 'e.g. -73.5673' },
    ]),
    is_builtin: 1,
  },
]

export function seedBuiltinConnectors(): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO connectors
      (id, name, description, url_template, method, headers_json, body_template, variables_json, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const c of BUILTIN_CONNECTORS) {
    insert.run(c.id, c.name, c.description, c.url_template, c.method, c.headers_json, c.body_template, c.variables_json, c.is_builtin)
  }
}
