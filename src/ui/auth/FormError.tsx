import { AlertCircle } from 'lucide-react'

/** The backend's `{ message }` shown above the form, not swallowed by a console.log. */
export function FormError({ message }: { message: string | null }) {
  if (message === null) return null

  return (
    <p
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
    >
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  )
}
