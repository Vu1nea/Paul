import { useState, useEffect, useRef } from 'react'
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

type WidgetConfigs = Record<string, { type: string; config: Record<string, unknown> }>

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

function App() {
  const apiUrl = import.meta.env.VITE_API_URL as string
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

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widgetConfigsRef = useRef(widgetConfigs)
  widgetConfigsRef.current = widgetConfigs
  const layoutLoadedRef = useRef(false)
  layoutLoadedRef.current = layoutLoaded

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
        fetch(`${apiUrl}/api/layout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: allLayouts, configs: widgetConfigsRef.current }),
        })
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
    fetch(`${apiUrl}/api/layout`)
      .then(res => res.json())
      .then(data => {
        if (data?.layout?.lg && Array.isArray(data.layout.lg)) {
          setInitialLayouts(data.layout)
          setLayouts(data.layout)
        }
        if (data?.configs && Object.keys(data.configs).length > 0) {
          setWidgetConfigs(data.configs)
        }
      })
      .catch(() => {})
      .finally(() => setLayoutLoaded(true))
  }, [apiUrl])

  useEffect(() => {
    for (const [id, { config }] of Object.entries(widgetConfigsRef.current).filter(([, w]) => w.type === 'weather')) {
      const { latitude, longitude, units } = config as WeatherConfig
      setWeatherDataMap(prev => ({ ...prev, [id]: null }))
      fetch(`${apiUrl}/api/weather?latitude=${latitude}&longitude=${longitude}&units=${units ?? 'metric'}`)
        .then(res => res.json())
        .then(data => setWeatherDataMap(prev => ({ ...prev, [id]: data as WeatherData })))
        .catch(() => setWeatherDataMap(prev => ({ ...prev, [id]: { error: true } })))
    }
  }, [apiUrl, weatherKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    for (const [id, { config }] of Object.entries(widgetConfigsRef.current).filter(([, w]) => w.type === 'script')) {
      const { sourceId: sid } = config as ScriptConfig
      if (!sid) continue
      setScriptDataMap(prev => ({ ...prev, [id]: null }))
      fetch(`${apiUrl}/api/sources/${sid}`)
        .then(res => res.json())
        .then(data => setScriptDataMap(prev => ({ ...prev, [id]: data.last_output ?? null })))
        .catch(() => setScriptDataMap(prev => ({ ...prev, [id]: { error: 'Failed to load' } })))
    }
  }, [apiUrl, scriptKey]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGearClick(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenModalId(id)
    setDraftConfig({ ...widgetConfigs[id]?.config })
  }

  function handleConfigSave() {
    if (openModalId === null) return
    const updatedConfigs: WidgetConfigs = { ...widgetConfigs, [openModalId]: { ...widgetConfigs[openModalId]!, config: draftConfig } }
    setWidgetConfigs(updatedConfigs)
    fetch(`${apiUrl}/api/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: layouts, configs: updatedConfigs }) })
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
    fetch(`${apiUrl}/api/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: { lg: newLayout }, configs: updatedConfigs }) })
  }

  function handleRemoveWidget(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Remove this widget?')) return
    const newLayout = layout.filter(item => item.i !== id)
    setLayoutForBreakpoint(breakpoint, newLayout)
    const updatedConfigs = { ...widgetConfigs }
    delete updatedConfigs[id]
    setWidgetConfigs(updatedConfigs)
    fetch(`${apiUrl}/api/layout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: { lg: newLayout }, configs: updatedConfigs }) })
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

  if (view === 'scripts') return <ScriptsView apiUrl={apiUrl} />
  if (view === 'secrets') return <SecretsView apiUrl={apiUrl} />
  if (view === 'pipeline' && sourceId) return <PipelineBuilderView apiUrl={apiUrl} sourceId={sourceId} />

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
              <label>Source ID<input value={String(draftConfig.sourceId ?? '')} onChange={e => setDraftConfig(c => ({ ...c, sourceId: e.target.value }))} /></label>
              <label>Display Key<input value={String(draftConfig.displayKey ?? '')} onChange={e => setDraftConfig(c => ({ ...c, displayKey: e.target.value }))} placeholder="e.g. weather.temp" /></label>
              <label>Label<input value={String(draftConfig.label ?? '')} onChange={e => setDraftConfig(c => ({ ...c, label: e.target.value }))} /></label>
            </div>
          ) : (
            <div className="config-form">
              <label>Label<input value={String(draftConfig.label ?? '')} onChange={e => setDraftConfig(c => ({ ...c, label: e.target.value }))} /></label>
            </div>
          )}
        </WidgetConfigModal>
      )}
    </div>
  )
}

export default App
