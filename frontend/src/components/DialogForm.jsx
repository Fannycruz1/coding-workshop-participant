import Modal from './Modal'

export default function DialogForm({ title, onClose, submit, error, busy, confirm, children }) {
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {children}
        {error && <p role="alert" className="alert top">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary" disabled={busy}>{confirm}</button>
        </div>
      </form>
    </Modal>
  )
}
