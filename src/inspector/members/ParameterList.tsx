import { SelectField, type Option } from '@/inspector/fields/SelectField'
import { TextField } from '@/inspector/fields/TextField'
import { DANGER_BUTTON, SMALL_BUTTON } from '@/inspector/inspectorStyles'
import { addParameter, removeParameter, updateParameter } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import { createParameter } from '@/uml/model/factories'
import { formatParameter } from '@/uml/model/format'
import type { Operation, ParameterDirection } from '@/uml/model/types'

const DIRECTIONS: readonly Option<ParameterDirection>[] = [
  { value: 'in', label: 'in (entrada)' },
  { value: 'out', label: 'out (salida)' },
  { value: 'inout', label: 'inout' },
  { value: 'return', label: 'return' },
]

type ParameterListProps = {
  nodeId: string
  compartmentId: string
  operation: Operation
}

export function ParameterList({ nodeId, compartmentId, operation }: ParameterListProps) {
  const dispatch = useDiagramStore((state) => state.dispatch)
  const address = { nodeId, compartmentId, memberId: operation.id }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Parámetros</span>
        <button
          type="button"
          className={SMALL_BUTTON}
          onClick={() => dispatch(addParameter({ ...address, parameter: createParameter() }))}
        >
          + parámetro
        </button>
      </div>

      {operation.parameters.length === 0 ? (
        <span className="text-[11px] text-slate-400 italic">sin parámetros</span>
      ) : (
        operation.parameters.map((parameter) => (
          <div key={parameter.id} className="flex flex-col gap-1 rounded-sm border border-slate-200 p-1.5">
            <div className="flex items-center justify-between gap-2">
              <code className="truncate text-[11px] text-slate-500">
                {formatParameter(parameter)}
              </code>
              <button
                type="button"
                className={DANGER_BUTTON}
                onClick={() => dispatch(removeParameter({ ...address, parameterId: parameter.id }))}
                aria-label="Quitar parámetro"
              >
                ✕
              </button>
            </div>

            <TextField
              label="Nombre"
              value={parameter.name}
              onCommit={(name) =>
                dispatch(updateParameter({ ...address, parameterId: parameter.id, patch: { name: name ?? '' } }))
              }
              mono
            />
            <TextField
              label="Tipo"
              value={parameter.type}
              onCommit={(type) =>
                dispatch(updateParameter({ ...address, parameterId: parameter.id, patch: { type } }))
              }
              nullable
              mono
            />
            <SelectField
              label="Dirección"
              value={parameter.direction}
              options={DIRECTIONS}
              onChange={(direction) =>
                dispatch(updateParameter({ ...address, parameterId: parameter.id, patch: { direction } }))
              }
            />
            <TextField
              label="Por defecto"
              value={parameter.defaultValue}
              onCommit={(defaultValue) =>
                dispatch(updateParameter({ ...address, parameterId: parameter.id, patch: { defaultValue } }))
              }
              nullable
              mono
            />
          </div>
        ))
      )}
    </div>
  )
}
