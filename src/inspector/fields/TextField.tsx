import { useState } from 'react'

import { CONTROL, FIELD_LABEL, FIELD_ROW } from '@/inspector/inspectorStyles'

type TextFieldProps = {
  label: string
  value: string | null
  onCommit: (value: string | null) => void
  placeholder?: string
  /** Commits null instead of '' when cleared, for the many nullable fields. */
  nullable?: boolean
  list?: string
  mono?: boolean
}

/**
 * Text input that commits on blur or Enter, NEVER on every keystroke (§9).
 *
 * The in-progress text is local state; the document only changes once. That is
 * what keeps the history from getting one entry per letter typed.
 */
export function TextField({
  label,
  value,
  onCommit,
  placeholder,
  nullable = false,
  list,
  mono = false,
}: TextFieldProps) {
  const [draft, setDraft] = useState(value ?? '')
  const [lastValue, setLastValue] = useState(value)

  // Follow the document when it changes from elsewhere (undo, another field).
  // Adjusting state during render is React's documented pattern for this; an
  // effect here would render twice for every keystroke somewhere else.
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value ?? '')
  }

  const commit = (): void => {
    const trimmed = draft.trim()
    const next = trimmed === '' && nullable ? null : trimmed

    if (next !== (value ?? (nullable ? null : ''))) onCommit(next)
  }

  return (
    <label className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>
      <input
        className={`${CONTROL} ${mono ? 'font-mono' : ''}`}
        value={draft}
        list={list}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            setDraft(value ?? '')
            event.currentTarget.blur()
          }
        }}
      />
    </label>
  )
}
