import { describe, expect, it } from 'vitest'

import {
  CLASIFICADOR_POR_TIPO_XMI,
  EA_TYPE_POR_RELACION,
  FORMA_POR_RELACION,
  TIPO_XMI_POR_CLASIFICADOR,
  VISIBILIDAD_DESDE_XMI,
  VISIBILIDAD_XMI,
  limitesDeMultiplicidad,
  multiplicidadDesdeLimites,
} from '@/io/xmi/nomenclatura'
import { CLASSIFIERS, RELATIONS } from '@/uml/registry'
import type { Visibility } from '@/uml/model/types'

/**
 * La tabla de correspondencias es el contrato con Enterprise Architect, y el fallo que más
 * duele no es que esté mal traducida sino que esté INCOMPLETA: se registra una relación
 * nueva, nadie se acuerda del XMI, y los diagramas empiezan a exportarse perdiendo aristas
 * sin que nada falle.
 */

describe('la tabla cubre todo lo registrado', () => {
  it('cada clasificador del registro sabe exportarse', () => {
    for (const kind of Object.keys(CLASSIFIERS)) {
      expect(TIPO_XMI_POR_CLASIFICADOR[kind], `falta el clasificador "${kind}"`).toBeDefined()
    }
  })

  it('cada relación del registro sabe exportarse', () => {
    for (const kind of Object.keys(RELATIONS)) {
      expect(FORMA_POR_RELACION[kind], `falta la relación "${kind}"`).toBeDefined()
      expect(EA_TYPE_POR_RELACION[kind], `falta el ea_type de "${kind}"`).toBeDefined()
    }
  })

  it('lo que exportamos como clasificador se sabe volver a importar', () => {
    for (const [kind, tipo] of Object.entries(TIPO_XMI_POR_CLASIFICADOR)) {
      expect(CLASIFICADOR_POR_TIPO_XMI[tipo], `"${tipo}" no vuelve`).toBe(kind)
    }
  })
})

describe('direcciones que es fácil invertir', () => {
  it('el rombo va en el extremo de DESTINO, que es la parte', () => {
    // UML pone `composite` en la propiedad tipada por la parte: en "Coche tiene Ruedas" la
    // lleva `ruedas: Rueda[*]`. Nuestro origen es el todo, así que le toca al destino.
    expect(FORMA_POR_RELACION.composition?.agregacionEnDestino).toBe('composite')
    expect(FORMA_POR_RELACION.aggregation?.agregacionEnDestino).toBe('shared')
  })

  it('una asociación simple no marca agregación en ningún extremo', () => {
    expect(FORMA_POR_RELACION.association?.agregacionEnDestino).toBeUndefined()
  })

  it('la generalización se escribe dentro de la subclase, no suelta en el paquete', () => {
    expect(FORMA_POR_RELACION.generalization?.anidadaEnOrigen).toBe(true)
  })

  it('solo la asociación dirigida se marca como dirigida', () => {
    const dirigidas = Object.entries(FORMA_POR_RELACION)
      .filter(([, forma]) => forma.dirigida === true)
      .map(([kind]) => kind)

    expect(dirigidas).toEqual(['directed-association'])
  })
})

describe('visibilidad', () => {
  it('ida y vuelta para los cuatro símbolos de UML', () => {
    for (const simbolo of ['+', '-', '#', '~'] as Visibility[]) {
      expect(VISIBILIDAD_DESDE_XMI[VISIBILIDAD_XMI[simbolo]]).toBe(simbolo)
    }
  })
})

describe('multiplicidades', () => {
  it('parte "0..*" en sus dos límites', () => {
    expect(limitesDeMultiplicidad('0..*')).toEqual({ inferior: '0', superior: '*' })
  })

  it('"1" es 1..1, que es lo que UML guarda', () => {
    expect(limitesDeMultiplicidad('1')).toEqual({ inferior: '1', superior: '1' })
  })

  it('"*" suelto es 0..*, no *..*', () => {
    // UML 2.5 §7.5.4: un "*" a secas equivale a 0..*.
    expect(limitesDeMultiplicidad('*')).toEqual({ inferior: '0', superior: '*' })
  })

  it('sin multiplicidad no se inventan límites', () => {
    expect(limitesDeMultiplicidad(null)).toBeNull()
    expect(limitesDeMultiplicidad('  ')).toBeNull()
  })

  it('al volver se escribe la forma corta que pondría una persona', () => {
    expect(multiplicidadDesdeLimites('1', '1')).toBe('1')
    expect(multiplicidadDesdeLimites('0', '*')).toBe('0..*')
    expect(multiplicidadDesdeLimites('1', '*')).toBe('1..*')
    expect(multiplicidadDesdeLimites('2', '5')).toBe('2..5')
  })

  it('las dos funciones son inversas para lo que escribe la gente', () => {
    for (const texto of ['1', '0..1', '0..*', '1..*', '2..5']) {
      const limites = limitesDeMultiplicidad(texto)
      expect(limites).not.toBeNull()
      expect(multiplicidadDesdeLimites(limites!.inferior, limites!.superior)).toBe(texto)
    }
  })

  it('sin límites no hay multiplicidad', () => {
    expect(multiplicidadDesdeLimites(null, null)).toBeNull()
  })
})
