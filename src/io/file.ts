import { toJson } from '@/io/serialize'
import { documentToXmi } from '@/io/xmi/exportXmi'
import type { UmlDocument } from '@/uml/model/types'

/** Reading and writing the .uml.json file. The only browser-specific bit of io/. */

export const FILE_EXTENSION = '.uml.json'

/** La extensión que espera Enterprise Architect al importar. */
export const XMI_EXTENSION = '.xmi'

/** Turns the model name into something safe to use as a file name. */
export function fileNameFor(doc: UmlDocument, extension: string = FILE_EXTENSION): string {
  const base = doc.meta.name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')

  return `${base === '' ? 'modelo' : base}${extension}`
}

/** Lo que comparten las dos descargas: crear el enlace, pulsarlo y soltar la url. */
function descargar(contenido: string, tipo: string, nombre: string): void {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = nombre
  anchor.click()

  URL.revokeObjectURL(url)
}

export function downloadDocument(doc: UmlDocument): void {
  descargar(toJson(doc), 'application/json', fileNameFor(doc))
}

/** El mismo diagrama en XMI 2.1, para abrirlo en Enterprise Architect. */
export function downloadXmi(doc: UmlDocument): void {
  descargar(documentToXmi(doc), 'application/xml', fileNameFor(doc, XMI_EXTENSION))
}

export function readDocumentFile(file: File): Promise<string> {
  return file.text()
}
