import { useMemo, useState, type ReactNode } from 'react'

import { CONTROL, FIELD_LABEL, FIELD_ROW } from '@/inspector/inspectorStyles'
import { useDiagramStore } from '@/state/useDiagramStore'
import {
  COMMON_DATA_TYPES,
  isBuiltInType,
  modelTypeNames,
  UML_PRIMITIVE_TYPES,
} from '@/uml/model/dataTypes'

/**
 * The type of an attribute, a parameter or a return value: a list to pick from
 * instead of an empty box you have to know what to fill in with.
 *
 * It is a picker, not a cage. `type` is a free string in the model (§5.2), so
 * "Otro…" drops to a text input and a value the list does not know — a generic
 * like `List<Curso>`, a type from a language the editor never heard of — is
 * kept and shown as the current selection instead of being silently dropped.
 * A dropdown that quietly erases what it cannot represent is worse than a box.
 */

/** Empty selection: the model stores null, not ''. */
const NO_TYPE = ''

/** Sentinel for "let me type my own". Checked after the real values, so a type
 *  literally called like this would still win. */
const CUSTOM = '__otro__'

type TypeFieldProps = {
  label?: string
  value: string | null
  onChange: (value: string | null) => void
  /** Sin etiqueta ni rejilla: para una celda de tabla, como la del diálogo de exportación. */
  bare?: boolean
}

export function TypeField({ label = 'Tipo', value, onChange, bare = false }: TypeFieldProps) {
  // A stable reference until the document changes, so the memo below is honest
  // and the selector never hands React a fresh array on every render.
  const nodes = useDiagramStore((state) => state.doc.nodes)
  const modelTypes = useMemo(() => modelTypeNames(nodes), [nodes])

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const known = value !== null && (isBuiltInType(value) || modelTypes.includes(value))
  const isCustom = value !== null && !known

  const commitDraft = (): void => {
    const trimmed = draft.trim()
    onChange(trimmed === '' ? null : trimmed)
    setEditing(false)
  }

  const envolver = (control: ReactNode) =>
    bare ? (
      control
    ) : (
      <label className={FIELD_ROW}>
        <span className={FIELD_LABEL}>{label}</span>
        {control}
      </label>
    )

  if (editing) {
    return envolver(
      <input
          className={`${CONTROL} font-mono`}
          value={draft}
          autoFocus
          placeholder="List<Curso>, Map<String, int>…"
          onChange={(event) => setDraft(event.target.value)}
          // Commits on blur or Enter, never on a keystroke (§9) — and the
          // autosave blurs the focused field before saving, so what is typed
          // here is in the document before it travels.
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setEditing(false)
            }
          }}
        />,
    )
  }

  return envolver(
    <select
        className={`${CONTROL} font-mono`}
        value={value ?? NO_TYPE}
        onChange={(event) => {
          const next = event.target.value

          if (next === CUSTOM) {
            setDraft(value ?? '')
            setEditing(true)
            return
          }

          onChange(next === NO_TYPE ? null : next)
        }}
      >
        <option value={NO_TYPE}>— sin tipo —</option>

        {/* Keeps a custom value selectable instead of losing it on the next open. */}
        {isCustom && (
          <optgroup label="Actual">
            <option value={value}>{value}</option>
          </optgroup>
        )}

        <optgroup label="Primitivos UML">
          {UML_PRIMITIVE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </optgroup>

        <optgroup label="Tipos comunes">
          {COMMON_DATA_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </optgroup>

        {modelTypes.length > 0 && (
          <optgroup label="Clases del modelo">
            {modelTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </optgroup>
        )}

      <option value={CUSTOM}>Otro…</option>
    </select>,
  )
}
