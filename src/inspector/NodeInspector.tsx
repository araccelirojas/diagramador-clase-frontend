import { CompartmentEditor } from '@/inspector/CompartmentEditor'
import { CheckboxField } from '@/inspector/fields/CheckboxField'
import { TextField } from '@/inspector/fields/TextField'
import { VisibilityField } from '@/inspector/fields/VisibilityField'
import { PANEL, SECTION, SECTION_TITLE } from '@/inspector/inspectorStyles'
import { renameNode, setNodeAbstract, setNodeKeywords, setNodeVisibility } from '@/state/commands'
import { useDiagramStore } from '@/state/useDiagramStore'
import type { UmlNode } from '@/uml/model/types'
import { getClassifier } from '@/uml/registry'

type NodeInspectorProps = { node: UmlNode }

/** Keywords are edited as free text: «entity, root» is written "entity, root". */
const parseKeywords = (raw: string | null): string[] =>
  (raw ?? '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== '')

export function NodeInspector({ node }: NodeInspectorProps) {
  const spec = getClassifier(node.kind)
  const dispatch = useDiagramStore((state) => state.dispatch)

  return (
    <div className={PANEL}>
      <section className={SECTION}>
        <h3 className={SECTION_TITLE}>
          <span>{spec.label}</span>
          <span className="font-mono text-[10px] normal-case">{node.id}</span>
        </h3>

        <TextField
          label="Nombre"
          value={node.name}
          onCommit={(name) => dispatch(renameNode({ id: node.id, name: name ?? '' }))}
        />
        <VisibilityField
          value={node.visibility}
          onChange={(visibility) => dispatch(setNodeVisibility({ id: node.id, visibility }))}
        />
        <TextField
          label="Estereotipos"
          value={node.keywords.join(', ')}
          onCommit={(raw) => dispatch(setNodeKeywords({ id: node.id, keywords: parseKeywords(raw) }))}
          placeholder="entity, service…"
        />

        {spec.canBeAbstract ? (
          <div className="pt-0.5">
            <CheckboxField
              label="Clase abstracta"
              checked={node.isAbstract}
              onChange={(isAbstract) => dispatch(setNodeAbstract({ id: node.id, isAbstract }))}
              hint="El nombre se dibuja en itálica"
            />
          </div>
        ) : null}
      </section>

      {spec.compartments.map((compartment) => (
        <CompartmentEditor key={compartment.id} node={node} spec={compartment} />
      ))}
    </div>
  )
}
