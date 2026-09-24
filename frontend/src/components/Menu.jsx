import { useEffect, useRef, useState } from 'react'

/** A button that opens a small panel; closes on outside click, Escape, or picking something in it. */
export default function Menu({ trigger, label, className = '', panelClass = '', keepOpen = false, children }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="menu" ref={box}>
      <button type="button" className={`menu-trigger ${className}`} aria-label={label}
        aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && <div className={`menu-panel ${panelClass}`} onClick={keepOpen ? undefined : () => setOpen(false)}>{children}</div>}
    </div>
  )
}
