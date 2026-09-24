import { PRIORITIES } from '../lib/constants'

/** Four small bars, filled up to the level. Its own visual language, so it never reads as a status. */
export default function PriorityTag({ priority }) {
  const level = PRIORITIES.indexOf(priority) + 1
  return (
    <span className="prio" data-priority={priority}>
      <span className="prio-bars" aria-hidden="true">
        {PRIORITIES.map((p, i) => <i key={p} className={i < level ? 'on' : ''} />)}
      </span>
      {priority}
    </span>
  )
}
