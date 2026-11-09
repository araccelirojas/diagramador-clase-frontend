import type { OrigenVersion, VersionResumen } from '@/api/types'

/** How each origin reads in the history, and its badge colour. */
export const ORIGIN_LABEL: Record<OrigenVersion, { label: string; className: string }> = {
  MANUAL: { label: 'Manual', className: 'bg-sky-100 text-sky-700' },
  AUTOMATICA: { label: 'Automática', className: 'bg-slate-100 text-slate-600' },
  IA: { label: 'IA', className: 'bg-violet-100 text-violet-700' },
  RESTAURACION: { label: 'Antes de restaurar', className: 'bg-amber-100 text-amber-700' },
}

const DATE = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function versionDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : DATE.format(date)
}

/** "Versión 12 · Antes de la entrega", or the origin when it has no name. */
export function versionTitle(version: VersionResumen): string {
  return `Versión ${version.numero} · ${version.nombre ?? ORIGIN_LABEL[version.origen].label}`
}

export function versionCounts(version: VersionResumen): string {
  const classes = `${version.clases} ${version.clases === 1 ? 'clase' : 'clases'}`
  const relations = `${version.relaciones} ${version.relaciones === 1 ? 'relación' : 'relaciones'}`
  return `${classes} · ${relations}`
}
