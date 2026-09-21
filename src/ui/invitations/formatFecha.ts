/** Lives apart from the badge so that file only exports components (oxlint). */

const FECHA = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatFechaInvitacion(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : FECHA.format(date)
}
