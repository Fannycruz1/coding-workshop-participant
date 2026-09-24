import { useEffect, useId, useRef } from 'react'

import Icon from './Icon'

/**
 * Every dialog in the app: a title, a close button, and whatever the caller
 * puts inside. Content only exists while open, so a form inside starts fresh each time.
 * Escape and a click on the backdrop both call `onClose`.
 */
export default function Modal({ open = true, title, onClose, children }) {
  const dialog = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const el = dialog.current
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog ref={dialog} className="modal" aria-labelledby={titleId} onClose={onClose}
      onMouseDown={(e) => { if (e.target === dialog.current) onClose() }}>
      {open && (
        <>
          <header className="modal-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
          </header>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  )
}
