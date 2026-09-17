type CheckboxFieldProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}

/** Compact checkbox; several of these sit side by side in a wrapped row. */
export function CheckboxField({ label, checked, onChange, hint }: CheckboxFieldProps) {
  return (
    <label
      className="flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-600"
      title={hint}
    >
      <input
        type="checkbox"
        className="h-3 w-3 accent-sky-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
