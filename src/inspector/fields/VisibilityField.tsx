import { SelectField, type Option } from '@/inspector/fields/SelectField'
import type { Visibility } from '@/uml/model/types'

/** The four UML visibilities, with the symbol the diagram actually shows. */
const VISIBILITY_OPTIONS: readonly Option<Visibility>[] = [
  { value: '+', label: '+  público' },
  { value: '-', label: '−  privado' },
  { value: '#', label: '#  protegido' },
  { value: '~', label: '~  paquete' },
]

const NOT_SET = 'unset'

type VisibilityFieldProps = {
  label?: string
  value: Visibility
  onChange: (value: Visibility) => void
}

export function VisibilityField({ label = 'Visibilidad', value, onChange }: VisibilityFieldProps) {
  return (
    <SelectField label={label} value={value} options={VISIBILITY_OPTIONS} onChange={onChange} />
  )
}

type NullableVisibilityFieldProps = {
  label?: string
  value: Visibility | null
  onChange: (value: Visibility | null) => void
}

/**
 * An association end may leave visibility unspecified, which UML distinguishes
 * from any of the four values.
 */
export function NullableVisibilityField({
  label = 'Visibilidad',
  value,
  onChange,
}: NullableVisibilityFieldProps) {
  return (
    <SelectField
      label={label}
      value={value ?? NOT_SET}
      options={[{ value: NOT_SET, label: 'sin especificar' }, ...VISIBILITY_OPTIONS]}
      onChange={(next) => onChange(next === NOT_SET ? null : (next as Visibility))}
    />
  )
}
