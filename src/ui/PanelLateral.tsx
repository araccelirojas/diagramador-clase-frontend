import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { ReactNode } from 'react'

/** Ancho de la franja que queda visible con el panel plegado. */
export const ANCHO_PLEGADO = '2.5rem'

/**
 * Un panel lateral del editor que se puede plegar a una franja estrecha.
 *
 * Plegado, el contenido se OCULTA pero no se desmonta. No es un detalle: el panel derecho
 * lleva el agente de voz, y desmontarlo cortaba la sesión en curso; y un campo del inspector
 * a medio escribir perdía lo tecleado. Con `hidden` todo sigue vivo y vuelve tal cual estaba.
 *
 * El estado lo lleva quien lo usa, no este componente: el ancho de la columna vive en el
 * grid del editor, que es quien tiene que saber cuánto le queda al lienzo.
 */
export function PanelLateral({
  titulo,
  lado,
  plegado,
  onAlternar,
  children,
}: {
  titulo: string
  lado: 'izquierda' | 'derecha'
  plegado: boolean
  onAlternar: () => void
  children: ReactNode
}) {
  const Icono =
    lado === 'izquierda'
      ? plegado
        ? PanelLeftOpen
        : PanelLeftClose
      : plegado
        ? PanelRightOpen
        : PanelRightClose

  const accion = plegado ? `Mostrar ${titulo.toLowerCase()}` : `Ocultar ${titulo.toLowerCase()}`
  const borde = lado === 'izquierda' ? 'border-r' : 'border-l'

  const boton = (
    <button
      type="button"
      onClick={onAlternar}
      title={accion}
      aria-label={accion}
      aria-expanded={!plegado}
      className="shrink-0 rounded-sm p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      <Icono className="h-4 w-4" />
    </button>
  )

  return (
    <aside className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${borde} border-slate-300 bg-white`}>
      {plegado ? (
        // La franja entera abre el panel: apuntar a un icono de 16 px en el borde de la
        // pantalla es justo lo que no apetece hacer para recuperar una herramienta.
        <button
          type="button"
          onClick={onAlternar}
          title={accion}
          aria-label={accion}
          aria-expanded={false}
          className="flex h-full w-full flex-col items-center gap-3 py-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          <Icono className="h-4 w-4 shrink-0" />
          <span className="text-[10px] font-semibold tracking-wide uppercase [writing-mode:vertical-rl]">
            {titulo}
          </span>
        </button>
      ) : (
        // El botón va en el borde que da al lienzo, que es hacia donde se pliega el panel.
        <div
          className={`flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-1.5 ${
            lado === 'izquierda' ? 'flex-row-reverse' : ''
          }`}
        >
          {boton}
          <span
            className={`flex-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase ${
              lado === 'izquierda' ? 'text-left' : 'text-right'
            }`}
          >
            {titulo}
          </span>
        </div>
      )}

      <div className={plegado ? 'hidden' : 'flex min-h-0 flex-1 flex-col overflow-y-auto p-3'}>
        {children}
      </div>
    </aside>
  )
}
