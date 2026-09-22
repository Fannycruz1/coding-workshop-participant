import { STATUS_COLORS } from '../lib/constants'

/** The status as a coloured pill. Unknown values still render, in grey. */
export default function StatusBadge({ status }) {
  return (
    <span className="badge" style={{ backgroundColor: STATUS_COLORS[status] || '#4b5563' }}>
      {status}
    </span>
  )
}
