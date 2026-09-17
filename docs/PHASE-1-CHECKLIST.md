# Checklist — Fase 1: el diagramador

Plan de ejecución para la fase 1 descrita en `CLAUDE.md` §13: **solo el diagrama**, sin
backend, sin autosave, sin sockets. Cada bloque se completa y se verifica antes de pasar
al siguiente; el orden es de dependencias, no de gusto.

Convención: `[ ]` pendiente · `[x]` hecho. Cada bloque termina con su **Listo cuando**,
que es la condición para marcarlo cerrado.

---

## 0. Punto de partida (estado real del repo)

Lo que hay hoy: `vite@8` + `react@19` + `oxlint`, en **JavaScript**, con el template por
defecto (`src/App.jsx`, `src/App.css`, `src/assets/*`). Nada del stack de `CLAUDE.md` §3
está instalado.

Decisiones tomadas para no complicar de más:

| Tema | Decisión | Motivo |
|---|---|---|
| Vite | Se queda en **8.x** (CLAUDE.md dice 7.x objetivo) | ya está instalado y funcionando; bajar un major no aporta nada |
| Linter | Se queda **oxlint**, no se agrega ESLint | es el que trae el scaffold; una sola herramienta |
| TypeScript | Se migra el scaffold entero a TS en el bloque 1 | el dominio no se puede modelar en JS |
| Tests | **Vitest sin jsdom** (`environment: 'node'`) | en fase 1 solo se testea lo puro: modelo, comandos, geometría, io |
| Diagramas | Existe un único `d_main` fijo, pero **todo filtra por `diagramId`** desde el día uno | las pestañas llegan en fase 3 sin refactor |
| Clase abstracta | Es una `class` con `isAbstract: true`, **no** un `kind` propio del registry | §5.2 ya modela `isAbstract`; duplicarlo en un spec crearía dos verdades. Ver "Decisiones a confirmar" |
| Handles | Un único handle por nodo (source+target, invisible) + `ConnectionMode.Loose` | las aristas son flotantes (§9); handles por lado serían ruido visual y estado extra |

---

## 1. Andamiaje y migración a TypeScript

- [x] Instalar runtime: `@xyflow/react zustand immer zod nanoid lucide-react`
- [x] Instalar dev: `typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite vitest @types/node`
- [x] `tsconfig.json` con `strict: true`, `noUncheckedIndexedAccess: true`, `verbatimModuleSyntax`, alias `@/* → src/*`
- [x] Renombrar `main.jsx → main.tsx` y `App.jsx → app/App.tsx`; actualizar `index.html`
- [x] Borrar el `vite.config.js` del template (Vite prefiere `.js` sobre `.ts` y la config nueva quedaba ignorada)
- [x] Borrar restos del template: `App.css`, `src/assets/react.svg`, `src/assets/hero.png`
- [x] Tailwind 4: plugin `@tailwindcss/vite` en `vite.config.ts` + `@import "tailwindcss"` en `src/index.css`
- [x] Importar `@xyflow/react/dist/style.css` una sola vez, en `src/index.css`
- [x] Configurar `vitest` en `vite.config.ts` (`test.environment: 'node'`) + scripts `test` y `typecheck` en `package.json`
- [x] Crear el árbol de carpetas de `CLAUDE.md` §4 (`app/ canvas/ uml/ state/ inspector/ palette/ io/ ui/ lib/`)
- [x] `app/App.tsx`: layout de 3 zonas con grid Tailwind — paleta izquierda fija, lienzo flexible, inspector derecho fijo
- [x] `canvas/UmlCanvas.tsx`: `<ReactFlow>` con `<Background variant="dots" gap={8}>`, `<Controls>`, `<MiniMap>`, `fitView`

**Listo cuando**: `npm run dev` muestra las tres zonas, el lienzo hace pan y zoom, y
`npm run typecheck` pasa limpio.

---

## 2. Modelo de datos (`src/uml/model/`)

Nada de este bloque importa React ni `@xyflow/react`.

- [x] `types.ts` — `UmlDocument`, `Diagram`, `UmlNode`, `UmlEdge`, `AssociationEnd`, `Visibility`, `Property`, `Operation`, `Parameter`, `Literal`, `Member`, `Issue`. Copiar §5 literal, sin inventar campos
- [x] `schema.ts` — esquemas zod espejo de `types.ts` + `SCHEMA_VERSION = 1`. Un `superRefine` a nivel documento valida las invariantes §5.4 (1, 2 y 3)
- [x] `factories.ts` — `createDocument`, `createNode(kind, position, spec)`, `createProperty`, `createOperation`, `createParameter`, `createLiteral`, `createEdge(kind, source, target, spec)`. Ids con nanoid y prefijo (`n_`, `e_`, `m_`)
- [x] `format.ts` — `formatProperty`, `formatOperation`, `formatLiteral`, `formatMember` (switch exhaustivo sobre `kind`). Salida UML: `+ /nombre : Tipo [0..*] = def {readOnly}`, `- op(in x : int) : bool {query}`
- [x] `migrations.ts` — `migrate(raw)` con el mapa de migraciones vacío; rechaza `schemaVersion > SCHEMA_VERSION` con un mensaje claro
- [x] `validators.ts` — `validateDocument(doc): Issue[]`. Fase 1: nombres vacíos y duplicados, miembros repetidos, aristas huérfanas. Severidad `warning` salvo lo que rompa §5.4
- [x] Los ciclos de generalización **no** van acá: son semántica de una relación concreta y viven en el `validate` de su spec (bloque 4), para que agregar un elemento nunca obligue a editar `validators.ts`
- [x] `sampleDocument.ts` — documento determinista con ids fijos, reutilizado por los tests y por el round-trip del bloque 9
- [x] Tests: `format.test.ts`, `schema.test.ts` (las 3 invariantes de §5.4), `migrations.test.ts`, `validators.test.ts`
- [x] `lib/typeAssert.ts` + aserciones `Expect<Equal<z.infer<...>, UmlDocument>>` para que `schema.ts` y `types.ts` no se separen sin romper el build

**Listo cuando**: `npm test` verde y `validateDocument(createDocument())` devuelve `[]`.

---

## 3. Store, comandos e historial (`src/state/`)

- [x] `commands/defineCommand.ts` — `defineCommand(type, apply)` devuelve un creador `(payload) => ({ type, payload })`. El payload es **JSON serializable**, sin excepciones
- [x] `commands/index.ts` — registro `type → apply`, que usan `dispatch` y (en fase 4) el canal de colaboración
- [x] `commands/nodes.ts` — `addNode`, `removeNodes` (cascada de aristas + despadre, §5.4.4), `moveNodes`, `resizeNode`, `renameNode`, `setNodeFlags` (abstract / visibility / keywords), `setNodeParent`
- [x] `commands/edges.ts` — `addEdge`, `removeEdges`, `setEdgeName`, `setEdgeEnd` (un extremo, un campo), `setEdgeWaypoints`, `reconnectEdge`
- [x] `commands/members.ts` — `addMember`, `removeMember`, `renameMember`, `updateMember`, `moveMember`, `addParameter`, `updateParameter`, `removeParameter`
- [x] `commands/document.ts` — `setDocumentName`, `renameDiagram`, `setViewport` (siempre con `{ history: false }`)
- [x] `useDiagramStore.ts` — zustand + middleware `immer`. Estado de §6.1 exacto. Expone **un solo** mutador: `dispatch(command)`, que además marca `isDirty` y `meta.updatedAt`
- [x] `history.ts` — pila de snapshots del `doc`, máx. 50, con coalescencia por tiempo (≈400 ms) y por `type` de comando. `undo()` / `redo()`
- [x] `selectors.ts` — `selectFlowNodes`, `selectFlowEdges` (filtran por `activeDiagramId`, memoizados), `selectSelectedNode`, `selectSelectedEdge`, `selectNodeById`
- [x] Tests: `commands.test.ts` — borrado en cascada, mover varios nodos, rename fino, y que ningún comando rompa §5.4

**Listo cuando**: un test aplica una secuencia de comandos, hace undo y redo, y el
documento vuelve exactamente al estado previo (`toEqual`).

---

## 4. Registry (`src/uml/registry/`)

- [x] `types.ts` — `ClassifierSpec`, `RelationSpec`, `CompartmentSpec`, `MarkerId` (copiar §7.1 y §7.2)
- [x] `classifiers/class.ts` — compartimentos `attributes` (property) y `operations` (operation)
- [x] `classifiers/interface.ts` — `defaultKeywords: ['interface']`, mismos compartimentos, `canBeAbstract: false`
- [x] `classifiers/index.ts` — `CLASSIFIERS: Record<string, ClassifierSpec>` + `getClassifier(kind)` que lanza si no existe
- [x] `relations/association.ts` — línea sólida, sin markers, soporta todos los adornos
- [x] `relations/directed-association.ts` — sólida, `targetMarker: arrowOpen`
- [x] `relations/aggregation.ts` — sólida, `sourceMarker: diamondHollow`, `metamodelNote` sobre `aggregation: 'shared'`
- [x] `relations/composition.ts` — sólida, `sourceMarker: diamondFilled`, `metamodelNote` sobre `aggregation: 'composite'`
- [x] `relations/generalization.ts` — sólida, `targetMarker: triangleHollow`, sin multiplicidad ni roles, `isValidConnection` sin auto-referencia ni ciclos
- [x] `relations/realization.ts` — punteada, `targetMarker: triangleHollow`, `isValidConnection`: destino con `kind === 'interface'`
- [x] `relations/index.ts` — `RELATIONS` + `getRelation(kind)`
- [x] `registry/index.ts` — reexporta ambos mapas y expone los grupos que consume la paleta
- [x] Test `registry.test.ts` — todo spec tiene `kind` único, `defaultSize`, y compartimentos con `memberKind` válido

**Listo cuando**: agregar un archivo en `classifiers/` y una línea en su índice hace
aparecer la herramienta en la paleta sin tocar nada más (se comprueba en el bloque 7).

---

## 5. Nodos en el lienzo (`src/canvas/nodes/`)

- [x] `canvas/nodeTypes.ts` — se **deriva** de `CLASSIFIERS`: todo kind sin `render` propio apunta a `ClassifierNode`
- [x] `nodes/ClassifierNode.tsx` — cabecera (`«keyword»`, nombre centrado, itálica si `isAbstract`) + un bloque por cada `CompartmentSpec`, separados por línea. Los miembros se pintan con `format.ts`. **Ni un `if (kind === ...)`**
- [x] `nodes/nodeStyles.ts` — constantes con las clases Tailwind compartidas (caja, cabecera, compartimento, seleccionado)
- [x] Handle único en `Position.Left` con `isConnectableStart/End`, opacidad 0, cubriendo la caja
- [x] `<NodeResizer>` visible solo con el nodo seleccionado; al soltar → `resizeNode`
- [x] Edición inline del nombre: doble clic → input local, `Enter` o blur → `renameNode`, `Esc` cancela
- [x] Edición inline de miembro: doble clic en la fila → input; doble clic en el compartimento vacío → `addMember` y entra en edición
- [x] `UmlCanvas.tsx`: `onNodesChange` traduce a comandos — `position` solo con `dragging === false`, `dimensions` solo al soltar, `remove` → `removeNodes`, `select` → selección del store (§6.3)

**Listo cuando**: dos clases creadas desde el store se dibujan bien, se mueven, se
redimensionan, y `Ctrl+Z` deshace un arrastre completo como **una sola** entrada.

---

## 6. Aristas en el lienzo (`src/canvas/`)

- [x] `markers/markerIds.ts` — el objeto `MARKERS` de §7.3, tal cual
- [x] `markers/UmlMarkers.tsx` — `<defs>` con los 5 markers. `markerUnits="userSpaceOnUse"`, `refX` en la punta, relleno del lienzo en las figuras huecas (los cuatro detalles no negociables de §7.3)
- [x] `edges/geometry.ts` — **puro, sin React**: `intersectRect(rect, from)`, `floatingEndpoints(sourceRect, targetRect)`, `pathFor(routing, points)`, `labelAnchor(point, angle, offset)`
- [x] `edges/UmlEdge.tsx` — único componente: lee el `RelationSpec` para línea, markers y etiquetas. `<EdgeLabelRenderer>` para el nombre de la asociación (con el ▸ de `nameDirection`) y para multiplicidad + rol en cada extremo
- [x] `canvas/edgeTypes.ts` — derivado de `RELATIONS`; todos apuntan a `UmlEdge`
- [x] `UmlCanvas.tsx`: `connectionMode={ConnectionMode.Loose}`, `isValidConnection` delegando en el spec activo, `onConnect` → `addEdge` con los `defaultEnds` del spec
- [x] Feedback de conexión: borde verde/rojo en el nodo candidato mientras se arrastra
- [ ] Resaltado de las aristas incidentes al seleccionar un nodo
- [x] Test `geometry.test.ts` — intersección en los 4 lados, esquinas, nodos superpuestos, nodo contenido en otro

- [x] Hitbox: `nodeDragThreshold` y handle con `pointer-events` sólo cuando hay una relación activa, para que el doble clic llegue al contenido
- [ ] Auto-asociación (origen = destino): el bucle no se dibuja todavía, por ahora se rechaza la conexión

**Listo cuando**: las 6 relaciones se dibujan con su punta correcta, la arista sigue a la
caja al moverla, y las etiquetas no se voltean al cruzar el eje.

---

## 7. Paleta e interacción (`src/palette/`, `src/canvas/interaction/`)

- [x] `palette/Palette.tsx` — se construye recorriendo el registry y agrupando por `group`. Cero listas escritas a mano
- [x] `palette/PaletteItem.tsx` — icono + label, `draggable`, estado activo cuando es la herramienta seleccionada
- [x] ~~`interaction/useCanvasTool.ts`~~ — innecesario: la herramienta activa es estado del store y `Esc` se resuelve en `useKeyboard`. Un hook extra solo para leerla sería ruido
- [x] `interaction/usePaletteDrop.ts` — `onDragStart` guarda el `kind` en `dataTransfer`; `onDrop` convierte con **`screenToFlowPosition`** (nunca aritmética de zoom a mano) → `addNode`
- [x] Click-to-place: con una herramienta de clasificador activa, el clic en el lienzo crea el nodo centrado en el punto; la herramienta persiste hasta `Esc`
- [x] Herramienta de relación: el primer clic fija `pendingConnection.sourceId`, el segundo cierra la arista; `Esc` cancela
- [x] `interaction/useKeyboard.ts` — `Supr`, `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+Y`, `Ctrl+A`, flechas 1px / `Shift` 10px, `Ctrl+0` `fitView`, `Esc`. Ignora los eventos originados en un input
- [ ] `Ctrl+D` duplicar (ids nuevos, incluidos los de los miembros, con offset)
- [x] Snap a grilla de 8px (falta el interruptor en la barra para apagarlo)

**Listo cuando**: se puede modelar un dominio de 10 clases usando solo la paleta y el
teclado, sin abrir el inspector.

---

## 8. Inspector (`src/inspector/`)

- [x] `Inspector.tsx` — delega según la selección: vacía / nodo / arista / múltiple. Máximo ~120 líneas
- [x] `NodeInspector.tsx` — nombre, `isAbstract`, visibilidad, keywords, y un `CompartmentEditor` **por cada** compartimento de la spec
- [x] `CompartmentEditor.tsx` — lista reordenable de miembros, agregar y borrar, editor según `memberKind`
- [x] `members/PropertyEditor.tsx` — tipo, multiplicidad, valor por defecto, `static` / `derived` / `readOnly` / `ordered` / `unique`
- [x] `members/OperationEditor.tsx` + `members/ParameterList.tsx` — tipo de retorno, flags, y la lista de parámetros con su dirección
- [x] `members/MemberEditor.tsx` — switch exhaustivo sobre `Member['kind']`: agregar una variante de miembro obliga a escribir su editor (§7.4, paso 3)
- [x] `EdgeInspector.tsx` — nombre + `nameDirection`, `routing`, y un `EndEditor` por extremo; los campos se ocultan según `spec.supports`
- [x] `fields/` — `TextField`, `SelectField`, `CheckboxField`, `VisibilityField` (+ variante anulable para los extremos), `MultiplicityField` (datalist con `1`, `0..1`, `0..*`, `1..*`, `*` + texto libre)
- [x] Todos los campos aplican en `onBlur` o con debounce ≥300 ms, nunca por tecla (§9)

**Listo cuando**: cualquier campo del modelo de §5.2 y §5.3 es editable desde el
inspector, y el historial no acumula una entrada por pulsación.

---

## 9. Exportar / importar (`src/io/`)

- [x] `serialize.ts` — `serialize(doc)`: refresca `meta.updatedAt` y devuelve el objeto. **Sin traducción de forma**
- [x] `deserialize.ts` — `JSON.parse` → `migrate` → `schema.parse` → reemplaza el `doc` del store, resetea historial y selección. Los errores de zod se muestran legibles, nunca en pantalla en blanco
- [x] `file.ts` — `downloadDocument(doc)` (`<a download>` con `application/json`, nombre `<meta.name>.uml.json`) y `readDocumentFile(file)`
- [x] `ui/Toolbar.tsx` — botones "Exportar JSON" / "Importar JSON" y el nombre del modelo editable. **Nada de `localStorage`**
- [x] `uml/model/fullSampleDocument.ts` — documento de referencia: las 6 relaciones, los 2 clasificadores, miembros con todos los flags, parámetros con las 4 direcciones, nodo redimensionado, estilo, keywords, waypoints y viewport desplazado
- [x] Test `roundtrip.test.ts` — `deserialize(serialize(doc))` es `toEqual(doc)` salvo `updatedAt`, más punto fijo de bytes y verificación de que todas las claves persistidas son ASCII (§5.1)
- [x] Tests de rechazo: `schemaVersion: 99` → error explícito; `edge.source` inexistente → error

**Listo cuando**: el round-trip pasa en test y a mano — exportar, recargar la página,
importar y obtener lo mismo, viewport incluido.

---

## 10. Cierre de la fase

- [ ] Panel de validación (lista de `Issue[]`) y subrayado en el elemento. **Advierte, no bloquea**
- [ ] Minimapa, controles de zoom y grilla revisados con zoom extremo
- [x] Ningún archivo pasa de ~300 líneas (§12); si alguno se pasó, se parte
- [x] `npm run typecheck`, `npm run lint` y `npm test` limpios
- [ ] `README.md` reescrito: qué es, cómo se corre, y la receta para agregar un clasificador (§7.4)
- [ ] Prueba de aceptación de §13: 10 clases, las 6 relaciones, exportar, recargar, importar, idéntico

---

## Fuera de alcance (no se escribe ni "el esqueleto")

Axios, cualquier `fetch`, autosave, `localStorage`, sockets, Yjs, `elkjs`, exportar
PNG/SVG, paquetes, notas, enumeraciones, tipos de dato, dependencia, clase de asociación
y generación de código. Todo eso es fase 2 o posterior, y ya está descrito en
`CLAUDE.md` §13.

---

## Decisiones a confirmar antes del bloque 4

1. **Clase abstracta.** Propuesta: no es un `kind` del registry, es `isAbstract: true`
   sobre `class`, y la paleta ofrece "Clase abstracta" como un segundo botón que despacha
   `addNode` con ese flag. La alternativa (un spec `abstract-class` propio) respeta la
   regla "una herramienta = una spec", pero deja dos formas de decir lo mismo en el
   documento y obliga a decidir qué pasa al desmarcar "abstracta" en el inspector.
2. **Waypoints en fase 1.** Propuesta: el campo existe en el modelo y se serializa, pero
   la UI todavía no deja crear puntos intermedios (`routing: 'straight'` por defecto). El
   ruteo ortogonal llega con `elkjs` en fase 2.
3. **Vite 8 y oxlint** en lugar de vite 7 y ESLint, como dice la tabla del bloque 0.
