import { useState, useEffect, useRef } from 'react'
import ReactGridLayout, { useContainerWidth, useResponsiveLayout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './App.css'
import { PlaceholderWidget, WeatherWidget } from './widgets'
import type { WeatherConfig, WeatherData } from './widgets'

const defaultLayouts = {
  lg: [
    { i: 'placeholder-1', x: 0, y: 0, w: 4, h: 3 },
    { i: 'placeholder-2', x: 4, y: 0, w: 4, h: 3 },
    { i: 'weather-1', x: 8, y: 0, w: 4, h: 3 },
  ],
}

const weatherConfig: WeatherConfig = {
  city: 'Montreal',
  latitude: 45.5017,
  longitude: -73.5673,
  units: 'metric',
}

function App() {
  const apiUrl = import.meta.env.VITE_API_URL as string

  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'unreachable'>('checking')
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [initialLayouts, setInitialLayouts] = useState<typeof defaultLayouts | null>(null)

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { width, containerRef, mounted } = useContainerWidth()

  const { layout, cols, setLayouts, setLayoutForBreakpoint, breakpoint } = useResponsiveLayout({
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
          body: JSON.stringify(allLayouts),
        })
      }, 1000)
    },
  })

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
        if (data) {
          setInitialLayouts(data)
          setLayouts(data)
        }
      })
      .catch(() => {})
  }, [apiUrl])

  useEffect(() => {
    fetch(
      `${apiUrl}/api/weather?latitude=${weatherConfig.latitude}&longitude=${weatherConfig.longitude}&units=${weatherConfig.units}`
    )
      .then(res => res.json())
      .then(data => setWeatherData(data as WeatherData))
      .catch(() => setWeatherData(null))
  }, [apiUrl])

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
          >
            <div key="placeholder-1" className="widget">
              <PlaceholderWidget config={{ label: 'Widget 1' }} data={{}} />
            </div>
            <div key="placeholder-2" className="widget">
              <PlaceholderWidget config={{ label: 'Widget 2' }} data={{}} />
            </div>
            <div key="weather-1" className="widget">
              <WeatherWidget config={weatherConfig} data={weatherData} />
            </div>
          </ReactGridLayout>
        )}
      </main>
    </div>
  )
}

export default App
