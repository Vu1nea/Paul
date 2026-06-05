import type { ReactNode } from 'react'

/**
 * Persistent page chrome — header with app title, nav links, and an optional
 * actions slot. Wrap every top-level view with this component.
 */
interface Props {
  children: ReactNode
  /** Optional slot rendered in the header, to the right of the nav links. */
  headerActions?: ReactNode
  /** Root element class name — defaults to 'view', use 'app' on the dashboard to get the full-height grid layout. */
  className?: string
}

export default function AppShell({ children, headerActions, className = 'view' }: Props) {
  return (
    <div className={className}>
      <header className="app-header">
        <h1>Paul</h1>
        <nav className="app-nav">
          <a href="?">Dashboard</a>
          <a href="?view=scripts">Scripts</a>
          <a href="?view=secrets">Secrets</a>
        </nav>
        {headerActions}
      </header>
      {children}
    </div>
  )
}
