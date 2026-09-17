import { MousePointer2, type LucideIcon } from 'lucide-react'

import { PaletteItem } from '@/palette/PaletteItem'
import { useDiagramStore } from '@/state/useDiagramStore'
import { CLASSIFIER_LIST, MEMBER_LIST, RELATION_LIST } from '@/uml/registry'

/**
 * The palette is BUILT from the registry, never written by hand (CLAUDE.md
 * §7). Adding a spec file makes its tool appear here with no change to this
 * component.
 */

type ClassifierEntry = {
  key: string
  label: string
  icon: LucideIcon
  classifierKind: string
  variantId?: string
}

/** One entry per spec, plus one per declared variant (e.g. "Clase abstracta"). */
function classifierEntries(): ClassifierEntry[] {
  return CLASSIFIER_LIST.flatMap((spec) => [
    { key: spec.kind, label: spec.label, icon: spec.icon, classifierKind: spec.kind },
    ...(spec.variants ?? []).map((variant) => ({
      key: `${spec.kind}:${variant.id}`,
      label: variant.label,
      icon: variant.icon,
      classifierKind: spec.kind,
      variantId: variant.id,
    })),
  ])
}

/**
 * A member tool only makes sense if some registered classifier has a
 * compartment for it, which is what keeps "Literal" hidden until enumerations
 * exist in phase 2.
 */
function usableMemberKinds(): Set<string> {
  return new Set(
    CLASSIFIER_LIST.flatMap((spec) => spec.compartments.map((compartment) => compartment.memberKind)),
  )
}

const SECTION_TITLE = 'px-1 text-[10px] font-semibold tracking-wide text-slate-400 uppercase'

export function Palette() {
  const tool = useDiagramStore((state) => state.tool)
  const setTool = useDiagramStore((state) => state.setTool)
  const memberKinds = usableMemberKinds()

  return (
    <div className="flex flex-col gap-4">
      <PaletteItem
        label="Seleccionar"
        icon={MousePointer2}
        isActive={tool.kind === 'select'}
        hint="mover, seleccionar y editar (Esc)"
        onSelect={() => setTool({ kind: 'select' })}
      />

      <section className="flex flex-col gap-1">
        <h2 className={SECTION_TITLE}>Clasificadores</h2>

        {classifierEntries().map((entry) => {
          const isActive =
            tool.kind === 'classifier' &&
            tool.classifierKind === entry.classifierKind &&
            tool.variantId === entry.variantId

          return (
            <PaletteItem
              key={entry.key}
              label={entry.label}
              icon={entry.icon}
              isActive={isActive}
              hint="arrastralo al lienzo, o hacé clic y después clic en el lienzo"
              drag={
                entry.variantId === undefined
                  ? { tool: 'classifier', classifierKind: entry.classifierKind }
                  : {
                      tool: 'classifier',
                      classifierKind: entry.classifierKind,
                      variantId: entry.variantId,
                    }
              }
              onSelect={() =>
                setTool(
                  isActive
                    ? { kind: 'select' }
                    : {
                        kind: 'classifier',
                        classifierKind: entry.classifierKind,
                        ...(entry.variantId === undefined ? {} : { variantId: entry.variantId }),
                      },
                )
              }
            />
          )
        })}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className={SECTION_TITLE}>Miembros</h2>

        {MEMBER_LIST.filter((spec) => memberKinds.has(spec.kind)).map((spec) => {
          const isActive = tool.kind === 'member' && tool.memberKind === spec.kind

          return (
            <PaletteItem
              key={spec.kind}
              label={spec.label}
              icon={spec.icon}
              isActive={isActive}
              hint={spec.hint}
              drag={{ tool: 'member', memberKind: spec.kind }}
              onSelect={() =>
                setTool(isActive ? { kind: 'select' } : { kind: 'member', memberKind: spec.kind })
              }
            />
          )
        })}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className={SECTION_TITLE}>Relaciones</h2>

        {RELATION_LIST.map((spec) => {
          const isActive = tool.kind === 'relation' && tool.relationKind === spec.kind

          return (
            <PaletteItem
              key={spec.kind}
              label={spec.label}
              icon={spec.icon}
              isActive={isActive}
              hint="hacé clic acá y después arrastrá de una clase a otra"
              onSelect={() =>
                setTool(isActive ? { kind: 'select' } : { kind: 'relation', relationKind: spec.kind })
              }
            />
          )
        })}
      </section>

      <p className="px-1 text-[10px] leading-relaxed text-slate-400">
        <kbd className="font-sans">Esc</kbd> vuelve a Seleccionar. Doble clic en un nombre para
        renombrarlo.
      </p>
    </div>
  )
}
