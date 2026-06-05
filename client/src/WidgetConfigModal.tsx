import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * Generic modal dialog for editing widget configuration.
 * Rendered via createPortal into document.body, so it sits above all other stacking contexts.
 * Closes on Escape key or backdrop click without calling onSave.
 */
interface Props {
  isOpen: boolean
  /** Called when the user cancels — does NOT call onSave. Also triggered by Escape and backdrop click. */
  onClose: () => void
  /** Called when the user clicks Save — the caller is responsible for closing the modal afterwards. */
  onSave: () => void
  title: string
  children: ReactNode
}

export default function WidgetConfigModal({ isOpen, onClose, onSave, title, children }: Props) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }} role='dialog'>
      <div className="modal">
        <h2 className="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="modal-btn" onClick={onClose}>Cancel</button>
          <button className="modal-btn modal-btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
