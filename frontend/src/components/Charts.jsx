const pct = (count, total) => (total ? Math.round((count / total) * 100) : 0)

/**
 * A hollow ring, one arc per row. The circle's radius is chosen so its
 * circumference is 100, which lets a share of the total be a dash length in percent.
 */
export function Donut({ rows, colors, unit = 'incidents' }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const drawn = rows.filter((r) => r.count > 0)
  const starts = drawn.map((_, i) => drawn.slice(0, i).reduce((sum, r) => sum + (r.count / total) * 100, 0))

  return (
    <svg className="donut" viewBox="0 0 42 42" role="img"
      aria-label={rows.map((r) => `${r.label}: ${r.count}`).join(', ')}>
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--sunken)" strokeWidth="5" />
      {drawn.map((r, i) => {
        const share = (r.count / total) * 100
        const gap = drawn.length > 1 ? Math.min(0.8, share / 2) : 0
        return (
          <circle key={r.label} cx="21" cy="21" r="15.9155" fill="none" stroke={colors[r.label]} strokeWidth="5"
            strokeDasharray={`${share - gap} ${100 - share + gap}`} strokeDashoffset={25 - starts[i]}>
            <title>{`${r.label}: ${r.count} (${pct(r.count, total)}%)`}</title>
          </circle>
        )
      })}
      <text x="21" y="21.5" textAnchor="middle" className="donut-total">{total}</text>
      <text x="21" y="26.5" textAnchor="middle" className="donut-unit">{unit}</text>
    </svg>
  )
}

/** Label, colour key and count: the numbers behind a ring. */
export function Legend({ rows, colors }) {
  return (
    <table className="legend">
      <thead><tr><th scope="col">Name</th><th scope="col" className="num">Incidents</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td><span className="swatch" style={{ background: colors[r.label] }} />{r.label}</td>
            <td className="num">{r.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** One row per label: name, bar scaled to the biggest, count and share. */
export function Bars({ rows, colors = {}, fallback = 'var(--accent)' }) {
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const most = Math.max(...rows.map((r) => r.count), 1)
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span style={{ width: `${(r.count / most) * 100}%`, background: colors[r.label] ?? fallback }} />
          </span>
          <span className="bar-count">{r.count}</span>
          <span className="bar-share">{pct(r.count, total)}%</span>
        </li>
      ))}
    </ul>
  )
}
