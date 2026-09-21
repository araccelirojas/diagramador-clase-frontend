import { AlertTriangle, ImageUp, Loader2, ScanLine } from 'lucide-react'
import { useState } from 'react'

import { ApiError } from '@/api/client'
import { createProject } from '@/api/projects'
import { interpretSketch, type LecturaBoceto } from '@/api/sketch'
import { documentFromSketch } from '@/io/sketch'
import { prepararImagen, type ImagenPreparada } from '@/io/prepararImagen'
import { serialize } from '@/io/serialize'
import type { UmlDocument } from '@/uml/model/types'
import { FormError } from '@/ui/auth/FormError'
import { Modal } from '@/ui/Modal'

/**
 * Importar un diagrama desde una foto.
 *
 * Enseña lo que leyó ANTES de crear el proyecto. Un modelo de visión se equivoca —confunde
 * un rombo hueco con uno relleno, se salta una multiplicidad— y descubrirlo después de que
 * el proyecto ya existe es peor que verlo aquí y decidir.
 */

type Estado =
  | { fase: 'elegir' }
  | { fase: 'leyendo' }
  | {
      fase: 'leido'
      doc: UmlDocument
      avisos: string[]
      uso: LecturaBoceto['uso']
      imagen: ImagenPreparada | null
    }
  | { fase: 'creando'; doc: UmlDocument }

const MAX_MB = 10

export function ImportSketchDialog({
  onClose,
  onCreado,
}: {
  onClose: () => void
  onCreado: (idProyecto: string) => void
}) {
  const [estado, setEstado] = useState<Estado>({ fase: 'elegir' })
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)

  const leer = async (elegida: File): Promise<void> => {
    setError(null)
    setEstado({ fase: 'leyendo' })

    try {
      // Normalizar el tamaño no es cosmético: de esto depende que el modelo alcance a leer
      // las multiplicidades, que en una captura chica miden cuatro o cinco píxeles.
      const preparada = await prepararImagen(elegida)

      if (preparada.archivo.size > MAX_MB * 1024 * 1024) {
        setError(`La imagen pesa más de ${MAX_MB} MB. Sacale una más chica o bajale la calidad.`)
        setEstado({ fase: 'elegir' })
        return
      }

      const lectura = await interpretSketch(preparada.archivo)
      const propuesto = nombre.trim() === '' ? quitarExtension(elegida.name) : nombre.trim()
      const resultado = documentFromSketch(lectura.boceto, propuesto)

      if (!resultado.ok) {
        setError(`El diagrama leído no es válido: ${resultado.error}`)
        setEstado({ fase: 'elegir' })
        return
      }

      if (nombre.trim() === '') setNombre(propuesto)

      setEstado({
        fase: 'leido',
        doc: resultado.doc,
        avisos: resultado.avisos,
        uso: lectura.uso,
        imagen: preparada,
      })
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No se pudo leer el boceto.')
      setEstado({ fase: 'elegir' })
    }
  }

  const crear = async (doc: UmlDocument): Promise<void> => {
    setEstado({ fase: 'creando', doc })
    setError(null)

    const titulo = nombre.trim() === '' ? 'Diagrama importado' : nombre.trim()

    try {
      // Nace con el contenido puesto: un solo viaje, y el proyecto nunca existe vacío.
      const proyecto = await createProject(titulo, serialize({ ...doc, meta: { ...doc.meta, name: titulo } }))
      onCreado(proyecto.idProyecto)
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No se pudo crear el proyecto.')
      setEstado({ fase: 'leido', doc, avisos: [], uso: null, imagen: null })
    }
  }

  return (
    <Modal
      title="Importar diagrama desde un boceto"
      description="Subí una foto de un diagrama de clases y se reconstruye en el editor."
      onClose={onClose}
    >
      <FormError message={error} />

      <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="boceto-nombre">
        Nombre del proyecto
      </label>
      <input
        id="boceto-nombre"
        value={nombre}
        onChange={(event) => setNombre(event.target.value)}
        placeholder="Se toma del archivo si lo dejás vacío"
        disabled={estado.fase === 'leyendo' || estado.fase === 'creando'}
        className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-50"
      />

      {(estado.fase === 'elegir' || estado.fase === 'leyendo') && (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
            estado.fase === 'leyendo'
              ? 'border-slate-200 bg-slate-50'
              : 'border-slate-300 hover:border-sky-400 hover:bg-sky-50/40'
          }`}
        >
          {estado.fase === 'leyendo' ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-sky-500" />
              <p className="mt-3 text-sm font-medium text-slate-700">Leyendo el boceto…</p>
              <p className="mt-1 text-xs text-slate-500">
                Puede tardar unos segundos: el modelo está mirando la imagen.
              </p>
            </>
          ) : (
            <>
              <ImageUp className="h-7 w-7 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-700">Elegí una foto o captura</p>
              <p className="mt-1 text-xs text-slate-500">
                PNG, JPG o WebP, hasta {MAX_MB} MB. Cuanto más legible, mejor lo lee.
              </p>
            </>
          )}

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            disabled={estado.fase === 'leyendo'}
            onChange={(event) => {
              const imagen = event.target.files?.[0]
              // Reiniciar permite volver a elegir el mismo archivo tras un error.
              event.target.value = ''
              if (imagen) void leer(imagen)
            }}
          />
        </label>
      )}

      {(estado.fase === 'leido' || estado.fase === 'creando') && (
        <Resumen doc={estado.doc} />
      )}

      {estado.fase === 'leido' && estado.avisos.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cosas que hubo que corregir
          </p>
          <ul className="list-inside list-disc text-[11px] text-amber-800">
            {estado.avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        </div>
      )}

      {estado.fase === 'leido' && (
        <p className="mt-2 text-[11px] text-slate-400">
          {estado.imagen?.reescalada === true && (
            <>
              Imagen ajustada de {estado.imagen.anchoOriginal}×{estado.imagen.altoOriginal} a{' '}
              {estado.imagen.ancho}×{estado.imagen.alto} para que el texto chico sea legible.{' '}
            </>
          )}
          {estado.uso?.total_tokens !== undefined &&
            `La lectura consumió ${estado.uso.total_tokens.toLocaleString('es')} tokens.`}
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-100"
        >
          Cancelar
        </button>

        {(estado.fase === 'leido' || estado.fase === 'creando') && (
          <button
            type="button"
            onClick={() => void crear(estado.doc)}
            disabled={estado.fase === 'creando'}
            className="flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-700 disabled:bg-sky-300"
          >
            {estado.fase === 'creando' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanLine className="h-3.5 w-3.5" />
            )}
            Crear proyecto y abrirlo
          </button>
        )}
      </div>
    </Modal>
  )
}

/** Lo que se leyó, en números y nombres: es la forma rápida de ver si acertó. */
function Resumen({ doc }: { doc: UmlDocument }) {
  const nodos = Object.values(doc.nodes)
  const aristas = Object.values(doc.edges)

  const atributos = nodos.reduce(
    (total, nodo) => total + (nodo.compartments.attributes?.length ?? 0),
    0,
  )
  const operaciones = nodos.reduce(
    (total, nodo) => total + (nodo.compartments.operations?.length ?? 0),
    0,
  )

  const porTipo = new Map<string, number>()
  for (const arista of aristas) porTipo.set(arista.kind, (porTipo.get(arista.kind) ?? 0) + 1)

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>
          <strong>{nodos.length}</strong> clases
        </span>
        <span>
          <strong>{atributos}</strong> atributos
        </span>
        <span>
          <strong>{operaciones}</strong> operaciones
        </span>
        <span>
          <strong>{aristas.length}</strong> relaciones
        </span>
      </div>

      {nodos.length > 0 && (
        <p className="mb-2 text-[11px] text-slate-500">
          {nodos.map((nodo) => nodo.name).join(' · ')}
        </p>
      )}

      {porTipo.size > 0 && (
        <p className="text-[11px] text-slate-400">
          {[...porTipo].map(([tipo, cuantas]) => `${cuantas}× ${tipo}`).join(' · ')}
        </p>
      )}

      {nodos.length === 0 && (
        <p className="text-[11px] text-amber-700">
          No se reconoció ninguna clase. Probá con una foto más nítida o más de frente.
        </p>
      )}
    </div>
  )
}

const quitarExtension = (nombre: string) => nombre.replace(/\.[^.]+$/, '').trim()
