import { AlertTriangle, KeyRound, Loader2, PackageOpen } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ApiError } from '@/api/client'
import { exportBackend } from '@/api/projects'
import { TypeField } from '@/inspector/fields/TypeField'
import { updateMember } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { Property, UmlDocument, UmlNode } from '@/uml/model/types'
import { FormError } from '@/ui/auth/FormError'
import { Modal } from '@/ui/Modal'

/**
 * Lo último antes de exportar: qué es cada clase y, sobre todo, **qué la identifica**.
 *
 * El generador no inventa ninguna clave. Cada clase declara la suya marcando una propiedad
 * con `{id}` —el modificador de UML 2.5— y este diálogo es donde se hace, porque es el
 * momento en que la pregunta importa. Lo que se cambia aquí son comandos reales sobre el
 * documento: persiste, viaja a la sala y se ve en el lienzo como `{id}`.
 *
 * Una clase de asociación no elige: su identidad ES la de sus dos extremos, que ya viajan
 * como claves foráneas. Se muestra, no se pregunta.
 */

const COMPARTIMENTO = 'attributes'

type Fila = {
  nodo: UmlNode
  atributos: Property[]
  /** La raíz de su jerarquía: quien declara la clave de todas sus hijas. */
  raiz: UmlNode
  esAsociacion: boolean
  claveElegida: Property | undefined
  /** Por qué no se puede exportar todavía, o null. */
  problema: string | null
}

/** Los extremos de la relación a la que pertenece una clase de asociación. */
function extremosDe(doc: UmlDocument, nodo: UmlNode): [UmlNode, UmlNode] | null {
  if (nodo.associationId === null) return null

  const arista = doc.edges[nodo.associationId]
  if (!arista) return null

  const origen = doc.nodes[arista.source]
  const destino = doc.nodes[arista.target]

  return origen && destino ? [origen, destino] : null
}

function construirFilas(doc: UmlDocument): Fila[] {
  const padres = new Map<string, string>()

  for (const arista of Object.values(doc.edges)) {
    // El origen de una generalización es la SUBCLASE; el triángulo apunta al padre.
    if (arista.kind === 'generalization') padres.set(arista.source, arista.target)
  }

  const raizDe = (nodo: UmlNode): UmlNode => {
    let actual = nodo
    const vistos = new Set([nodo.id])

    for (;;) {
      const padreId = padres.get(actual.id)
      const padre = padreId === undefined ? undefined : doc.nodes[padreId]
      if (!padre || vistos.has(padre.id)) return actual

      vistos.add(padre.id)
      actual = padre
    }
  }

  return Object.values(doc.nodes)
    .filter((nodo) => nodo.kind === 'class' || nodo.kind === 'association-class')
    .map((nodo) => {
      const atributos = (nodo.compartments[COMPARTIMENTO] ?? []).filter(
        (miembro): miembro is Property => miembro.kind === 'property',
      )

      const raiz = raizDe(nodo)
      const esAsociacion = raiz.kind === 'association-class'

      const deRaiz = (raiz.compartments[COMPARTIMENTO] ?? []).filter(
        (miembro): miembro is Property => miembro.kind === 'property',
      )
      const marcados = deRaiz.filter((propiedad) => propiedad.isId)

      let problema: string | null = null

      if (!esAsociacion) {
        if (marcados.length === 0) {
          problema =
            raiz.id === nodo.id
              ? 'Ninguna propiedad marcada como clave.'
              : `Su raíz "${raiz.name}" no tiene clave.`
        } else if (marcados.length > 1) {
          problema = `${marcados.length} propiedades marcadas: elegí una sola.`
        }
      }

      return {
        nodo,
        atributos,
        raiz,
        esAsociacion,
        claveElegida: marcados.length === 1 ? marcados[0] : undefined,
        problema,
      }
    })
    .sort((a, b) => a.nodo.name.localeCompare(b.nodo.name, 'es'))
}

export function ExportDialog({
  idProyecto,
  nombreProyecto,
  onClose,
  onBeforeExport,
}: {
  idProyecto: string
  nombreProyecto: string
  onClose: () => void
  onBeforeExport: () => Promise<void>
}) {
  const doc = useDiagramStore((state) => state.doc)
  const dispatch = useDiagramStore((state) => state.dispatch)

  const filas = useMemo(() => construirFilas(doc), [doc])
  const bloqueadas = filas.filter((fila) => fila.problema !== null)

  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parchear = (nodoId: string, propiedad: Property, patch: Partial<Property>): void => {
    dispatch(
      updateMember({
        nodeId: nodoId,
        compartmentId: COMPARTIMENTO,
        memberId: propiedad.id,
        patch: { kind: 'property', ...patch },
      }),
    )
  }

  /** Marcar una clave desmarca la anterior: la identidad es una sola. */
  const elegirClave = (fila: Fila, propiedad: Property): void => {
    for (const otra of fila.atributos) {
      if (otra.isId && otra.id !== propiedad.id) {
        parchear(fila.nodo.id, otra, { isId: false })
      }
    }
    parchear(fila.nodo.id, propiedad, { isId: true })
  }

  const exportar = async (): Promise<void> => {
    if (exportando || bloqueadas.length > 0) return

    setExportando(true)
    setError(null)

    try {
      // Exporta lo GUARDADO, así que primero se guarda lo que hay en pantalla.
      await onBeforeExport()

      const zip = await exportBackend(idProyecto)
      const url = URL.createObjectURL(zip)

      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `${nombreProyecto.trim().replace(/[\\/:*?"<>|]/g, '-') || 'backend'}.zip`
      enlace.click()

      URL.revokeObjectURL(url)
      onClose()
    } catch (causa) {
      setError(
        causa instanceof ApiError ? causa.message : 'No se pudo exportar el backend.',
      )
      setExportando(false)
    }
  }

  return (
    <Modal
      title="Exportar backend"
      description="Revisá los tipos y elegí la clave primaria de cada clase."
      onClose={onClose}
    >
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {filas.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400 italic">
            El diagrama no tiene ninguna clase todavía.
          </p>
        )}

        {filas.map((fila) => {
          const extremos = fila.esAsociacion ? extremosDe(doc, fila.raiz) : null
          const heredaClave = fila.raiz.id !== fila.nodo.id

          return (
            <section key={fila.nodo.id} className="mb-4 rounded-md border border-slate-200">
              <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                <h3 className="text-sm font-medium text-slate-800">{fila.nodo.name}</h3>

                {fila.nodo.isAbstract && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                    abstracta
                  </span>
                )}

                {fila.esAsociacion && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-700">
                    clase de asociación
                  </span>
                )}

                {heredaClave && (
                  <span className="text-[11px] text-slate-500">hereda de {fila.raiz.name}</span>
                )}

                {fila.problema !== null && (
                  <span className="ml-auto flex items-center gap-1 text-[11px] font-medium text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {fila.problema}
                  </span>
                )}
              </header>

              {fila.esAsociacion ? (
                <p className="flex items-start gap-2 px-3 py-2 text-[11px] text-slate-600">
                  <KeyRound className="mt-px h-3.5 w-3.5 shrink-0 text-violet-500" />
                  <span>
                    Su clave es <strong>compuesta</strong>: la combinación de las claves de{' '}
                    {extremos === null ? (
                      'sus dos extremos'
                    ) : (
                      <>
                        <strong>{extremos[0].name}</strong> y <strong>{extremos[1].name}</strong>
                      </>
                    )}
                    , que ya viajan como claves foráneas. No se elige.
                  </span>
                </p>
              ) : null}

              {fila.atributos.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-400 italic">
                  Sin atributos. {fila.esAsociacion ? '' : 'Agregá uno para poder darle clave.'}
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] tracking-wide text-slate-400 uppercase">
                      {!fila.esAsociacion && <th className="w-12 px-3 py-1 text-left">clave</th>}
                      <th className="px-3 py-1 text-left">atributo</th>
                      <th className="px-3 py-1 text-left">tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fila.atributos.map((propiedad) => (
                      <tr key={propiedad.id} className="border-t border-slate-100">
                        {!fila.esAsociacion && (
                          <td className="px-3 py-1.5">
                            <input
                              type="radio"
                              name={`pk-${fila.nodo.id}`}
                              checked={propiedad.isId}
                              onChange={() => elegirClave(fila, propiedad)}
                              disabled={heredaClave}
                              title={
                                heredaClave
                                  ? `La clave la declara ${fila.raiz.name}`
                                  : 'Usar este atributo como clave primaria'
                              }
                              className="accent-sky-600"
                            />
                          </td>
                        )}

                        <td className="px-3 py-1.5 font-mono text-slate-700">
                          {propiedad.name}
                          {propiedad.isDerived && (
                            <span className="ml-1 text-[10px] text-slate-400">derivado</span>
                          )}
                        </td>

                        <td className="px-3 py-1.5">
                          <TypeField
                            bare
                            value={propiedad.type}
                            onChange={(type) => parchear(fila.nodo.id, propiedad, { type })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )
        })}
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <FormError message={error} />

        {bloqueadas.length > 0 && (
          <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Falta la clave de{' '}
            <strong>{bloqueadas.map((fila) => fila.nodo.name).join(', ')}</strong>. Sin ella el
            generador tendría que inventar una, que es justo lo que no queremos.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-slate-100"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => void exportar()}
            disabled={exportando || bloqueadas.length > 0 || filas.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:bg-emerald-300"
          >
            {exportando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PackageOpen className="h-3.5 w-3.5" />
            )}
            Exportar
          </button>
        </div>
      </div>
    </Modal>
  )
}
