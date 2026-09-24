import { useState } from 'react'

import { Bars, Donut, Legend } from '../components/Charts'
import PageHeader from '../components/PageHeader'
import Tabs from '../components/Tabs'
import { CATEGORIES, FETCH_LIMIT, PRIORITIES, STATUSES } from '../lib/constants'
import { averageResolutionMs, countBy, formatDuration, openVsResolved } from '../lib/reports'
import { useIncidentData } from '../lib/useIncidentData'

const STATUS_COLORS = {
  Open: 'var(--chart-open)', 'In Progress': 'var(--chart-progress)', Blocked: 'var(--chart-blocked)',
  Resolved: 'var(--chart-resolved)', Closed: 'var(--chart-closed)',
}
const OPEN_COLORS = { 'Still open': 'var(--chart-progress)', 'Resolved or closed': 'var(--chart-resolved)' }
const PRIORITY_COLORS = { Low: 'var(--prio-low)', Medium: 'var(--prio-medium)', High: 'var(--prio-high)', Critical: 'var(--prio-critical)' }

const TABS = ['Status', 'Open vs. resolved', 'Category', 'Priority', 'Engineer']

export default function Reports() {
  const { incidents, loaded } = useIncidentData()
  const [tab, setTab] = useState('Status')
  const [{ count: open }, { count: finished }] = openVsResolved(incidents)

  const ring = (rows, colors) => (
    <div className="chart-body">
      <Donut rows={rows} colors={colors} />
      <Legend rows={rows} colors={colors} />
    </div>
  )

  const charts = {
    Status: () => ring(countBy(incidents, (i) => i.status, STATUSES), STATUS_COLORS),
    'Open vs. resolved': () => ring(openVsResolved(incidents), OPEN_COLORS),
    Category: () => <Bars rows={countBy(incidents, (i) => i.category, CATEGORIES).filter((r) => r.count).sort((a, b) => b.count - a.count)} />,
    Priority: () => <Bars rows={countBy(incidents, (i) => i.priority, PRIORITIES).reverse()} colors={PRIORITY_COLORS} />,
    Engineer: () => <Bars rows={countBy(incidents, (i) => i.assignee_name || 'Unassigned')} colors={{ Unassigned: 'var(--line-strong)' }} />,
  }

  return (
    <>
      <PageHeader title="Reports" subtitle={incidents.length >= FETCH_LIMIT
        ? `Based on the newest ${FETCH_LIMIT} incidents.` : `Based on all ${incidents.length} incidents.`} />

      <section className="tiles four" aria-label="Summary">
        <div className="tile"><span className="tile-label">Total incidents</span><strong>{incidents.length}</strong></div>
        <div className="tile"><span className="tile-label">Still open</span><strong>{open}</strong></div>
        <div className="tile" data-status="Resolved"><span className="tile-label">Resolved or closed</span><strong>{finished}</strong></div>
        <div className="tile"><span className="tile-label">Average resolution time</span>
          <strong>{formatDuration(averageResolutionMs(incidents))}</strong></div>
      </section>

      <section className="panel chart-panel" aria-label="Incident breakdown">
        <h2>Incidents by</h2>
        <Tabs tabs={TABS} value={tab} onChange={setTab}>
          {!loaded ? <div className="skeleton-block" aria-busy="true" />
            : incidents.length === 0 ? <p className="muted">No incidents to chart yet.</p>
              : charts[tab]()}
        </Tabs>
      </section>
    </>
  )
}
