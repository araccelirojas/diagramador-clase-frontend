# CLAUDE.md — Diagramador UML 2.5 (frontend)

Documento de contexto y reglas para trabajar en este repositorio. Léelo completo antes
de escribir código. Si una decisión de este archivo entra en conflicto con lo que parece
"más rápido", gana este archivo; si crees que está equivocado, propón el cambio antes de
implementarlo.

---

## 1. Qué es este proyecto

Editor web de **diagramas de clases UML 2.5+**. El usuario arrastra clasificadores
(clases, interfaces, enumeraciones…) a un lienzo infinito, edita sus compartimentos
(nombre, atributos, operaciones) y los conecta con relaciones UML (asociación,
agregación, composición, generalización, realización, dependencia).

Es solo el **frontend**. El backend existe aparte y expone proyectos con un atributo
`contenido` donde se guarda el diagrama completo serializado.

### Objetivos de diseño, en orden de prioridad

1. **Extensibilidad de elementos.** Ninguna librería trae los elementos UML completos.
   Agregar un clasificador o una relación nueva debe costar *un archivo de spec*, no
   tocar el renderer, ni el panel de propiedades, ni el store.
2. **Un modelo de datos que sobreviva.** El JSON que se guarda en `contenido` es el
   contrato con el backend, con el export a archivo y con el futuro generador de código.
   Se diseña una vez, bien, y se versiona.
3. **Preparado para persistencia y colaboración sin implementarlas todavía.** Las
   decisiones de arquitectura de la fase 1 se toman pensando en las fases 3 y 4.
4. Que el lienzo se sienta bien: fluido, con atajos, sin fricción.

---

## 2. Estado actual y alcance

**Fase 1 cerrada. Fase activa: 3 — sesión, proyectos y los elementos que faltaban.**

**`SCHEMA_VERSION` va por 2.** La 2 agregó `node.associationId` para la clase de
asociación; `migrations.ts` trae el paso 1 → 2 y los documentos guardados en v1 siguen
abriendo.

La fase 1 (el diagramador puro, todo en memoria) está completa. Su checklist vive en
`docs/PHASE-1-CHECKLIST.md`.

Lo que la fase 3 ya habilitó, y que en fase 1 estaba prohibido:

- **Llamadas HTTP**, con `fetch` y sin axios. Todas viven en `src/api/`; ningún otro
  directorio construye una URL ni toca `fetch`.
- **Sesión con JWT**: login, registro y rutas protegidas (`src/auth/`, `src/pages/`).
  El token se guarda en `localStorage`; es lo único que se guarda ahí.
- **Carga del diagrama desde el backend**: `GET /proyectos/:id/contenido` pasa por
  `io/projectContent.ts`, que valida con zod y migra igual que la importación de archivo.
- **Autoguardado** (`src/sync/useAutosave.ts`): debounce de 1,5 s tras dejar de editar
  como mecanismo principal, latido de 15 s *si* `isDirty` como red de seguridad, y
  guardado al cerrar el editor — cambio de ruta, cierre de pestaña, recarga o cambio de
  app. El guardado de cierre usa `keepalive`, sin el cual el navegador cancela la
  petición mientras la página se descarga.

  Todo guardado hace antes `blur()` del campo enfocado: `InlineInput` y `TextField` solo
  despachan al store en blur o Enter, así que un nombre a medio escribir **no está** en el
  documento todavía. Si agregas un editor de texto nuevo, respeta esa regla o el
  autoguardado no verá lo que el usuario acaba de escribir.

Lo que **sigue prohibido** hasta que se implemente su bloque:

- **`localStorage` del documento.** El autoguardado va contra el backend, no contra el
  navegador. Un snapshot con formato viejo cacheado en el cliente sigue siendo una fuente
  de bugs fantasma; lo único que se guarda ahí es el token de sesión.
**Fase 4 (sockets) implementada.** Una sala por proyecto, los comandos viajan por el
socket tal como anticipaba §6.2, y el guardado pasa a tener **un temporizador por sala en
el servidor** en vez de uno por cliente. Ver `docs/PHASE-3-CHECKLIST.md` §10 y
`src/sync/useCollaboration.ts`.

Los botones de desarrollo **"Exportar JSON" / "Importar JSON"** se quedan: son el banco de
pruebas del formato de `contenido`, y el archivo que escriben es byte por byte el objeto
que el backend guarda. Si el round-trip exportar → importar deja de reproducir el diagrama
idéntico, el formato está mal y se arregla ahí, no en el backend.

El checklist de la fase 3, con el contrato real del backend y lo que queda pendiente
(guardar, `version` para el bloqueo optimista, invitaciones), está en
`docs/PHASE-3-CHECKLIST.md`.

---

## 3. Stack

| Paquete | Versión objetivo | Rol |
|---|---|---|
| `react` + `react-dom` | 19.x | — |
| `typescript` | 5.x, `strict: true` | — |
| `vite` | 7.x | build + dev server |
| `@xyflow/react` | ^12.11 | **motor del lienzo**: viewport, pan/zoom, nodos, aristas, handles, selección |
| `zustand` | ^5 | estado del documento |
| `immer` | ^10 | mutaciones inmutables legibles (vía `zustand/middleware/immer`) |
| `zod` | última estable | esquema del documento + validación en import y en carga |
| `nanoid` | ^5 | ids de nodos, aristas y miembros |
| `tailwindcss` | 4.x con `@tailwindcss/vite` | estilos de la interfaz |
| `lucide-react` | última | iconos de la paleta y la barra |
| `vitest` | última | tests de serializador, comandos y validadores |

**Fases posteriores** (no instalar todavía): `elkjs` (auto-layout y ruteo ortogonal),
`axios` (fase 3), `yjs` + `y-websocket` o `socket.io-client` (fase 4).

### Por qué React Flow y no otra cosa

- **tldraw**: técnicamente excelente, pero su SDK es source-available y el uso en
  producción requiere licencia comercial (~6.000 USD/año). Además su librería de formas
  es mínima: igual escribirías las shapes UML a mano. Pagas *y* construyes.
- **JointJS+ / GoJS**: traen UML de fábrica, pero son de pago y su arquitectura
  modelo-vista propia pelea con React.
- **jsPlumb**: comunidad mucho más chica y render lento sin virtualización.
- **React Flow**: MIT, v12 estable sin ruptura de API desde 2024, releases constantes,
  y hace exactamente lo difícil (viewport, hit-testing, arrastre, conexiones).

**Lo que React Flow NO da y escribimos nosotros** — asúmelo, no lo busques en la API:

- Las puntas de flecha UML. Trae `MarkerType.Arrow` y `ArrowClosed`; el rombo hueco, el
  rombo relleno y el triángulo hueco de herencia los definimos como `<marker>` SVG propios.
- Ruteo ortogonal que esquiva cajas. `getSmoothStepPath` es un escalón simple.
- Etiquetas de multiplicidad y rol posicionadas cerca de cada extremo de la arista.

### Reglas sobre dependencias

No agregues librerías sin preguntar. En particular **no** se usa `react-dnd`,
`react-rnd` ni `react-zoom-pan-pinch`: el drag desde la paleta se hace con el
drag-and-drop nativo de HTML5 (≈20 líneas), el resize con `<NodeResizer>` de React Flow,
y el viewport lo maneja React Flow.

---

## 4. Estructura de carpetas

```
src/
  app/
    App.tsx                  layout general (paleta | lienzo | inspector)
    routes.tsx
  canvas/
    UmlCanvas.tsx            <ReactFlow> configurado; nada de lógica de negocio
    nodeTypes.ts             mapa kind → componente, derivado del registry
    edgeTypes.ts             mapa kind → componente, derivado del registry
    nodes/
      ClassifierNode.tsx     ÚNICO componente de nodo; renderiza compartimentos por spec
      NoteNode.tsx
      PackageNode.tsx
    edges/
      UmlEdge.tsx            ÚNICO componente de arista; markers y labels por spec
      geometry.ts            intersección con el rectángulo, puntos flotantes, offsets
    markers/
      UmlMarkers.tsx         <defs> con todos los <marker>
      markerIds.ts
    interaction/
      useCanvasTool.ts       herramienta activa (select / clasificador / relación)
      usePaletteDrop.ts      DnD nativo → screenToFlowPosition
      useKeyboard.ts         atajos
  uml/
    registry/
      classifiers/           una spec por archivo: class.ts, interface.ts, enum.ts…
      relations/             una spec por archivo: association.ts, composition.ts…
      index.ts               registra y expone los mapas
      types.ts               ClassifierSpec, RelationSpec, CompartmentSpec
    model/
      types.ts               UmlDocument, UmlNode, UmlEdge, Property, Operation…
      schema.ts              esquemas zod
      factories.ts           createNode, createProperty, createOperation…
      format.ts              formateo UML de miembros: "+ nombre : Tipo [0..*]"
      validators.ts          reglas semánticas UML (ver §9)
      migrations.ts          schemaVersion N → N+1
  state/
    useDiagramStore.ts       store zustand (documento + selección + herramienta)
    commands/                TODA mutación del documento vive acá
      index.ts               registro nombre → función
      nodes.ts
      edges.ts
      members.ts
    selectors.ts             derivaciones memoizadas, incluido el adaptador React Flow
    history.ts               undo/redo
  inspector/
    Inspector.tsx            panel derecho; delega según el tipo seleccionado
    fields/                  inputs reutilizables (visibilidad, multiplicidad, tipo…)
  palette/
    Palette.tsx              se construye leyendo el registry, no a mano
  io/
    serialize.ts             store → documento canónico
    deserialize.ts           documento canónico → store (con zod + migraciones)
    file.ts                  descargar / leer archivo .uml.json
  ui/                        botones, modales, tooltips genéricos
  lib/                       utilidades puras sin dependencias del dominio
```

Regla estructural: `uml/` y `state/commands/` no importan nada de `@xyflow/react`. El
modelo de dominio no sabe que existe React Flow. Eso es lo que permite testearlo con
Vitest sin DOM y lo que permitiría cambiar de motor de lienzo sin reescribir el dominio.

---

## 5. El modelo de datos: `contenido`

Este es el contrato. El backend guarda **este objeto tal cual** en el atributo
`contenido` del proyecto (columna `jsonb` idealmente). El archivo `.uml.json` que se
exporta es **el mismo objeto**, byte por byte. Un solo formato para todo.

### 5.1 Forma del documento

```jsonc
{
  "schemaVersion": 1,
  "kind": "uml-class-model",

  "meta": {
    "name": "Sistema de Matrículas",
    "createdAt": "2026-09-10T14:00:00.000Z",
    "updatedAt": "2026-09-10T14:32:11.000Z"
  },

  // Pestañas / vistas. En fase 1 siempre existe exactamente una: "d_main".
  "diagrams": [
    { "id": "d_main", "name": "Modelo de dominio", "viewport": { "x": 0, "y": 0, "zoom": 1 } }
  ],

  // Colecciones indexadas por id, NO arrays. Ver §11.
  "nodes": {
    "n_7Kd2": { /* ver 5.2 */ }
  },
  "edges": {
    "e_9fLp": { /* ver 5.3 */ }
  }
}
```

**Todas las claves en inglés y ASCII.** Nada de `pestañas` ni `relaciónes`. Una ñ en una
clave persistida es una fuente silenciosa de problemas de encoding entre navegador,
backend y base de datos.

### 5.2 Nodos

```ts
type UmlNode = {
  id: string;                    // 'n_' + nanoid(8)
  diagramId: string;
  kind: ClassifierKind;          // clave del registry: 'class' | 'interface' | ...
  name: string;

  keywords: string[];            // estereotipos: ['entity'] → «entity»
  isAbstract: boolean;
  visibility: Visibility;        // '+' | '-' | '#' | '~'

  // --- capa de presentación (layout), no modelo UML ---
  position: { x: number; y: number };      // ABSOLUTAS en coordenadas del mundo
  size: { width: number; height: number | null };  // null = alto derivado del contenido
  z: number;
  style?: { fill?: string; stroke?: string };

  parentId: string | null;       // paquete contenedor, o null

  // Solo en una clase de asociación: el id de la arista de la que cuelga.
  // En UML 2.5 una AssociationClass es UN elemento que es a la vez Association
  // y Class; acá nodos y aristas viven en colecciones separadas, así que se
  // guarda como nodo que apunta a su arista. El puntero va en el nodo porque el
  // nodo es la mitad dependiente: una asociación sobrevive a perder su clase,
  // una clase de asociación no sobrevive a perder su asociación.
  associationId: string | null;

  // Compartimentos indexados por el id que declara la spec del clasificador.
  // Una clase usa 'attributes' y 'operations'; una enum usa 'literals' y 'operations'.
  // Agregar un compartimento nuevo NO requiere cambiar este tipo.
  compartments: Record<string, Member[]>;
};
```

Sobre `position`: **absolutas**, en unidades del mundo. No normalizadas 0..1. El lienzo
UML es infinito y no tiene un marco de referencia respecto al cual normalizar. El zoom y
el desplazamiento son estado de vista y viven en `diagrams[].viewport`.

Sobre `height: null`: el alto de un clasificador lo determina su contenido. Solo se
guarda un número si el usuario redimensionó a mano.

### Miembros

```ts
type Visibility = '+' | '-' | '#' | '~';

type Property = {
  kind: 'property';
  id: string;
  name: string;
  type: string | null;
  visibility: Visibility;
  multiplicity: string | null;   // '1', '0..*', '1..*'
  defaultValue: string | null;
  isStatic: boolean;
  isDerived: boolean;            // se renderiza como /nombre
  isReadOnly: boolean;
  isOrdered: boolean;
  isUnique: boolean;
};

type Operation = {
  kind: 'operation';
  id: string;
  name: string;
  visibility: Visibility;
  parameters: Parameter[];
  returnType: string | null;
  isStatic: boolean;
  isAbstract: boolean;
  isQuery: boolean;              // {query}
};

type Parameter = {
  id: string;
  name: string;
  type: string | null;
  direction: 'in' | 'out' | 'inout' | 'return';
  defaultValue: string | null;
};

type Literal = { kind: 'literal'; id: string; name: string };

type Member = Property | Operation | Literal;
```

`Member` es una unión discriminada por `kind`. Agregar un tipo de miembro nuevo
(receptions, ports, restricciones) es agregar una variante, y TypeScript te obliga a
cubrirla en el formateador y el inspector. Eso es deseable.

### 5.3 Aristas

```ts
type UmlEdge = {
  id: string;                    // 'e_' + nanoid(8)
  diagramId: string;
  kind: RelationKind;            // clave del registry
  source: string;                // id de nodo
  target: string;
  name: string | null;           // nombre de la asociación
  nameDirection: 'none' | 'sourceToTarget' | 'targetToSource';  // el triangulito ▸

  ends: {
    source: AssociationEnd;
    target: AssociationEnd;
  };

  // --- layout ---
  waypoints: { x: number; y: number }[];
  routing: 'straight' | 'orthogonal' | 'bezier';
};

type AssociationEnd = {
  role: string | null;
  multiplicity: string | null;
  visibility: Visibility | null;
  navigable: boolean | null;     // null = no especificado (UML lo distingue de false)
  isOrdered: boolean;
  isUnique: boolean;
};
```

**Decisión que hay que entender:** en el metamodelo UML 2.5 estricto, agregación y
composición no son tipos de relación — son el valor de la propiedad `aggregation`
(`none` / `shared` / `composite`) de un *extremo* de asociación. Aquí las tratamos como
`kind` distintos porque el registry se indexa por notación visual y así cada herramienta
de la paleta es exactamente una spec. La traducción al metamodelo correcto es
responsabilidad del futuro exportador, y está documentada en cada spec de relación.
No "arregles" esto convirtiéndolo a `aggregation` en el modelo sin discutirlo: rompería
la uniformidad del registry, que es la prioridad #1 del proyecto.

### 5.4 Invariantes

Estas se validan en `schema.ts` y en los tests. Si una operación las puede romper, la
operación está mal.

1. Todo `edge.source` y `edge.target` referencia un nodo existente **del mismo `diagramId`**.
2. Todo `node.parentId` referencia un nodo existente de `kind: 'package'`, sin ciclos.
3. Los ids son únicos en todo el documento, incluidos los ids de miembros.
4. Borrar un nodo borra en cascada sus aristas incidentes y despadra a sus hijos.
5. `schemaVersion` siempre presente. Al cargar, si es menor que la actual, pasa por
   `migrations.ts`; si es mayor, se rechaza el documento con un mensaje claro en vez de
   intentar abrirlo.
6. Todo `node.associationId` no nulo referencia una arista existente **del mismo
   `diagramId`**. Borrar esa arista borra el nodo en cascada: una clase de asociación
   colgando de nada es un documento corrupto, no uno incompleto.

---

## 6. Arquitectura del estado

### 6.1 El store

```ts
type DiagramState = {
  doc: UmlDocument;                  // el documento canónico, tal cual se guarda
  activeDiagramId: string;
  selection: { nodes: string[]; edges: string[] };
  tool: ToolState;                   // 'select' | { classifier: kind } | { relation: kind }
  pendingConnection: { sourceId: string } | null;
  isDirty: boolean;                  // ya existe en fase 1 aunque nadie lo consuma
};
```

Un solo store con `zustand` + middleware `immer`. **Nada de `useState` para estado del
documento.** Si un componente necesita un dato del documento, lo lee con un selector.

Nada de `useRef` como espejo del estado. Si necesitas leer el estado desde fuera de
React (un timer, un handler de socket), usa `useDiagramStore.getState()`.

### 6.2 Comandos: la regla más importante del proyecto

**Toda mutación del documento pasa por un comando** en `state/commands/`. Un comando es
una función pura sobre el draft de immer, con un nombre y un payload serializable:

```ts
// state/commands/nodes.ts
export const addNode = defineCommand(
  'node.add',
  (draft, payload: { node: UmlNode }) => {
    draft.nodes[payload.node.id] = payload.node;
  }
);

export const moveNodes = defineCommand(
  'node.move',
  (draft, payload: { ids: string[]; delta: { x: number; y: number } }) => {
    for (const id of payload.ids) {
      const n = draft.nodes[id];
      if (!n) continue;
      n.position.x += payload.delta.x;
      n.position.y += payload.delta.y;
    }
  }
);
```

Ningún componente hace `set(state => { state.doc.nodes[id].name = ... })` directamente.
Llama a `dispatch(renameNode({ id, name }))`.

Esto cuesta un poco más hoy y paga tres veces:

- **Undo/redo** se implementa una sola vez, sobre `dispatch`, y funciona para todo.
- **Colaboración** (fase 4) es difundir `{ command: 'node.move', payload }` por el
  socket y aplicarlo en el otro cliente. Si las mutaciones estuvieran repartidas por los
  componentes, esto sería una reescritura.
- **Tests**: los comandos son funciones puras. `expect(apply(doc, moveNodes(...)))`.

Corolario: **el payload de un comando debe ser JSON serializable**. Nada de funciones,
`Date`, `Map`, referencias a nodos del DOM ni objetos de React Flow.

### 6.3 Selectores y el adaptador de React Flow

El documento guarda `nodes` y `edges` como `Record<id, T>`. React Flow necesita arrays.
La conversión vive en `state/selectors.ts`, memoizada, y filtra por `activeDiagramId`:

```ts
export const selectFlowNodes = (s: DiagramState): Node<UmlNodeData>[] => ...
```

Nunca guardes el array de React Flow como estado. Es una derivación.

Y al revés: los `NodeChange` / `EdgeChange` de React Flow se traducen a comandos en un
solo lugar (`canvas/UmlCanvas.tsx`). Ahí es donde se filtra el ruido:

```ts
const onNodesChange = (changes: NodeChange[]) => {
  for (const c of changes) {
    if (c.type === 'position' && c.dragging === false) {
      dispatch(moveNodes({ ids: [c.id], delta: /* ... */ }));   // commit al soltar
    }
    // durante el arrastre solo se actualiza la posición efímera, sin ensuciar el doc
  }
};
```

Arrastrar un nodo emite decenas de eventos por segundo. Solo el evento final es un
cambio del documento. Esto importa para el historial (un arrastre = un undo) y para el
autosave de la fase 3.

**Cuidado con los cambios `dimensions`.** Hay dos clases y se distinguen por un campo:

- Los del `<NodeResizer>` traen `resizing: true` durante el gesto y `resizing: false` al
  soltar. Ese último **sí** es un cambio del documento (`resizeNode`).
- Los de la *medición* del DOM no traen `resizing` en absoluto. No son un cambio del
  documento, pero **no se pueden descartar**: React Flow los usa para poblar
  `node.measured`, y todo lo que lee los nodos por el array público —el minimapa el
  primero— pregunta por `nodeHasDimensions(node)`, que busca `measured`, `width` o
  `initialWidth` **en el objeto del nodo**. Nuestros nodos solo llevan `style.width`, así
  que si se tiran esos cambios el minimapa no encuentra dimensiones y **no dibuja nada**.

`UmlCanvas` los guarda en un `measured` local, estado de vista efímero: el documento dice
`height: null` para las cajas cuyo alto sale del contenido (§5.2) y eso no se persiste
(§10.2).

### 6.4 Undo / redo

Implementación de fase 1: pila de snapshots del `doc`, límite 50 entradas, con
coalescencia por tiempo para no crear una entrada por cada tecla al escribir un nombre.
`Ctrl+Z` / `Ctrl+Shift+Z`. Es suficiente y se hace en una tarde.

No inviertas en comandos inversos ahora. Si en la fase 4 se migra a Yjs, el historial lo
provee Yjs (`UndoManager`) y este código se borra.

---

## 7. El registry: cómo se agregan elementos

Esta es la razón de ser de la arquitectura. Un elemento UML nuevo **no** implica un
componente React nuevo.

### 7.1 `ClassifierSpec`

```ts
// uml/registry/types.ts
export type CompartmentSpec = {
  id: string;                       // 'attributes'
  label: string;                    // 'Atributos' (para el inspector)
  memberKind: Member['kind'];       // 'property' | 'operation' | 'literal'
  hideWhenEmpty?: boolean;
  separator?: 'line' | 'none';
};

export type ClassifierSpec = {
  kind: string;
  label: string;                    // 'Clase' — texto de la paleta
  icon: LucideIcon;
  group: 'classifiers' | 'structure' | 'annotations';

  defaultKeywords?: string[];       // ['interface'] → se dibuja «interface»
  defaultName: string;              // 'Clase1'
  defaultSize: { width: number; height: number | null };
  nameStyle?: { italic?: boolean; centered?: boolean };
  header?: 'compartment' | 'tab' | 'plain';   // paquete usa 'tab'

  compartments: CompartmentSpec[];

  canBeAbstract: boolean;
  canContain?: (childKind: string) => boolean;   // para paquetes
  validate?: (node: UmlNode, doc: UmlDocument) => Issue[];

  /** Solo si el nodo necesita un render que no sea la caja de compartimentos. */
  render?: React.ComponentType<ClassifierRenderProps>;
};
```

`ClassifierNode.tsx` lee la spec y dibuja: cabecera (estereotipo, nombre, con itálica si
`isAbstract`) más un compartimento por cada entrada de `compartments`, separados por
línea. **Un solo componente cubre clase, interfaz, enumeración, tipo de dato, clase
abstracta y clase de asociación.** `render` es la válvula de escape para los casos que
de verdad no son una caja de compartimentos (nota, paquete).

### 7.2 `RelationSpec`

```ts
export type RelationSpec = {
  kind: string;
  label: string;                    // 'Composición'
  icon: LucideIcon;

  line: 'solid' | 'dashed';
  sourceMarker: MarkerId | null;    // MARKERS.diamondFilled
  targetMarker: MarkerId | null;    // MARKERS.arrowOpen

  supports: {
    multiplicity: boolean;          // generalización: false
    roles: boolean;
    name: boolean;
    navigability: boolean;
  };

  defaultEnds?: Partial<{ source: Partial<AssociationEnd>; target: Partial<AssociationEnd> }>;

  /** Se consulta en vivo mientras el usuario arrastra la conexión. */
  isValidConnection?: (source: UmlNode, target: UmlNode, doc: UmlDocument) => boolean;
  validate?: (edge: UmlEdge, doc: UmlDocument) => Issue[];

  /** Nota de traducción al metamodelo UML 2.5 para el futuro exportador. */
  metamodelNote?: string;
};
```

### 7.3 Markers

Todos los `<marker>` se declaran una sola vez en `canvas/markers/UmlMarkers.tsx`, que se
monta dentro del `<svg>` del lienzo, y sus ids son constantes en `markerIds.ts`:

```ts
export const MARKERS = {
  arrowOpen:      'uml-arrow-open',        // ⟶ dependencia, asociación dirigida
  triangleHollow: 'uml-triangle-hollow',   // ▷ generalización, realización
  diamondHollow:  'uml-diamond-hollow',    // ◇ agregación
  diamondFilled:  'uml-diamond-filled',    // ◆ composición
  circleFilled:   'uml-circle-filled',     // ● opcional
} as const;
```

Detalles no negociables porque cuestan una tarde descubrirlos:

- `markerUnits="userSpaceOnUse"` en todos, si no escalan con el grosor de la línea.
- `refX` colocado para que la **punta** toque el borde del nodo, no el centro del marker.
- El rombo va en `marker-start` con `orient="auto"`: la dirección del path va del origen
  al destino, así que el rombo se dibuja "hacia adelante" desde el extremo del todo.
- Fondo del triángulo y del rombo hueco: relleno del lienzo, no `none`. Si es `none`, la
  línea se ve pasando por dentro de la figura.

### 7.4 Receta: agregar un clasificador nuevo

Ejemplo, `«datatype»`:

1. Crear `uml/registry/classifiers/datatype.ts` exportando un `ClassifierSpec`.
2. Registrarlo en `uml/registry/classifiers/index.ts`.
3. Si introduce un tipo de miembro que no existe, agregar la variante a `Member`,
   su factory en `factories.ts`, su formateo en `format.ts` y su editor en
   `inspector/fields/`. TypeScript te va a señalar cada lugar que falta.
4. Si cambia la forma del documento, subir `schemaVersion` y escribir la migración.

Nada más. La paleta, el nodo, el inspector y el serializador ya lo soportan.

### 7.5 Receta: agregar una relación nueva

1. Crear `uml/registry/relations/<nombre>.ts` con el `RelationSpec`.
2. Si necesita una punta de flecha que no existe, agregar el `<marker>` a `UmlMarkers`
   y su id a `MARKERS`.
3. Registrarla en el índice.

Si al agregar un elemento tuviste que tocar `ClassifierNode.tsx`, `UmlEdge.tsx` o
`Inspector.tsx`, algo está mal en la abstracción. Pará y reportalo.

---

## 8. Catálogo UML 2.5 objetivo

### Clasificadores y nodos

| Elemento | Notación | Fase |
|---|---|---|
| Clase | caja de 3 compartimentos | 1 |
| Clase abstracta | nombre en itálica | 1 |
| Interfaz | «interface» | 1 |
| Enumeración | «enumeration» + compartimento de literales | 2 |
| Tipo de dato | «datatype» | 2 |
| Clase de asociación | caja unida a una arista con línea punteada | 3 ✅ |

La clase de asociación es la única entrada del catálogo que vive en **Relaciones** y no en
Clasificadores: se dibuja uniendo dos clases, y la caja nace con la línea. Su `RelationSpec`
declara `classifierKind` y su `ClassifierSpec` declara `attachedToRelation`, que es lo que
lo mantiene fuera de la paleta sin dejar de estar registrado para poder renderizarse.
Ambas mitades son un solo elemento UML: un solo comando las crea y cada una arrastra a la
otra al borrarse.
| Paquete | rectángulo con pestaña, contenedor | 2 |
| Nota / comentario | rectángulo con esquina doblada + ancla punteada | 2 |
| Restricción `{...}` | texto sobre elemento o arista | 3 |
| Interfaz provista / requerida (lollipop / socket) | ○ y ⊂ | 3 |

### Relaciones

| Relación | Línea | Origen | Destino | Fase |
|---|---|---|---|---|
| Asociación simple | continua | — | — | 1 |
| Asociación dirigida | continua | — | flecha abierta | 1 |
| Agregación | continua | rombo hueco | — | 1 |
| Composición | continua | rombo relleno | — | 1 |
| Generalización | continua | — | triángulo hueco | 1 |
| Realización | punteada | — | triángulo hueco | 1 |
| Dependencia | punteada | — | flecha abierta | 2 |
| Uso «use» / «create» | punteada + keyword | — | flecha abierta | 2 |
| Anidamiento (paquete) | continua | ⊕ | — | 3 |
| Import / merge de paquete | punteada + keyword | — | flecha abierta | 3 |
| Asociación n-aria | rombo central | — | — | 4, si sobra tiempo |

Adornos de extremo soportados desde la fase 1 en el modelo, aunque la UI los exponga
después: multiplicidad, nombre de rol, visibilidad, navegabilidad, `{ordered}`,
`{unique}`, nombre de asociación con dirección de lectura.

---

## 9. Interacción del lienzo

### Creación

Dos caminos, ambos obligatorios:

- **Arrastrar** desde la paleta y soltar en el lienzo. DnD nativo:
  `onDragStart` guarda el `kind` en `dataTransfer`; el `onDrop` del lienzo convierte con
  `screenToFlowPosition(...)`. **Nunca** hagas la aritmética de zoom a mano: ese es
  exactamente el error del proyecto anterior.
- **Clic en la herramienta** y luego clic en el lienzo. Más rápido para crear varios.
  `Esc` vuelve a la herramienta de selección.

### Conexiones

`connectionMode={ConnectionMode.Loose}` y **aristas flotantes**: el punto de anclaje se
calcula como la intersección de la recta entre centros con el rectángulo del nodo, en
`canvas/edges/geometry.ts`. Así el usuario conecta desde cualquier parte del borde y la
arista sigue a la caja al moverla, sin handles fijos visibles en las cuatro esquinas.

### Las tres rutas y los puntos de doblez

`edge.routing` es `straight`, `orthogonal` o `bezier`, y el usuario puede doblar cualquiera
arrastrando un waypoint. **`edgeGeometry()` decide extremos y trazado juntos, en una sola
llamada**, y esa unión no es un capricho: en una arista ortogonal el lado por el que sale
la línea *es* la dirección de su primer tramo. Calcularlos por separado fue lo que dejó que
se contradijeran.

Lo que cada ruta necesita, y lo que costó descubrirlo:

- **`straight`** — polilínea por los waypoints. Extremos por intersección con el rectángulo.
- **`bezier`** — curva suave que pasa **por** cada waypoint, no cerca: Catmull-Rom
  convertido a cúbicas. Y los tiradores van en el eje dominante de la arista; ponerlos
  siempre en horizontal hacía que dos cajas apiladas se abombaran de lado.
- **`orthogonal`** — el anclaje es **el centro del lado que mira al vecino**, no el punto
  diagonal, porque un tramo ortogonal tiene que salir perpendicular al borde. Cuando los
  dos extremos salen por el mismo eje y no están alineados, un solo codo no alcanza: el
  trazado necesita un rodeo por el medio.

Si agregás una ruta nueva, agregala en `pathFor` y en `pointsAlong`, no en el componente.

**Auto-asociaciones.** Una relación de un elemento consigo mismo es UML legal y se dibuja
como un **bucle** (`selfLoopPoints`): sale por arriba, rodea la esquina y vuelve a entrar
por el lado derecho. Los extremos flotantes no sirven ahí —la recta entre dos centros que
son el mismo punto no tiene dirección— y además el bucle deja los dos extremos separados,
que es lo que permite poner una multiplicidad distinta en cada uno.

No se rechaza en `connectionRules`: cada spec decide. Generalización y realización sí la
rechazan, porque nada hereda de sí mismo ni se implementa a sí mismo.

`isValidConnection` consulta el `RelationSpec` activo. Feedback visual inmediato: borde
verde si la conexión es válida, rojo si no. Ejemplos de reglas: una realización va de un
clasificador a una interfaz; una generalización no admite ciclos ni auto-referencia.

### Edición

- Doble clic en el nombre → edición inline.
- Doble clic en un compartimento → agrega un miembro y lo pone en edición.
- El **inspector** de la derecha es la vista completa: todos los adornos UML que no
  caben en la edición inline (multiplicidades, parámetros, `{ordered}`, navegabilidad).
- Los cambios del inspector se aplican en `onBlur` o con debounce, no en cada tecla,
  para no llenar el historial.

### El campo de tipo: ofrecer, no vigilar

`TypeField` (atributos, parámetros y retorno) es un selector con tres grupos: los
primitivos de UML 2.5, los tipos de dato que trae Enterprise Architect de fábrica, y **los
clasificadores que hay en el documento**, derivados de `doc.nodes`. El catálogo vive en
`uml/model/dataTypes.ts`.

`type` **sigue siendo un string libre en el modelo** (§5.2) y no se convierte en un enum.
La opción "Otro…" baja a un input de texto, y un valor que la lista no conoce —`List<Curso>`,
un tipo de un lenguaje que el editor no conoce, un nombre a medio escribir— se conserva y
se muestra como la selección actual. Un desplegable que borra en silencio lo que no sabe
representar es peor que una caja vacía.

### Atajos

`Supr` borrar · `Ctrl+Z` / `Ctrl+Shift+Z` · `Ctrl+D` duplicar · `Ctrl+A` seleccionar
todo · flechas mover 1px, con `Shift` 10px · `Ctrl+0` ajustar a la vista · `Esc`
cancelar herramienta o conexión pendiente.

### Ayudas visuales

Grilla de 8px con snap opcional. Guías de alineación al arrastrar (fase 2). Minimapa y
controles de zoom de React Flow. Resaltado de las aristas incidentes al seleccionar un
nodo.

### Validación

`validators.ts` corre sobre el documento y produce `Issue[]` con severidad. Se muestran
como un subrayado en el elemento y una lista en un panel. **Advertir, no bloquear**: un
diagrama a medio hacer es inválido casi todo el tiempo y bloquear al usuario es
insoportable. Solo las conexiones se impiden en el momento de crearlas.

---

## 10. Decisiones de hoy que sirven al guardado de mañana

No implementes nada de esto en la fase 1. Solo respeta las decisiones.

1. **El estado del store ya *es* el formato de guardado.** `serialize()` es casi la
   identidad: toma `doc`, actualiza `meta.updatedAt` y devuelve. Cero traducción, cero
   divergencia entre lo que ves y lo que se guarda.
2. **Nunca persistas estado efímero.** `selected`, `dragging`, `measured`, `hovered` son
   de React Flow y del render, no del documento. Por eso el documento no guarda nodos de
   React Flow sino nodos UML.
3. **`isDirty` lo marcan los comandos y lo baja `markSaved()`** cuando un guardado
   aterriza. Implementado en fase 3 como un latido de 15 s *condicionado a la bandera*,
   más una descarga al cerrar el editor: sigue sin haber `setInterval` ciego escribiendo
   aunque nadie haya tocado nada. Falta el `Ctrl+S` manual.

   ⚠️ **`version` no existe en el schema de Prisma**, así que el bloqueo optimista de más
   abajo no está. Con autoguardado cada 15 s, dos pestañas abiertas en el mismo proyecto
   se pisan en silencio. Agregar la columna es lo primero de la próxima tanda.
4. **`schemaVersion` y `migrations.ts` existen desde el primer commit**, aunque la única
   migración sea la identidad. El formato va a cambiar a mitad del desarrollo; cuando
   pase, los diagramas ya guardados tienen que seguir abriendo.
5. **`deserialize()` valida con zod siempre.** Un `JSON.parse` seguido de acceso directo
   a propiedades convierte un documento corrupto en una pantalla en blanco sin
   explicación.

Contrato con el backend cuando llegue la fase 3, para que no haya sorpresas:

```
GET    /proyectos/:id        → { id, nombre, contenido, version, actualizadoEn }
PUT    /proyectos/:id        ← { contenido, version }   → 409 si version no coincide
GET    /proyectos            → lista SIN el campo contenido
```

`contenido` viaja como **objeto JSON**, no como string. El campo `version` es un entero
que el backend incrementa en cada escritura: es el bloqueo optimista que evita que dos
pestañas abiertas se pisen. Y el listado no debe traer `contenido`, o la pantalla de
proyectos descarga megabytes que nadie va a mirar.

---

## 11. Decisiones de hoy que sirven a la colaboración de mañana

Tampoco se implementa ahora. Pero estas cuatro decisiones son las que hacen que la fase 4
sea una semana en vez de una reescritura.

1. **`nodes` y `edges` son `Record<id, T>`, no arrays.** Los arrays son hostiles a la
   edición concurrente: si dos usuarios insertan a la vez, los índices se corrompen y las
   operaciones no conmutan. Un mapa indexado por id sí conmuta, y mapea directo a un
   `Y.Map` si se migra a Yjs.
2. **Comandos con payload serializable** (§6.2). Difundir `{ command, payload }` por el
   canal es literalmente el mecanismo de sincronización.
3. **Ids generados en el cliente** con nanoid. Nunca esperes un id del servidor para
   crear un elemento: eso obliga a un round-trip y rompe la edición offline.
4. **Granularidad de los comandos.** Un comando debe tocar lo mínimo posible. `renameNode`
   toca un campo, no reemplaza el nodo entero. Cuanto más fino el comando, menos
   conflictos entre usuarios simultáneos y menos tráfico.

Dos cosas que *no* van a estar en el documento y hay que tener presente: la presencia
(cursores, selecciones ajenas) y el estado de la conexión son **efímeros**, viven fuera
de `doc` y jamás se serializan en `contenido`.

---

## 12. Convenciones de código

- **TypeScript estricto.** `strict: true`, `noUncheckedIndexedAccess: true`. Nada de
  `any` en el dominio; si aparece un `any`, es un tipo que faltó modelar.
- **Idioma**: identificadores, tipos, nombres de archivo y comentarios en **inglés**.
  Texto visible al usuario en **español**. Las claves del JSON persistido, en inglés.
- **Componentes**: función nombrada + export default solo en las páginas. Un componente
  por archivo.
- **Tamaño**: si un archivo pasa de ~300 líneas, se parte. El proyecto anterior tenía un
  componente de 981 líneas y un panel de 1.344; ahí es donde se vuelve imposible trabajar.
- **Tests con Vitest** para lo que es puro y de alto valor: `serialize`/`deserialize`
  (round-trip), comandos, validadores, `format.ts` y la geometría de aristas. No hace
  falta testear componentes en esta fase.
- **Estilos**: Tailwind. Nada de `styled-components` ni CSS-in-JS. Las clases del nodo
  UML pueden vivir en constantes compartidas para no repetir cadenas largas.
- **Commits**: convencionales (`feat:`, `fix:`, `refactor:`), en imperativo.

---

## 13. Roadmap

### Fase 0 — Andamiaje
Vite + React + TS + Tailwind. Layout de tres zonas. React Flow montado con un nodo de
prueba. Store vacío. **Listo cuando**: se ve el lienzo, hace pan y zoom.

### Fase 1 — El diagramador (fase actual)
- Modelo de datos completo (§5) con zod y factories.
- Store + comandos + undo/redo.
- Registry con `class`, `abstract class`, `interface`.
- `ClassifierNode` genérico por compartimentos, con edición inline y `NodeResizer`.
- `UmlEdge` genérico + los 5 markers + aristas flotantes.
- Relaciones: asociación, asociación dirigida, agregación, composición, generalización,
  realización. Con multiplicidades y roles editables.
- Paleta generada desde el registry. Herramienta de selección + drag y click-to-place.
- Inspector completo para clasificadores y relaciones.
- Atajos, grilla, minimapa.
- Exportar / importar JSON con round-trip verificado por test.

**Listo cuando**: se puede modelar un dominio de 10 clases con las 6 relaciones,
exportarlo, recargar la página, importarlo y obtener exactamente lo mismo.

### Fase 2 — Cobertura UML
Enumeración, tipo de dato, paquete contenedor, nota con ancla, dependencia. Guías de
alineación. Panel de validación. Exportar PNG/SVG. Auto-layout con `elkjs`.

### Fase 3 — Persistencia
Axios con interceptor de token, carga y guardado contra `contenido`, autosave con
debounce e indicador de estado, bloqueo optimista con `version`, pestañas de diagramas
múltiples.

### Fase 4 — Colaboración
Difusión de comandos o migración a Yjs, cursores y selecciones remotas, presencia.

### Fase 5 — Generación de código
Recorrido del documento → Java / Spring Boot / TypeScript, descarga en zip desde el
backend, igual que el `exportar-flutter` del proyecto anterior.

---

## 14. Errores del proyecto anterior que no se repiten

Del diagramador de UI móvil, para no tropezar dos veces con la misma piedra:

1. Tener `zustand` instalado y el archivo del store **vacío**, con todo el estado en
   `useState` dentro de un componente de 981 líneas.
2. Espejar el estado en `useRef` (`tabsRef`, `deviceRef`, `selectedTabRef`) porque un
   `setInterval` capturaba el estado del primer render. Síntoma de lo anterior.
3. Autosave con `setInterval` cada 10 segundos, guardando aunque no hubiera cambios.
4. `JSON.parse(data.contenido)` sin validación y con acceso optimista a las propiedades.
5. Sin `schemaVersion`, sin migraciones, sin `version` para bloqueo optimista.
6. Claves con ñ (`pestañas`) en el JSON persistido.
7. Coordenadas normalizadas y aritmética de zoom manual repartida entre el drop, el move
   y el render.
8. Menús contextuales construidos con `document.createElement` dentro de un handler.

---

## 15. Reglas para Claude

- Antes de escribir código, comprobá contra este archivo: ¿la mutación pasa por un
  comando? ¿el elemento nuevo es una spec del registry? ¿el payload es serializable?
- **No implementes persistencia ni sockets en la fase 1**, ni siquiera "dejando el
  esqueleto". El esqueleto ya está descrito acá; escribirlo antes de tiempo genera código
  muerto que se desincroniza.
- **No agregues dependencias** sin proponerlo primero, con el motivo y la alternativa.
- Si una tarea te obliga a modificar `ClassifierNode.tsx`, `UmlEdge.tsx` o
  `Inspector.tsx` para soportar un elemento nuevo, **pará y decilo**: significa que la
  abstracción del registry tiene un hueco, y taparlo con un `if` por tipo es exactamente
  lo que este diseño intenta evitar.
- Cuando cambies la forma del documento: subí `schemaVersion`, escribí la migración,
  actualizá el esquema zod y el test de round-trip. Las cuatro cosas, en el mismo commit.
- Preferí una función pura en `uml/` sobre lógica dentro de un componente. Todo lo que
  sea pura geometría, formateo o validación va afuera de React.
- Cuando termines una tarea, decí en una línea qué invariante de §5.4 o qué regla de
  §11 podría haber quedado en riesgo. Si ninguna, decilo también.
