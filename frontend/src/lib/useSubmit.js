import { useState } from 'react'

/** Shared by every dialog: run one request from the form, report its error, hand back when done. */
export function useSubmit(request, onDone) {
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      await request(new FormData(event.currentTarget))
      await onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return { error, busy, submit }
}
