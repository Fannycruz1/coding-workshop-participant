/** The status as a tinted label; the colour comes from the CSS, keyed on data-status. */
export default function StatusBadge({ status }) {
  return <span className="badge" data-status={status}>{status}</span>
}
