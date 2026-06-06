import { useState, useRef } from 'react'
import ReactGridLayout, { useContainerWidth, useResponsiveLayout } from 'react-grid-layout'
import type { LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { getSources, runSource } from '../api'
import type { Source, WidgetConfigs } from '@paul/types'
import { PlaceholderWidget, WeatherWidget, ScriptWidget } from '../widgets'
import type { WeatherConfig, WeatherData, ScriptConfig } from '../widgets'
import AppShell from '../AppShell'
import WidgetConfigModal from '../WidgetConfigModal'
import WeatherConfigForm from '../WeatherConfigForm'
import ScriptWidgetConfigForm from '../ScriptWidgetConfigForm'
import { useLayoutPersistence } from '../hooks/useLayoutPersistence'
import { useWidgetData } from '../hooks/useWidgetData'

const defaultLayouts = {
  lg: [
    { i: 'placeholder-1', x: 0, y: 0, w: 4, h: 3 },
    { i: 'placeholder-2', x: 4, y: 0, w: 4, h: 3 },
    { i: 'weather-1', x: 8, y: 0, w: 4, h: 3 },
  ],
}

/**
 * Main dashboard view — a responsive drag-and-drop grid of widgets.
 *
 * Layout and widget configs are loaded once on mount via useLayoutPersistence.
 * Grid renders only after the layout is loaded (layoutLoaded gate) to prevent
 * a flash of default positions before server data arrives.
 *
 * setLayoutsRef and scheduleSaveRef are stable refs that bridge the
 * useResponsiveLayout hook (called before the persistence hook) back to the
 * functions returned by useLayoutPersistence. This avoids circular hook
 * dependencies while keeping the onLayoutChange callback always up to date.
 *
 * Config edits use persist() (immediate save); drag/resize uses scheduleSave()
 * (debounced 1000 ms) so rapid moves don't flood the server.
 */
export default function DashboardView() {
  const { width, containerRef, mounted } = useContainerWidth()

  // Refs that allow hooks called after useResponsiveLayout to reach back into it
  const setLayoutsRef = useRef<(layouts: Record<string, unknown[]>) => void>(() => {})
  const scheduleSaveRef = useRef<(layouts: Record<string, unknown[]>) => void>(() => {})

  const { layout, layouts, cols, setLayouts, setLayoutForBreakpoint, breakpoint } = useResponsiveLayout({
    width,
    breakpoints: { lg: 1200 },
    cols: { lg: 12 },
    layouts: defaultLayouts,
    onLayoutChange: (_layout, allLayouts) => scheduleSaveRef.current(allLayouts),
  })

  setLayoutsRef.current = setLayouts as (layouts: Record<string, unknown[]>) => void

  const { widgetConfigs, setWidgetConfigs, widgetConfigsRef, layoutLoaded, saveError, scheduleSave, persist } = useLayoutPersistence(setLayoutsRef)
  const { weatherDataMap, scriptDataMap } = useWidgetData(widgetConfigs)

  scheduleSaveRef.current = scheduleSave

  // Modal + panel state
  const [openModalId, setOpenModalId] = useState<string | null>(null)
  const [draftConfig, setDraftConfig] = useState<Record<string, unknown>>({})
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [availableSources, setAvailableSources] = useState<Source[]>([])

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
    persist(layouts, updatedConfigs)
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
    persist({ lg: newLayout }, updatedConfigs)
  }

  function handleRemoveWidget(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Remove this widget?')) return
    const newLayout = layout.filter(item => item.i !== id)
    setLayoutForBreakpoint(breakpoint, newLayout)
    const updatedConfigs = { ...widgetConfigs }
    delete updatedConfigs[id]
    setWidgetConfigs(updatedConfigs)
    persist({ lg: newLayout }, updatedConfigs)
  }

  function renderWidget(id: string, entry: { type: string; config: Record<string, unknown> }) {
    if (entry.type === 'weather') return <WeatherWidget config={entry.config as unknown as WeatherConfig} data={weatherDataMap[id] ?? null} />
    if (entry.type === 'script') return <ScriptWidget config={entry.config as unknown as ScriptConfig} data={scriptDataMap[id] ?? null} />
    return <PlaceholderWidget config={entry.config as unknown as { label: string }} data={{}} />
  }

  const headerActions = (
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
  )

  return (
    <AppShell className="app" headerActions={headerActions}>
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
            <ScriptWidgetConfigForm
              config={draftConfig}
              onChange={setDraftConfig}
              sources={availableSources}
              onRefreshSources={async () => {
                const sid = String(draftConfig.sourceId ?? '')
                if (sid) await runSource(sid).catch(() => {})
                getSources().then(setAvailableSources).catch(() => {})
              }}
            />
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
    </AppShell>
  )
}
