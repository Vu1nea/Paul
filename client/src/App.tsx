import './App.css'
import ScriptsView from './views/ScriptsView'
import SecretsView from './views/SecretsView'
import PipelineBuilderView from './views/PipelineBuilderView'
import DashboardView from './views/DashboardView'

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
