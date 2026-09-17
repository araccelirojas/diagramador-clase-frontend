import { CheckboxField } from '@/inspector/fields/CheckboxField'
import { MultiplicityField } from '@/inspector/fields/MultiplicityField'
import { SelectField, type Option } from '@/inspector/fields/SelectField'
import { TextField } from '@/inspector/fields/TextField'
import { NullableVisibilityField } from '@/inspector/fields/VisibilityField'
import { CARD, PANEL, SECTION, SECTION_TITLE, SMALL_BUTTON } from '@/inspector/inspectorStyles'
import {
  setEdgeEnd,
  setEdgeName,
  setEdgeNameDirection,
  setEdgeRouting,
  setEdgeWaypoints,
} from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { AssociationEnd, EdgeRouting, NameDirection, UmlEdge } from '@/uml/model/types'
import { getRelation, type RelationSpec } from '@/uml/registry'

const ROUTINGS: readonly Option<EdgeRouting>[] = [
  { value: 'straight', label: 'Recta' },
  { value: 'orthogonal', label: 'Ortogonal' },
  { value: 'bezier', label: 'Curva' },
]

const NAME_DIRECTIONS: readonly Option<NameDirection>[] = [
  { value: 'none', label: 'sin dirección' },
  { value: 'sourceToTarget', label: 'origen ▸ destino' },
  { value: 'targetToSource', label: 'destino ◂ origen' },
]

/** UML distinguishes "not navigable" from "not specified", so there are three. */
const NAVIGABILITY: readonly Option<'unset' | 'yes' | 'no'>[] = [
  { value: 'unset', label: 'sin especificar' },
  { value: 'yes', label: 'navegable' },
  { value: 'no', label: 'no navegable' },
]

type EndEditorProps = {
  edge: UmlEdge
  spec: RelationSpec
  side: 'source' | 'target'
  nodeName: string
}

function EndEditor({ edge, spec, side, nodeName }: EndEditorProps) {
  const dispatch = useDiagramStore((state) => state.dispatch)
  const end = edge.ends[side]

  const patch = (values: Partial<AssociationEnd>): void => {
    dispatch(setEdgeEnd({ id: edge.id, side, patch: values }))
  }

  return (
    <section className={`${SECTION} ${CARD}`}>
      <h3 className={SECTION_TITLE}>
        <span>{side === 'source' ? 'Origen' : 'Destino'}</span>
        <span className="truncate normal-case">{nodeName}</span>
      </h3>

      {spec.supports.roles ? (
        <TextField
          label="Rol"
          value={end.role}
          onCommit={(role) => patch({ role })}
          placeholder="sin rol"
          nullable
          mono
        />
      ) : null}

      {spec.supports.multiplicity ? (
        <MultiplicityField
          value={end.multiplicity}
          onChange={(multiplicity) => patch({ multiplicity })}
        />
      ) : null}

      {spec.supports.roles ? (
        <NullableVisibilityField
          value={end.visibility}
          onChange={(visibility) => patch({ visibility })}
        />
      ) : null}

      {spec.supports.navigability ? (
        <SelectField
          label="Navegable"
          value={end.navigable === null ? 'unset' : end.navigable ? 'yes' : 'no'}
          options={NAVIGABILITY}
          onChange={(value) => patch({ navigable: value === 'unset' ? null : value === 'yes' })}
        />
      ) : null}

      {spec.supports.multiplicity ? (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
          <CheckboxField
            label="ordered"
            checked={end.isOrdered}
            onChange={(isOrdered) => patch({ isOrdered })}
          />
          <CheckboxField
            label="unique"
            checked={end.isUnique}
            onChange={(isUnique) => patch({ isUnique })}
          />
        </div>
      ) : null}
    </section>
  )
}

type EdgeInspectorProps = { edge: UmlEdge }

/**
 * Which fields exist is decided by the RelationSpec, not by an `if` per kind:
 * a generalization has no multiplicity or roles because its spec says
 * `supports.multiplicity: false`.
 */
export function EdgeInspector({ edge }: EdgeInspectorProps) {
  const spec = getRelation(edge.kind)
  const dispatch = useDiagramStore((state) => state.dispatch)
  const doc = useDiagramStore((state) => state.doc)

  const sourceName = doc.nodes[edge.source]?.name ?? edge.source
  const targetName = doc.nodes[edge.target]?.name ?? edge.target

  return (
    <div className={PANEL}>
      <section className={SECTION}>
        <h3 className={SECTION_TITLE}>
          <span>{spec.label}</span>
          <span className="font-mono text-[10px] normal-case">{edge.id}</span>
        </h3>

        {spec.supports.name ? (
          <>
            <TextField
              label="Nombre"
              value={edge.name}
              onCommit={(name) => dispatch(setEdgeName({ id: edge.id, name }))}
              placeholder="sin nombre"
              nullable
            />
            <SelectField
              label="Lectura"
              value={edge.nameDirection}
              options={NAME_DIRECTIONS}
              onChange={(nameDirection) =>
                dispatch(setEdgeNameDirection({ id: edge.id, nameDirection }))
              }
            />
          </>
        ) : null}

        <SelectField
          label="Trazado"
          value={edge.routing}
          options={ROUTINGS}
          onChange={(routing) => dispatch(setEdgeRouting({ id: edge.id, routing }))}
        />

        {edge.waypoints.length > 0 ? (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] text-slate-500">
              {edge.waypoints.length} {edge.waypoints.length === 1 ? 'punto' : 'puntos'} a mano
            </span>
            <button
              type="button"
              className={SMALL_BUTTON}
              onClick={() => dispatch(setEdgeWaypoints({ id: edge.id, waypoints: [] }))}
            >
              Enderezar
            </button>
          </div>
        ) : (
          <p className="text-[10px] leading-relaxed text-slate-400">
            Con la relación seleccionada, arrastrá los puntos de la línea para doblarla.
          </p>
        )}
      </section>

      <EndEditor edge={edge} spec={spec} side="source" nodeName={sourceName} />
      <EndEditor edge={edge} spec={spec} side="target" nodeName={targetName} />

      {spec.metamodelNote ? (
        <p className="border-t border-slate-200 pt-2 text-[10px] leading-relaxed text-slate-400">
          {spec.metamodelNote}
        </p>
      ) : null}
    </div>
  )
}
