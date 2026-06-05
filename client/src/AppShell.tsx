import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  headerActions?: ReactNode
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
