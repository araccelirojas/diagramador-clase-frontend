import { CheckboxField } from '@/inspector/fields/CheckboxField'
import { MoreOptions } from '@/inspector/fields/MoreOptions'
import { TextField } from '@/inspector/fields/TextField'
import { VisibilityField } from '@/inspector/fields/VisibilityField'
import { ParameterList } from '@/inspector/members/ParameterList'
import type { Operation } from '@/uml/model/types'

export type OperationPatch = Partial<Omit<Operation, 'kind' | 'id'>>

type OperationEditorProps = {
  nodeId: string
  compartmentId: string
  operation: Operation
  onPatch: (patch: OperationPatch) => void
}

export function OperationEditor({
  nodeId,
  compartmentId,
  operation,
  onPatch,
}: OperationEditorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <TextField
        label="Nombre"
        value={operation.name}
        onCommit={(name) => onPatch({ name: name ?? '' })}
        mono
      />
      <TextField
        label="Retorno"
        value={operation.returnType}
        onCommit={(returnType) => onPatch({ returnType })}
        placeholder="void, boolean…"
        nullable
        mono
      />
      <VisibilityField
        value={operation.visibility}
        onChange={(visibility) => onPatch({ visibility })}
      />

      <ParameterList nodeId={nodeId} compartmentId={compartmentId} operation={operation} />

      <MoreOptions>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <CheckboxField
            label="static"
            checked={operation.isStatic}
            onChange={(isStatic) => onPatch({ isStatic })}
            hint="Se dibuja subrayada"
          />
          <CheckboxField
            label="abstracta"
            checked={operation.isAbstract}
            onChange={(isAbstract) => onPatch({ isAbstract })}
            hint="Se dibuja en itálica"
          />
          <CheckboxField
            label="query"
            checked={operation.isQuery}
            onChange={(isQuery) => onPatch({ isQuery })}
            hint="No modifica el estado: se dibuja {query}"
          />
        </div>
      </MoreOptions>
    </div>
  )
}
