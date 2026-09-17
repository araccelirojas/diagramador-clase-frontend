import { TextField } from '@/inspector/fields/TextField'

const DATALIST_ID = 'uml-multiplicities'

/** The multiplicities that cover almost every real case. */
const COMMON = ['1', '0..1', '0..*', '1..*', '*']

type MultiplicityFieldProps = {
  label?: string
  value: string | null
  onChange: (value: string | null) => void
}

/**
 * A text field with suggestions rather than a closed select: UML allows any
 * range (`2..5`, `3`), so the common ones are offered without forbidding the
 * rest.
 */
export function MultiplicityField({
  label = 'Multiplicidad',
  value,
  onChange,
}: MultiplicityFieldProps) {
  return (
    <>
      <datalist id={DATALIST_ID}>
        {COMMON.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      <TextField
        label={label}
        value={value}
        onCommit={onChange}
        placeholder="sin especificar"
        list={DATALIST_ID}
        nullable
        mono
      />
    </>
  )
}
