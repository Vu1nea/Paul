import { useState, useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { getLayout, saveLayout } from '../api'
import type { WidgetConfigs } from '@paul/types'

const defaultWidgetConfigs: WidgetConfigs = {
  'placeholder-1': { type: 'placeholder', config: { label: 'Widget 1' } },
  'placeholder-2': { type: 'placeholder', config: { label: 'Widget 2' } },
  'weather-1': { type: 'weather', config: { city: 'Montreal', latitude: 45.5017, longitude: -73.5673, units: 'imperial' } },
}

/**
 * Loads the persisted layout and widget configs on mount, and exposes helpers
 * to save them back.
 *
 * `setLayoutsRef` is a ref to react-grid-layout's setLayouts, passed as a ref
 * rather than a value so this hook can call it from inside the initial fetch
 * without needing it as an effect dependency.
 *
 * `scheduleSave` debounces layout saves by 1000 ms — called on every drag/resize.
 * It reads widgetConfigs via a ref so the timeout closure always has the latest
 * value without re-scheduling on every config change.
 *
 * `persist` performs an immediate (non-debounced) save — used after config edits
 * and widget add/remove where the user expects instant persistence.
 *
 * `layoutLoaded` gates grid rendering to prevent a flash of default positions
 * before the server layout is applied.
 */
export function useLayoutPersistence(setLayoutsRef: RefObject<(layouts: Record<string, unknown[]>) => void>) {
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfigs>(defaultWidgetConfigs)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const widgetConfigsRef = useRef(widgetConfigs)
  widgetConfigsRef.current = widgetConfigs
  const layoutLoadedRef = useRef(false)
  layoutLoadedRef.current = layoutLoaded
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showSaveError() {
    setSaveError(true)
    if (saveErrorTimeout.current) clearTimeout(saveErrorTimeout.current)
    saveErrorTimeout.current = setTimeout(() => setSaveError(false), 3000)
  }
  const showSaveErrorRef = useRef(showSaveError)
  showSaveErrorRef.current = showSaveError

  useEffect(() => {
    getLayout()
      .then(data => {
        if (data.layout) setLayoutsRef.current(data.layout)
        if (Object.keys(data.configs).length > 0) setWidgetConfigs(data.configs)
      })
      .catch(() => {})
      .finally(() => setLayoutLoaded(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSave(allLayouts: Record<string, unknown[]>) {
    if (!layoutLoadedRef.current) return
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => {
      saveLayout(allLayouts, widgetConfigsRef.current).catch(() => showSaveErrorRef.current())
    }, 1000)
  }

  function persist(layout: Record<string, unknown[]>, configs: WidgetConfigs) {
    saveLayout(layout, configs).catch(showSaveError)
  }

  return { widgetConfigs, setWidgetConfigs, widgetConfigsRef, layoutLoaded, saveError, scheduleSave, persist }
}
