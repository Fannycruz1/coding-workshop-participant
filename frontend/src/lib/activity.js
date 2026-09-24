// The API has no status-change history route, so the app writes each status
// change and escalation into the incident's notes as a short structured line,
// and the feed reads them back out. A note that isn't one of these is a plain note.

const reasonLine = (reason) => (reason ? `\nReason: ${reason}` : '')

export const statusNote = (from, to, reason) => `Changed status from ${from} to ${to}${reasonLine(reason)}`
export const escalationNote = (from, to, reason) => `Requested escalation from ${from} to ${to}${reasonLine(reason)}`
export const decisionNote = (approved, to) => `${approved ? 'Approved' : 'Rejected'} the escalation to ${to}`

const PATTERNS = [
  ['status', /^Changed status from (.+?) to (.+?)(?:\nReason: ([\s\S]+))?$/],
  ['escalation', /^Requested escalation from (.+?) to (.+?)(?:\nReason: ([\s\S]+))?$/],
  ['decision', /^(Approved|Rejected) the escalation to (.+)$/],
]

/** {kind, from, to, reason, approved} for a structured note body, or null for a plain one. */
export function parseNote(body) {
  for (const [kind, pattern] of PATTERNS) {
    const m = body.match(pattern)
    if (!m) continue
    if (kind === 'decision') return { kind, approved: m[1] === 'Approved', to: m[2] }
    return { kind, from: m[1], to: m[2], reason: m[3] }
  }
  return null
}
