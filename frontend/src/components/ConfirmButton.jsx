import { useState } from 'react'

import Modal from './Modal'

/** A danger button that asks first, in the same dialog every other action uses. */
export default function ConfirmButton({ label, title = label, prompt, confirmLabel = label, small, onConfirm }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className={`danger${small ? ' small' : ''}`} onClick={() => setOpen(true)}>{label}</button>
      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        <p>{prompt}</p>
        <div className="modal-actions">
          <button type="button" autoFocus onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="danger fill" onClick={() => { setOpen(false); onConfirm() }}>{confirmLabel}</button>
        </div>
      </Modal>
    </>
  )
}
