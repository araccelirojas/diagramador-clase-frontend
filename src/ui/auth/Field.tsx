import { useId } from 'react'

/**
 * A labelled input that can show its own error. `aria-invalid` and
 * `aria-describedby` are wired here so no form has to remember them.
 */
export function Field({
  label,
  type = 'text',
  value,
  onChange,
  error,
  autoComplete,
  placeholder,
  disabled,
  hint,
}: {
  label: string
  type?: 'text' | 'email' | 'password'
  value: string
  onChange: (value: string) => void
  /** null when the field is fine. */
  error: string | null
  autoComplete?: string
  placeholder?: string
  disabled?: boolean
  /** Shown while there is no error, e.g. the minimum password length. */
  hint?: string
}) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint ?? null

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error !== null}
        aria-describedby={message === null ? undefined : messageId}
        className={`w-full rounded-md border px-3 py-2 text-sm text-slate-800 transition-colors outline-none disabled:bg-slate-50 disabled:text-slate-400 ${
          error === null
            ? 'border-slate-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
            : 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500'
        }`}
      />

      {message !== null && (
        <p
          id={messageId}
          className={`mt-1 text-xs ${error === null ? 'text-slate-400' : 'text-red-600'}`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
