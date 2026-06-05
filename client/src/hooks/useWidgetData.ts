import { useState, useEffect } from 'react'
import { getSource, getWeather } from '../api'
import type { WidgetConfigs } from '@paul/types'
import type { WeatherConfig, WeatherData, ScriptConfig } from '../widgets'

/**
 * Fetches live data for all weather and script widgets on the dashboard.
 *
 * Dependency keys (weatherKey, scriptKey) are stable strings derived from each
 * widget's config. Effects only re-fire when those keys change, avoiding
 * unnecessary fetches on unrelated re-renders. Each effect creates an
 * AbortController so in-flight requests are cancelled when configs change.
 *
 * Returns two maps keyed by widget ID: weatherDataMap and scriptDataMap.
 * In both maps, null means the fetch is in flight.
 * weatherDataMap failure value: { error: true }
 * scriptDataMap failure value: { error: 'Failed to load' }
 */
export function useWidgetData(widgetConfigs: WidgetConfigs) {
  const [weatherDataMap, setWeatherDataMap] = useState<Record<string, WeatherData | { error: true } | null>>({})
  const [scriptDataMap, setScriptDataMap] = useState<Record<string, Record<string, unknown> | null>>({})

  const weatherKey = Object.entries(widgetConfigs)
    .filter(([, w]) => w.type === 'weather')
    .map(([id, { config }]) => { const c = config as unknown as WeatherConfig; return `${id}:${c.latitude}:${c.longitude}:${c.units}` })
    .sort().join('|')

  const scriptKey = Object.entries(widgetConfigs)
    .filter(([, w]) => w.type === 'script')
    .map(([id, { config }]) => `${id}:${(config as unknown as ScriptConfig).sourceId}`)
    .sort().join('|')

  useEffect(() => {
    const controller = new AbortController()
    for (const [id, { config }] of Object.entries(widgetConfigs).filter(([, w]) => w.type === 'weather')) {
      const { latitude, longitude, units } = config as unknown as WeatherConfig
      setWeatherDataMap(prev => ({ ...prev, [id]: null }))
      getWeather(latitude, longitude, units ?? 'metric', controller.signal)
        .then(data => setWeatherDataMap(prev => ({ ...prev, [id]: data as WeatherData })))
        .catch(err => { if ((err as Error).name !== 'AbortError') setWeatherDataMap(prev => ({ ...prev, [id]: { error: true } })) })
    }
    return () => controller.abort()
  }, [weatherKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController()
    for (const [id, { config }] of Object.entries(widgetConfigs).filter(([, w]) => w.type === 'script')) {
      const { sourceId: sid } = config as unknown as ScriptConfig
      if (!sid) continue
      setScriptDataMap(prev => ({ ...prev, [id]: null }))
      getSource(sid, controller.signal)
        .then(data => setScriptDataMap(prev => ({ ...prev, [id]: (data.last_output ?? null) as Record<string, unknown> | null })))
        .catch(err => { if ((err as Error).name !== 'AbortError') setScriptDataMap(prev => ({ ...prev, [id]: { error: 'Failed to load' } as Record<string, unknown> })) })
    }
    return () => controller.abort()
  }, [scriptKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return { weatherDataMap, scriptDataMap }
}
