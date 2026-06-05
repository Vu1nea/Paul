import { useState, useEffect, useRef } from 'react'
import { getLayout, saveLayout, getSources, getSource, getWeather } from './api'
import type { Source, WidgetConfigs } from './api'
import ReactGridLayout, { useContainerWidth, useResponsiveLayout } from 'react-grid-layout'
import type { LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './App.css'
import { PlaceholderWidget, WeatherWidget, ScriptWidget } from './widgets'
import type { WeatherConfig, WeatherData, ScriptConfig } from './widgets'
import WidgetConfigModal from './WidgetConfigModal'
import WeatherConfigForm from './WeatherConfigForm'
import ScriptsView from './views/ScriptsView'
import SecretsView from './views/SecretsView'
import PipelineBuilderView from './views/PipelineBuilderView'

const defaultLayouts = {
  lg: [
    { i: 'placeholder-1', x: 0, y: 0, w: 4, h: 3 },
    { i: 'placeholder-2', x: 4, y: 0, w: 4, h: 3 },
    { i: 'weather-1', x: 8, y: 0, w: 4, h: 3 },
  ],
}

const defaultWidgetConfigs: WidgetConfigs = {
  'placeholder-1': { type: 'placeholder', config: { label: 'Widget 1' } },
  'placeholder-2': { type: 'placeholder', config: { label: 'Widget 2' } },
  'weather-1': { type: 'weather', config: { city: 'Montreal', latitude: 45.5017, longitude: -73.5673, units: 'imperial' } },
}

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return prefix ? [prefix] : []
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return flattenKeys(v, path)
    return [path]
  })
}

function App() {
  const view = new URLSearchParams(window.location.search).get('view')
  const sourceId = new URLSearchParams(window.location.search).get('id')
  

  const [weatherDataMap, setWeatherDataMap] = useState<Record<string, WeatherData | { error: true } | null>>({})
  const [scriptDataMap, setScriptDataMap] = useState<Record<string, Record<string, unknown> | null>>({})
  const [initialLayouts, setInitialLayouts] = useState<typeof defaultLayouts | null>(null)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfigs>(defaultWidgetConfigs)
  const [openModalId, setOpenModalId] = useState<string | null>(null)
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({})
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [availableSources, setAvailableSources] = useState<Source[]>([])
  const [saveError, setSaveError] = useState(false)

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveErrorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widgetConfigsRef = useRef(widgetConfigs)
  widgetConfigsRef.current = widgetConfigs
  const layoutLoadedRef = useRef(false)
  layoutLoadedRef.current = layoutLoaded

  function showSaveError() {
    setSaveError(true)
    if (saveErrorTimeout.current) clearTimeout(saveErrorTimeout.current)
    saveErrorTimeout.current = setTimeout(() => setSaveError(false), 3000)
  }
  const showSaveErrorRef = useRef(showSaveError)
  showSaveErrorRef.current = showSaveError

  const { width, containerRef, mounted } = useContainerWidth()
  const { layout, layouts, cols, setLayouts, setLayoutForBreakpoint, breakpoint } = useResponsiveLayout({
    width,
    breakpoints: { lg: 1200 },
    cols: { lg: 12 },
    layouts: initialLayouts ?? defaultLayouts,
    onLayoutChange: (_layout, allLayouts) => {
      if (!layoutLoadedRef.current) return
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        saveLayout(allLayouts, widgetConfigsRef.current).catch(() => showSaveErrorRef.current())
      }, 1000)
    },
  })

  const weatherKey = Object.entries(widgetConfigs)
    .filter(([, w]) => w.type === 'weather')
    .map(([id, { config }]) => { const c = config as WeatherConfig; return `${id}:${c.latitude}:${c.longitude}:${c.units}` })
    .sort().join('|')

  const scriptKey = Object.entries(widgetConfigs)
    .filter(([, w]) => w.type === 'script')
    .map(([id, { config }]) => `${id}:${(config as ScriptConfig).sourceId}`)
    .sort().join('|')

  useEffect(() => {
    getLayout()
      .then(data => {
        if (data.layout) {
          setInitialLayouts(data.layout as typeof defaultLayouts)
          setLayouts(data.layout as typeof defaultLayouts)
        }
        if (Object.keys(data.configs).length > 0) {
          setWidgetConfigs(data.configs)
        }
      })
      .catch(() => {})
      .finally(() => setLayoutLoaded(true))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    for (const [id, { config }] of Object.entries(widgetConfigsRef.current).filter(([, w]) => w.type === 'weather')) {
      const { latitude, longitude, units } = config as WeatherConfig
      setWeatherDataMap(prev => ({ ...prev, [id]: null }))
      getWeather(latitude, longitude, units ?? 'metric', controller.signal)
        .then(data => setWeatherDataMap(prev => ({ ...prev, [id]: data as WeatherData })))
        .catch(err => { if ((err as Error).name !== 'AbortError') setWeatherDataMap(prev => ({ ...prev, [id]: { error: true } })) })
    }
    return () => controller.abort()
  }, [weatherKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController()
    for (const [id, { config }] of Object.entries(widgetConfigsRef.current).filter(([, w]) => w.type === 'script')) {
      const { sourceId: sid } = config as ScriptConfig
      if (!sid) continue
      setScriptDataMap(prev => ({ ...prev, [id]: null }))
      getSource(sid, controller.signal)
        .then(data => setScriptDataMap(prev => ({ ...prev, [id]: data.last_output ?? null })))
        .catch(err => { if ((err as Error).name !== 'AbortError') setScriptDataMap(prev => ({ ...prev, [id]: { error: 'Failed to load' } })) })
    }
    return () => controller.abort()
  }, [scriptKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGearClick(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenModalId(id)
    setDraftConfig({ ...widgetConfigs[id]?.config })
    if (widgetConfigs[id]?.type === 'script') {
      getSources().then(setAvailableSources).catch(() => {})
    }
  }

  function handleConfigSave() {
    if (openModalId === null) return
    const updatedConfigs: WidgetConfigs = { ...widgetConfigs, [openModalId]: { ...widgetConfigs[openModalId]!, config: draftConfig } }
    setWidgetConfigs(updatedConfigs)
    saveLayout(layouts, updatedConfigs).catch(showSaveError)
    setOpenModalId(null)
  }

  function handleAddWidget(type: 'placeholder' | 'weather' | 'script') {
    const id = crypto.randomUUID()
    const bottomY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
    const newItem: LayoutItem = { i: id, x: 0, y: bottomY, w: 4, h: 3 }
    const defaultConfig =
      type === 'weather' ? { city: 'Montreal', latitude: 45.5017, longitude: -73.5673, units: 'metric' } :
      type === 'script'  ? { sourceId: '', displayKey: '', label: 'My Metric' } :
                           { label: 'New Widget' }
    const newLayout = [...layout, newItem]
    setLayoutForBreakpoint(breakpoint, newLayout)
    const updatedConfigs: WidgetConfigs = { ...widgetConfigs, [id]: { type, config: defaultConfig } }
    setWidgetConfigs(updatedConfigs)
    setShowAddPanel(false)
    saveLayout({ lg: newLayout }, updatedConfigs).catch(showSaveError)
  }

  function handleRemoveWidget(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Remove this widget?')) return
    const newLayout = layout.filter(item => item.i !== id)
    setLayoutForBreakpoint(breakpoint, newLayout)
    const updatedConfigs = { ...widgetConfigs }
    delete updatedConfigs[id]
    setWidgetConfigs(updatedConfigs)
    saveLayout({ lg: newLayout }, updatedConfigs).catch(showSaveError)
  }

  function renderWidget(id: string, entry: { type: string; config: Record<string, unknown> }) {
    if (entry.type === 'weather') {
      return <WeatherWidget config={entry.config as WeatherConfig} data={weatherDataMap[id] ?? null} />
    }
    if (entry.type === 'script') {
      return <ScriptWidget config={entry.config as ScriptConfig} data={scriptDataMap[id] ?? null} />
    }
    return <PlaceholderWidget config={entry.config as { label: string }} data={{}} />
  }

  if (view === 'scripts') return <ScriptsView />
  if (view === 'secrets') return <SecretsView />
  if (view === 'pipeline' && sourceId) return <PipelineBuilderView sourceId={sourceId} />

  return (
    <div className="app">
      <header className="app-header">
        <h1>Paul</h1>
        <nav className="app-nav">
          <a href="?">Dashboard</a>
          <a href="?view=scripts">Scripts</a>
          <a href="?view=secrets">Secrets</a>
        </nav>
        <div className="add-widget-wrap">
          <button className="add-widget-btn" onClick={() => setShowAddPanel(p => !p)}>+ Add Widget</button>
          {showAddPanel && (
            <div className="add-widget-panel">
              <button onClick={() => handleAddWidget('placeholder')}>Placeholder</button>
              <button onClick={() => handleAddWidget('weather')}>Weather</button>
              <button onClick={() => handleAddWidget('script')}>Script</button>
            </div>
          )}
        </div>
      </header>
      <main ref={containerRef}>
        {mounted && layoutLoaded && (
          <ReactGridLayout
            width={width} layout={layout}
            gridConfig={{ cols, rowHeight: 100 }}
            onLayoutChange={(newLayout) => setLayoutForBreakpoint(breakpoint, newLayout)}
            dragConfig={{ cancel: '.widget-gear, .widget-remove' }}
          >
            {layout.filter(item => item.i in widgetConfigs).map(item => {
              const entry = widgetConfigs[item.i]!
              return (
                <div key={item.i} className="widget" data-widget-id={item.i}>
                  {renderWidget(item.i, entry)}
                  <button className="widget-gear" onClick={e => handleGearClick(item.i, e)} onMouseDown={e => e.stopPropagation()}>⚙</button>
                  <button className="widget-remove" onClick={e => handleRemoveWidget(item.i, e)} onMouseDown={e => e.stopPropagation()}>×</button>
                </div>
              )
            })}
          </ReactGridLayout>
        )}
      </main>
      {openModalId !== null && (
        <WidgetConfigModal isOpen={true} onClose={() => setOpenModalId(null)} onSave={handleConfigSave} title={`Configure ${widgetConfigs[openModalId]?.type ?? 'widget'}`}>
          {widgetConfigs[openModalId]?.type === 'weather' ? (
            <WeatherConfigForm config={draftConfig} onChange={setDraftConfig} />
          ) : widgetConfigs[openModalId]?.type === 'script' ? (
            <div className="config-form">
              <label>Source
                <select value={String(draftConfig.sourceId ?? '')} onChange={e => setDraftConfig(c => ({ ...c, sourceId: e.target.value, displayKey: '' }))}>
                  <option value="">— select a source —</option>
                  {availableSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>Display Key
                {(() => {
                  const selectedId = String(draftConfig.sourceId ?? '')
                  const src = availableSources.find(s => s.id === selectedId)
                  const keys = src ? flattenKeys(src.last_output) : []
                  if (!selectedId) return <select disabled><option>— pick a source first —</option></select>
                  if (keys.length === 0) return (
                    <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <select disabled><option>— no output yet —</option></select>
                      <button type="button" onClick={() => getSources().then(setAvailableSources).catch(() => {})}>↻</button>
                    </span>
                  )
                  return (
                    <select value={String(draftConfig.displayKey ?? '')} onChange={e => setDraftConfig(c => ({ ...c, displayKey: e.target.value }))}>
                      <option value="">— select a key —</option>
                      {keys.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  )
                })()}
              </label>
              <label>Label<input value={String(draftConfig.label ?? '')} onChange={e => setDraftConfig(c => ({ ...c, label: e.target.value }))} /></label>
            </div>
          ) : (
            <div className="config-form">
              <label>Label<input value={String(draftConfig.label ?? '')} onChange={e => setDraftConfig(c => ({ ...c, label: e.target.value }))} /></label>
            </div>
          )}
        </WidgetConfigModal>
      )}
      {saveError && (
        <div style={{ position: 'fixed', bottom: '16px', right: '16px', background: '#c33', color: '#fff', padding: '8px 14px', borderRadius: '4px', fontSize: '13px', zIndex: 9999 }}>
          Failed to save layout
        </div>
      )}
    </div>
  )
}

export default App
