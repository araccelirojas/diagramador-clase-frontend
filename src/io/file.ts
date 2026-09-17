import { toJson } from '@/io/serialize'
import type { UmlDocument } from '@/uml/model/types'

/** Reading and writing the .uml.json file. The only browser-specific bit of io/. */

export const FILE_EXTENSION = '.uml.json'

/** Turns the model name into something safe to use as a file name. */
export function fileNameFor(doc: UmlDocument): string {
  const base = doc.meta.name
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')

  return `${base === '' ? 'modelo' : base}${FILE_EXTENSION}`
}

export function downloadDocument(doc: UmlDocument): void {
  const blob = new Blob([toJson(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileNameFor(doc)
  anchor.click()

  URL.revokeObjectURL(url)
}

export function readDocumentFile(file: File): Promise<string> {
  return file.text()
}
