import { useState, useEffect, useRef } from 'react'
import ReactGridLayout, { useContainerWidth, useResponsiveLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './App.css'
import { PlaceholderWidget, WeatherWidget } from './widgets'
import type { WeatherConfig, WeatherData } from './widgets'
import WidgetConfigModal from './WidgetConfigModal'
import WeatherConfigForm from './WeatherConfigForm'

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

  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'unreachable'>('checking')
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [initialLayouts, setInitialLayouts] = useState<typeof defaultLayouts | null>(null)
  const [widgetConfigs, setWidgetConfigs] = useState<WidgetConfigs>(defaultWidgetConfigs)
  const [openModalId, setOpenModalId] = useState<string | null>(null)
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({})

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const widgetConfigsRef = useRef(widgetConfigs)
  widgetConfigsRef.current = widgetConfigs

  const { width, containerRef, mounted } = useContainerWidth()

  const { layout, layouts, cols, setLayouts, setLayoutForBreakpoint, breakpoint } = useResponsiveLayout({
    width,
    breakpoints: { lg: 1200 },
    cols: { lg: 12 },
    layouts: initialLayouts ?? defaultLayouts,
    onLayoutChange: (_layout, allLayouts) => {
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

  const weatherConfig = (widgetConfigs['weather-1']?.config ?? defaultWidgetConfigs['weather-1'].config) as unknown as WeatherConfig

  useEffect(() => {
    fetch(`${apiUrl}/health`)
      .then(res => res.json())
      .then(() => setServerStatus('connected'))
      .catch(() => setServerStatus('unreachable'))
  }, [apiUrl])

  useEffect(() => {
    fetch(`${apiUrl}/api/layout`)
      .then(res => res.json())
      .then(data => {
        if (data?.layout) {
          setInitialLayouts(data.layout)
          setLayouts(data.layout)
        }
        if (data?.configs && Object.keys(data.configs).length > 0) {
          setWidgetConfigs(data.configs)
        }
      })
      .catch(() => {})
  }, [apiUrl])

  useEffect(() => {
    setWeatherData(null)
    fetch(
      `${apiUrl}/api/weather?latitude=${weatherConfig.latitude}&longitude=${weatherConfig.longitude}&units=${weatherConfig.units}`
    )
      .then(res => res.json())
      .then(data => setWeatherData(data as WeatherData))
      .catch(() => setWeatherData(null))
  }, [apiUrl, weatherConfig.latitude, weatherConfig.longitude, weatherConfig.units])

  function handleGearClick(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenModalId(id)
    setDraftConfig({ ...widgetConfigs[id]?.config })
  }

  function handleConfigSave() {
    if (openModalId === null) return
    const updatedConfigs: WidgetConfigs = {
      ...widgetConfigs,
      [openModalId]: { ...widgetConfigs[openModalId]!, config: draftConfig },
    }
    setWidgetConfigs(updatedConfigs)
    fetch(`${apiUrl}/api/layout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: layouts, configs: updatedConfigs }),
    })
    setOpenModalId(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Paul</h1>
        <span className={`server-status ${serverStatus}`}>
          {serverStatus === 'connected'
            ? 'Server connected'
            : serverStatus === 'unreachable'
              ? 'Server unreachable'
              : 'Checking...'}
        </span>
      </header>
      <main ref={containerRef}>
        {mounted && (
          <ReactGridLayout
            width={width}
            layout={layout}
            gridConfig={{ cols, rowHeight: 100 }}
            onLayoutChange={(newLayout) => setLayoutForBreakpoint(breakpoint, newLayout)}
            dragConfig={{ cancel: '.widget-gear' }}
          >
            <div key="placeholder-1" className="widget">
              <PlaceholderWidget config={widgetConfigs['placeholder-1']?.config as { label: string }} data={{}} />
              <button className="widget-gear" onClick={(e) => handleGearClick('placeholder-1', e)}>⚙</button>
            </div>
            <div key="placeholder-2" className="widget">
              <PlaceholderWidget config={widgetConfigs['placeholder-2']?.config as { label: string }} data={{}} />
              <button className="widget-gear" onClick={(e) => handleGearClick('placeholder-2', e)}>⚙</button>
            </div>
            <div key="weather-1" className="widget">
              <WeatherWidget config={weatherConfig} data={weatherData} />
              <button className="widget-gear" onClick={(e) => handleGearClick('weather-1', e)}>⚙</button>
            </div>
          </ReactGridLayout>
        )}
      </main>

      {openModalId !== null && (
        <WidgetConfigModal
          isOpen={true}
          onClose={() => setOpenModalId(null)}
          onSave={handleConfigSave}
          title={`Configure ${widgetConfigs[openModalId]?.type ?? 'widget'}`}
        >
          {widgetConfigs[openModalId]?.type === 'weather' ? (
            <WeatherConfigForm config={draftConfig} onChange={setDraftConfig} />
          ) : (
            <div className="config-form">
              <label>
                Label
                <input
                  value={String(draftConfig.label ?? '')}
                  onChange={e => setDraftConfig(c => ({ ...c, label: e.target.value }))}
                />
              </label>
            </div>
          )}
        </WidgetConfigModal>
      )}
    </div>
  )
}

export default App
