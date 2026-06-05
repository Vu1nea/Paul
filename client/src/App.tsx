import './App.css'
import ScriptsView from './views/ScriptsView'
import SecretsView from './views/SecretsView'
import PipelineBuilderView from './views/pipeline/PipelineBuilderView'
import DashboardView from './views/DashboardView'

/**
 * Root router. Navigation is driven entirely by URL query params — no client-side
 * router library. Supported params:
 *   ?view=scripts              → ScriptsView
 *   ?view=secrets              → SecretsView
 *   ?view=pipeline&id=<id>     → PipelineBuilderView for the given source ID
 *   (default)                  → DashboardView
 */
function App() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  const sourceId = params.get('id')

  if (view === 'scripts') return <ScriptsView />
  if (view === 'secrets') return <SecretsView />
  if (view === 'pipeline' && sourceId) return <PipelineBuilderView sourceId={sourceId} />
  return <DashboardView />
}

export default App
