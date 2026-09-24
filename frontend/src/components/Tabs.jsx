import { useId } from 'react'

/** A tab row with arrow-key movement. `panel` is what the selected tab shows. */
export default function Tabs({ tabs, value, onChange, children }) {
  const base = useId()
  const id = (name) => `${base}-${name}`

  function move(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    const at = tabs.indexOf(value)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : step && (at + step + tabs.length) % tabs.length
    if (next === undefined || next === false) return
    event.preventDefault()
    onChange(tabs[next])
    document.getElementById(id(tabs[next]))?.focus()
  }

  return (
    <>
      <div className="tabs" role="tablist" onKeyDown={move}>
        {tabs.map((name) => (
          <button key={name} type="button" role="tab" id={id(name)} aria-selected={value === name} aria-controls={`${base}-panel`}
            tabIndex={value === name ? 0 : -1} onClick={() => onChange(name)}>{name}</button>
        ))}
      </div>
      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={id(value)}>{children}</div>
    </>
  )
}
