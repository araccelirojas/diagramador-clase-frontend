import { CheckboxField } from '@/inspector/fields/CheckboxField'
import { MoreOptions } from '@/inspector/fields/MoreOptions'
import { MultiplicityField } from '@/inspector/fields/MultiplicityField'
import { TextField } from '@/inspector/fields/TextField'
import { TypeField } from '@/inspector/fields/TypeField'
import { VisibilityField } from '@/inspector/fields/VisibilityField'
import type { Property } from '@/uml/model/types'

export type PropertyPatch = Partial<Omit<Property, 'kind' | 'id'>>

type PropertyEditorProps = {
  property: Property
  onPatch: (patch: PropertyPatch) => void
}

/**
 * Every adornment UML 2.5 gives an attribute. Name, type and visibility are the
 * ones used all the time; the rest — multiplicity included — sit behind "Más
 * opciones", because a plain `- nombre : String` needs none of them.
 */
export function PropertyEditor({ property, onPatch }: PropertyEditorProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <TextField
        label="Nombre"
        value={property.name}
        onCommit={(name) => onPatch({ name: name ?? '' })}
        mono
      />
      <TypeField value={property.type} onChange={(type) => onPatch({ type })} />
      <VisibilityField
        value={property.visibility}
        onChange={(visibility) => onPatch({ visibility })}
      />

      {/* Fuera de "Más opciones" a propósito: es lo que identifica al objeto, no un adorno.
          Es el modificador {id} de UML 2.5 y lo que el exportador usa como clave primaria. */}
      <div className="pt-0.5">
        <CheckboxField
          label="{id}"
          checked={property.isId}
          onChange={(isId) => onPatch({ isId })}
          hint="Identifica al objeto: el exportador lo usa como clave primaria"
        />
      </div>

      <MoreOptions>
        <MultiplicityField
          value={property.multiplicity}
          onChange={(multiplicity) => onPatch({ multiplicity })}
        />
        <TextField
          label="Por defecto"
          value={property.defaultValue}
          onCommit={(defaultValue) => onPatch({ defaultValue })}
          nullable
          mono
        />

        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
          <CheckboxField
            label="static"
            checked={property.isStatic}
            onChange={(isStatic) => onPatch({ isStatic })}
            hint="Se dibuja subrayado"
          />
          <CheckboxField
            label="derivado"
            checked={property.isDerived}
            onChange={(isDerived) => onPatch({ isDerived })}
            hint="Se dibuja /nombre"
          />
          <CheckboxField
            label="readOnly"
            checked={property.isReadOnly}
            onChange={(isReadOnly) => onPatch({ isReadOnly })}
          />
          <CheckboxField
            label="ordered"
            checked={property.isOrdered}
            onChange={(isOrdered) => onPatch({ isOrdered })}
            hint="Solo tiene sentido con multiplicidad mayor que 1"
          />
          <CheckboxField
            label="unique"
            checked={property.isUnique}
            onChange={(isUnique) => onPatch({ isUnique })}
            hint="UML lo asume verdadero; al desmarcarlo se dibuja {nonunique}"
          />
        </div>
      </MoreOptions>
    </div>
  )
}
