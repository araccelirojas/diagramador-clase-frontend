import { PackageOpen } from 'lucide-react'
import { useState } from 'react'

import { ExportDialog } from '@/ui/export/ExportDialog'

/**
 * Abre el diálogo de exportación. No exporta directamente: antes hay que decidir qué
 * identifica a cada clase, y ese es el trabajo del diálogo.
 */
export function ExportBackendButton({
  idProyecto,
  nombreProyecto,
  onBeforeExport,
}: {
  idProyecto: string
  nombreProyecto: string
  /** Guarda lo que hay en pantalla: el servidor exporta desde el contenido guardado. */
  onBeforeExport: () => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Genera un proyecto Spring Boot con el CRUD y Swagger de cada clase"
        className="flex shrink-0 items-center gap-1.5 rounded-sm border border-slate-300 px-2 py-1 text-xs whitespace-nowrap text-slate-600 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
      >
        <PackageOpen className="h-3.5 w-3.5" />
        Exportar backend
      </button>

      {abierto && (
        <ExportDialog
          idProyecto={idProyecto}
          nombreProyecto={nombreProyecto}
          onBeforeExport={onBeforeExport}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}
