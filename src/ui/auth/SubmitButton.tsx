import { Loader2 } from 'lucide-react'

/** Full-width submit that shows it is busy and blocks a double send. */
export function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:outline-none disabled:bg-sky-300"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? 'Enviando…' : label}
    </button>
  )
}
