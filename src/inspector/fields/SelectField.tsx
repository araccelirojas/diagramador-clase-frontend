import { CONTROL, FIELD_LABEL, FIELD_ROW } from '@/inspector/inspectorStyles'

export type Option<T extends string> = { value: T; label: string }

type SelectFieldProps<T extends string> = {
  label: string
  value: T
  options: readonly Option<T>[]
  onChange: (value: T) => void
}

/** Picking an option is a deliberate act, so it commits immediately. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className={FIELD_ROW}>
      <span className={FIELD_LABEL}>{label}</span>
      <select
        className={CONTROL}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
