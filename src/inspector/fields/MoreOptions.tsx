import type { ReactNode } from 'react'

type MoreOptionsProps = { children: ReactNode }

/**
 * Collapses the adornments that most diagrams never touch. They are valid UML
 * and stay reachable, but the everyday fields (name, type, visibility) are not
 * buried under them.
 */
export function MoreOptions({ children }: MoreOptionsProps) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[11px] text-slate-400 select-none hover:text-slate-600">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span> Más
        opciones
      </summary>

      <div className="mt-1.5 flex flex-col gap-1.5 border-l border-slate-200 pl-2">{children}</div>
    </details>
  )
}
