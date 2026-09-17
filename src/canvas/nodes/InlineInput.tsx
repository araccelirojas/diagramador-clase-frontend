import { useEffect, useRef, useState } from 'react'

import { INLINE_INPUT } from '@/canvas/nodes/nodeStyles'

type InlineInputProps = {
  value: string
  onCommit: (value: string) => void
  onCancel: () => void
  className?: string
  selectOnFocus?: boolean
}

/**
 * The inline editor shared by the node name and by member rows.
 *
 * It keeps the in-progress text in local state on purpose: a keystroke is not
 * a document change. Only Enter or blur dispatches a command, which is what
 * keeps the history from filling up with one entry per letter (§9).
 */
export function InlineInput({
  value,
  onCommit,
  onCancel,
  className,
  selectOnFocus = true,
}: InlineInputProps) {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelled = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    input.focus()
    if (selectOnFocus) input.select()
  }, [selectOnFocus])

  const commit = (): void => {
    if (cancelled.current) return

    const trimmed = draft.trim()
    if (trimmed !== '' && trimmed !== value) {
      onCommit(trimmed)
    } else {
      onCancel()
    }
  }

  return (
    <input
      ref={inputRef}
      className={className ? `${INLINE_INPUT} ${className}` : INLINE_INPUT}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit()
          return
        }
        if (event.key === 'Escape') {
          event.preventDefault()
          cancelled.current = true
          onCancel()
        }
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    />
  )
}
