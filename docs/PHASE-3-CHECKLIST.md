# Checklist — Fase 3: autenticación y proyectos

Plan de ejecución para conectar el diagramador con el backend existente. Alcance pedido:
**login, registro, home con la lista de proyectos del usuario, y apertura del diagramador
cargando el `contenido` del proyecto.**

Convención: `[ ]` pendiente · `[x]` hecho. Cada bloque termina con su **Listo cuando**.

---

## 0. Punto de partida y decisiones

El backend ya está completo y no se rediseña. Contrato real (verificado leyendo
`diagramador-backend/src/routes` y `src/services`), prefijo `/api`:

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| POST | `/auth/registro` | `{ nombre, correo, password }` | `{ token, usuario }` · 409 si el correo existe |
| POST | `/auth/login` | `{ correo, password }` | `{ token, usuario }` · 401 credenciales |
| GET | `/auth/perfil` | — | `usuario` |
| GET | `/proyectos` | — | `Proyecto[]` (propios + invitaciones **aceptadas**) |
| GET | `/proyectos/:id/contenido` | — | `{ idProyecto, contenido }` |
| PUT | `/proyectos/:id/contenido` | `{ contenido }` | `Proyecto` |
| POST | `/proyectos` | `{ nombre, contenido? }` | `Proyecto` |

Todas las rutas salvo `/auth/registro` y `/auth/login` exigen `Authorization: Bearer <token>`.
Los errores llegan siempre como `{ message: string }` con el status adecuado.

Decisiones tomadas:

| Tema | Decisión | Motivo |
|---|---|---|
| Router | `react-router-dom` v7 | Consultado y aprobado. §3 de CLAUDE.md exige preguntar antes de sumar librerías |
| CORS | `cors` en el backend | Consultado y aprobado. Sirve en dev y en producción; un proxy de Vite solo en dev |
| Token | `localStorage` | La prohibición de §2 es sobre **autoguardado del documento**, no sobre la sesión. Un JWT viejo produce un 401 explícito, no un diagrama fantasma |
| `contenido` vacío | `{}` ⇒ documento nuevo, no error | Prisma crea la columna con `@default("{}")`, que no pasa el zod de `schema.ts` |
| Fase | CLAUDE.md §2 sigue diciendo "fase 1 activa" | Se actualiza al cerrar el bloque 6 |
| HTTP | `fetch` nativo, sin `axios` | §3 lista axios como opcional de fase 3; una dependencia menos |

Estructura nueva, extendiendo §4:

```
src/
  api/       client.ts (fetch + Bearer + ApiError) · auth.ts · proyectos.ts · types.ts
  auth/      useAuthStore.ts · RequireAuth.tsx · RedirectIfAuth.tsx
  pages/     LoginPage · SignupPage · HomePage · EditorPage
  app/       routes.tsx (nuevo) · App.tsx (pasa a ser el layout del editor)
```

Regla estructural que se mantiene: `uml/` y `state/commands/` **siguen sin importar nada
de red ni de React Flow**. Todo lo HTTP vive en `api/` y solo lo tocan las páginas.

---

## 1. Andamiaje: dependencias, CORS y cliente HTTP

- [x] `npm i react-router-dom` en el frontend
- [x] Backend: `npm i cors` + `app.use(cors(...))` en `src/app.js` con origen configurable
- [x] Backend: `CORS_ORIGIN` en `src/config/env.js`, `.env` y `.env.example`
- [x] `.env` / `.env.example` del frontend con `VITE_API_URL=http://localhost:3000/api`
- [x] `src/api/types.ts` — `Usuario`, `Proyecto`, `SesionResponse`
- [x] `src/api/client.ts` — `apiFetch<T>()`: base URL, `Bearer`, parseo de `{ message }`,
      `ApiError` con `status`, y 204 sin cuerpo
- [x] `src/api/auth.ts` y `src/api/proyectos.ts` — una función por endpoint, sin lógica de UI

**Listo cuando**: `npm run typecheck` pasa y una llamada manual al backend responde sin
error de CORS.

---

## 2. Sesión y rutas

- [x] `src/auth/useAuthStore.ts` — store zustand con `token`, `usuario`, `login()`,
      `logout()`, rehidratado desde `localStorage` al arrancar
- [x] `client.ts` lee el token del store (no del `localStorage` directo) y en un **401
      cierra la sesión** automáticamente
- [x] `src/auth/RequireAuth.tsx` — sin sesión redirige a `/login` guardando el destino
- [x] `src/auth/RedirectIfAuth.tsx` — con sesión, `/login` y `/registro` mandan a `/`
- [x] `src/app/routes.tsx` — `/login`, `/registro`, `/` (home), `/proyectos/:id` (editor)
- [x] `main.tsx` monta el `<RouterProvider>` en lugar de `<App />`

**Listo cuando**: entrar a `/` sin token redirige a `/login`, y recargar con token no
pierde la sesión.

---

## 3. Login

- [x] `src/ui/auth/AuthLayout.tsx`, `Field.tsx`, `SubmitButton.tsx` — reusados por login y registro
- [x] `src/pages/LoginPage.tsx` — correo + password, validación en cliente, estado de
      envío, error del backend visible, enlace a `/registro`
- [x] Al entrar, redirige al destino guardado por `RequireAuth` o a `/`

**Listo cuando**: credenciales buenas entran a la home; malas muestran "Credenciales
invalidas" sin recargar la página.

---

## 4. Registro

- [x] `src/pages/SignupPage.tsx` — nombre, correo, password y confirmación
- [x] Reglas del backend replicadas en cliente (`requierePassword`: mínimo 8 caracteres)
- [x] 409 del backend se muestra en el campo de correo, no como error genérico
- [x] El backend ya devuelve token en el registro: se inicia sesión directo, sin pasar por login

**Listo cuando**: un correo nuevo crea la cuenta y cae en la home ya logueado.

---

## 5. Home: lista de proyectos

- [x] `src/pages/HomePage.tsx` — `GET /proyectos` al montar
- [x] Cabecera con el nombre del usuario logueado y botón de cerrar sesión
- [x] Tarjeta por proyecto: nombre, fecha, dueño, y distintivo **propio / compartido**
      (`proyecto.idUsuario !== usuario.idUsuario` ⇒ llegó por invitación aceptada)
- [x] Estados explícitos: cargando, error con reintento, y vacío con llamada a la acción
- [x] Crear proyecto nuevo (`POST /proyectos`) y entrar directo a su editor
- [x] Clic en la tarjeta ⇒ `navigate('/proyectos/' + idProyecto)`

**Listo cuando**: la lista muestra los proyectos del usuario y ninguno de otro usuario.

---

## 6. Editor: cargar el `contenido`

- [x] `io/deserialize.ts`: extraer `deserializeValue(raw: unknown)` y dejar
      `deserializeDocument(raw: string)` delegando en él. El `contenido` llega como
      **objeto**, no como string: un `JSON.stringify` para volver a parsear sería absurdo
- [x] `io/proyecto.ts` — `documentFromContenido(contenido, nombre)`: `{}` o `null` ⇒
      `createDocument({ name: nombre })`; si no, valida con zod y migra
- [x] `src/pages/EditorPage.tsx` — carga `GET /proyectos/:id/contenido`, llama a
      `replaceDocument()` y recién entonces renderiza `<App />`
- [x] Guardas: 403/404 del backend se muestran como pantalla con vuelta a la home,
      no como lienzo en blanco
- [x] `App.tsx` recibe el proyecto abierto: nombre en la barra y botón "← Proyectos"
- [x] Actualizar CLAUDE.md §2: fase activa y qué deja de estar prohibido

**Listo cuando**: abrir un proyecto con diagrama guardado lo pinta idéntico, y abrir uno
recién creado muestra el lienzo vacío con el nombre del proyecto.

---

---

## 7. Autoguardado

Pedido: guardar cada 15 s y al cerrar el diagramador, para que no se pierda una edicion
hecha en el segundo 14.

- [x] `state/useDiagramStore.ts` — `markSaved()`, que baja `isDirty` sin tocar el documento
- [x] `api/client.ts` — opcion `keepalive` en `apiFetch`
- [x] `api/projects.ts` — `saveContent(id, contenido, { keepalive })`
- [x] `sync/useAutosave.ts` — intervalo de 15 s **condicionado a `isDirty`**, mas descarga
      al desmontar, en `pagehide` y en `visibilitychange` → hidden
- [x] `flush()` esperable: guarda ya y resuelve cuando el PUT termino, saltandose la
      guardia de "hay uno en vuelo" porque ese puede ser anterior a la ultima edicion
- [x] `useBlocker` en `EditorPage`: la flecha de atras y el boton "Proyectos" retienen la
      navegacion hasta que el guardado aterriza, en vez de confiar en el desmontaje
- [x] Guardia `enabled`: no se guarda hasta que el documento de *este* proyecto esta en el store
- [x] **Bug corregido**: todos los proyectos comparten la ruta `/proyectos/:idProyecto`, asi
      que ir de uno a otro re-renderiza `EditorPage` en vez de remontarlo y el estado
      `ready` del anterior seguia vigente. `listo` se deriva ahora comparando
      `estado.proyecto.idProyecto` con el parametro de la URL
- [x] `sync/SaveStatus.tsx` — indicador en la barra: sin guardar / guardando / guardado / error
- [x] Tests de `markSaved` y de `replaceDocument` en `useDiagramStore.test.ts`

Tres fallos reportados en uso real, y sus causas:

- [x] **La importacion de un `.uml.json` no llegaba nunca a la nube.** `replaceDocument`
      dejaba `isDirty` en false, asi que el autoguardado veia un documento limpio y no
      escribia. Ahora acepta `{ dirty }`: cargar del backend deja limpio, importar ensucia
- [x] **"Cuando hago las cosas rapido no se guarda" (1).** El texto de `InlineInput` y
      `TextField` solo se despacha al store en blur o Enter — un tecleo no es un cambio
      del documento, o el historial tendria una entrada por letra. Un nombre escrito y
      dejado con el foco dentro **no estaba en el documento**. Ahora todo guardado llama
      antes a `commitFocusedField()`, que hace blur del campo activo y fuerza su commit
- [x] **"Cuando hago las cosas rapido no se guarda" (2).** La ventana de exposicion era de
      hasta 15 s. Se agrega un **debounce de 1,5 s** suscrito a los cambios del documento;
      el latido de 15 s pasa a ser la red de seguridad, no el mecanismo principal
- [x] El blocker ya **no** consulta `isDirty` antes de bloquear: con una edicion sin
      confirmar dentro de un input el documento parece limpio. Bloquea siempre y deja que
      `flush()` decida despues de confirmar el campo

Decisiones:

| Tema | Decision | Motivo |
|---|---|---|
| Debounce | 1,5 s tras dejar de editar | Es el mecanismo principal. CLAUDE.md §10.3 ya lo pedia. Reduce a uno o dos segundos la ventana en la que una edicion existe solo en el navegador |
| Intervalo | 15 s, pero **solo si `isDirty`** | Lo pedido, aqui como red de seguridad de lo que el debounce no cubrio. CLAUDE.md §10.3 prohibe el `setInterval` ciego que escribe aunque nadie haya tocado nada |
| Commit del campo enfocado | `blur()` antes de leer el documento | Sin esto, guardar mientras hay un nombre a medio escribir guarda el documento **sin** ese nombre |
| Cierre | `keepalive: true` | Un `fetch` normal se cancela al descargarse la pagina, que es justo el caso que habia que cubrir |
| Limite de 64 KB | Si el documento pasa de 60 KB se manda sin `keepalive` | El navegador rechaza un body keepalive mayor; mejor un intento que puede no llegar que no mandar nada |
| Eventos de cierre | `pagehide` + `visibilitychange` | `beforeunload` no dispara en bfcache ni al matar la pestaña en movil |
| Atras / "Proyectos" | `useBlocker` + `flush()` esperado | Son navegaciones internas: se pueden retener. Recargar no, y por eso esa sigue cubierta por `pagehide` + `keepalive` |
| Fallo al guardar | Se navega igual | Dejar al usuario atrapado en el editor es peor que un diagrama una edicion atrasado, y el documento sigue sucio para el siguiente intento |
| Colision de proyectos | Parametro `enabled` | Sin el, ir de A a B podia escribir el diagrama de A dentro de B: el editor se desmonta y remonta mas rapido de lo que el store cambia de documento |

**Listo cuando**: editar y esperar 15 s escribe en la base; editar y volver a Proyectos
—o pulsar la flecha de atras— escribe **antes** de salir; recargar con F5 escribe; reabrir
el proyecto muestra la edicion.

⚠️ **Limite conocido del guardado al recargar:** la peticion de `pagehide` sale con
`keepalive`, pero compite con el GET de la pagina nueva. Si gana el GET, ves el diagrama
anterior aunque el PUT llegue un instante despues. Por eso el debounce de 1,5 s es el
mecanismo principal: cuando pulsas F5 lo normal es que ya estuviera guardado. Cerrarlo del
todo exige la columna `version` y reintentar la carga, o un guardado sincrono que el
navegador no ofrece.

⚠️ **Riesgo abierto:** sin la columna `version` no hay bloqueo optimista. Dos pestanas —o
dos colaboradores invitados— abiertas en el mismo proyecto se pisan en silencio cada 15
segundos, y gana la ultima en escribir. Antes era teorico; con autoguardado es probable.

---

## 8. Clase de asociacion

La caja que lleva los atributos que pertenecen a la **relacion** y no a ninguno de sus dos
extremos. El caso tipico es un muchos-a-muchos: Estudiante *—* Curso con una `nota` y una
`fechaInscripcion` que no son del estudiante ni del curso, sino de ese estudiante en ese
curso.

- [x] `schemaVersion` **1 -> 2**: `node.associationId` en `types.ts`, `schema.ts`,
      `factories.ts` y la migracion en `migrations.ts`
- [x] Invariante §5.4.6 en `invariants.ts`: la arista referenciada existe y esta en el
      mismo diagrama
- [x] Cascada simetrica en `commands/edges.ts` y `commands/nodes.ts`: nacen juntas y se
      van juntas. Borrar la relacion borra su clase, borrar la clase borra la relacion, y
      borrar una clase de un extremo se lleva las dos
- [x] **Es una herramienta de relacion, no de clasificador.** Unis dos clases y nace la
      asociacion con su clase colgando. Asi se dibuja de verdad una clase de asociacion:
      nadie coloca una caja y despues busca una linea
- [x] `registry/relations/associationClass.ts` — el `RelationSpec` que aparece en la
      seccion **Relaciones** de la paleta, con extremos `0..*` / `0..*` por defecto
- [x] `RelationSpec.classifierKind`: dibujar esta relacion crea ademas un clasificador de
      ese tipo, unido a ella
- [x] `ClassifierSpec.attachedToRelation`: el clasificador sigue registrado —el nodo tiene
      que poder renderizarse— pero no tiene herramienta propia en la paleta
- [x] `addEdgeWithClass`: **un solo comando**, asi el gesto entero es un solo Ctrl+Z
- [x] `useCreateRelation` coloca la caja bajo el punto medio de las dos clases
- [x] `canvas/AssociationLinks.tsx`: el conector punteado, en `<ViewportPortal>` porque
      **no es una arista de React Flow** — React Flow une nodo con nodo, y esto une un
      nodo con el medio de una arista
- [x] El validador del spec avisa (no bloquea) cuando la relacion no es de muchos a muchos
- [x] Esta en `fullSampleDocument`, asi que el round-trip cubre el campo nuevo
- [x] `src/uml/model/associationClass.test.ts`

**Bug de fondo corregido de paso:** `ClassifierSpec.validate` y `RelationSpec.validate`
estaban declarados en el registry y documentados como el punto de extension, pero
`validateDocument` **no los llamaba nunca**. Cualquier regla escrita en un spec era codigo
muerto. Ahora `checkSpecRules` los recorre.

**Rareza corregida de paso:** `validators.ts` tenia un byte NUL literal dentro de un
template string, usado como separador de clave compuesta. Funcionaba, pero volvia el
archivo "binario" para `grep`. Ahora es `\u0000`, mismo valor y archivo legible.

**Listo cuando**: con la herramienta armada, arrastrar de una clase a otra crea la
asociacion **y** su caja unida por linea punteada; mover cualquiera de las cajas mueve la
linea; borrar cualquiera de las dos mitades borra la otra; un Ctrl+Z deshace todo el
gesto; y un proyecto guardado en v1 sigue abriendo.

---

## 9. Invitaciones

La base de la colaboracion: quien puede abrir cada proyecto. **Los sockets y la edicion
simultanea siguen siendo fase 4**; esto es solo el permiso.

### En el diagramador

- [x] Boton **Invitar** en la barra, deshabilitado con explicacion si no sos el dueño —
      el backend responde 403 y es mejor decirlo antes que fallar despues
- [x] `ui/Modal.tsx`, el dialogo generico de `ui/` (§4): cierra con Escape y con clic en
      el fondo. El listener va en fase de captura porque el lienzo tambien escucha Escape
      para cancelar su herramienta, y mientras hay un dialogo la tecla es del dialogo
- [x] `ui/invitations/InviteModal.tsx`: pegas un UUID, se resuelve a una persona, y recien
      entonces invitas
- [x] El mismo modal lista las invitaciones que enviaste, con estado, fecha y destinatario,
      y deja cancelarlas

### En el dashboard

- [x] La lista unica se parte en **Mis proyectos** y **Proyectos invitados**, separados por
      `proyecto.idUsuario === miId`
- [x] Boton **Invitaciones** en la cabecera de "Proyectos invitados"
- [x] `ui/invitations/ReceivedInvitationsModal.tsx`: nombre del proyecto, fecha y estado
- [x] Aceptar y rechazar desde ese modal, y al aceptar se recarga la lista de proyectos
- [x] `ui/home/UuidCard.tsx` en la cabecera: **tu propio UUID**, con boton de copiar.
      Sin esto el modal de invitar no sirve — pide un UUID que nadie tiene forma de
      conocer, ni siquiera el propio. El id va en un input de solo lectura, no en un
      parrafo, para que siga pudiendo seleccionarse a mano cuando el portapapeles falla
      (origen inseguro, o un navegador que lo niega)
- [x] El modal de invitar dice de donde sale ese UUID, para que el que invita sepa que
      pedir

### La capa de datos

- [x] `api/invitations.ts` — list, create, respond, cancel
- [x] `api/users.ts` — `getUser`, para resolver el UUID
- [x] `Invitacion` y `EstadoInvitacion` en `api/types.ts`

### Decisiones

| Tema | Decision | Motivo |
|---|---|---|
| **UUID vs correo** | El modal pide UUID, como se pidio, pero el backend identifica al invitado por **correo** (`POST /invitaciones` valida `correo`). El UUID se resuelve antes con `GET /usuarios/:id` | Sin tocar el backend. Y el paso intermedio no es un parche: es lo que te deja **ver a quien vas a invitar**. Un UUID es ilegible; mandar la invitacion a la persona equivocada por un caracter mal pegado, sin confirmacion, seria el fallo obvio de esta pantalla |
| Aceptar / rechazar | Incluidos aunque no se pidieron | `PATCH /invitaciones/:id` es la unica forma de responder una invitacion y no lo llamaba nadie mas. Una lista de pendientes que no se pueden aceptar dejaria la funcionalidad inerte |
| Dos listados de un solo endpoint | `GET /invitaciones` devuelve las recibidas **y** las emitidas sobre mis proyectos; se separan en el cliente | El backend no acepta filtrar por lado. Enviadas: `proyecto.idUsuario === miId`. Recibidas: `idUsuario === miId`. No se solapan porque el backend prohibe autoinvitarse |

**Listo cuando**: B copia su UUID de su dashboard y se lo pasa a A, A lo pega e invita, B
ve la invitacion en su dashboard con proyecto, fecha y estado, la acepta, y el proyecto le
aparece en "Proyectos invitados".

**Verificado contra el backend real** (18 comprobaciones, `scratchpad/invitaciones-e2e.ts`):
el flujo completo mas las reglas que el modal debe respetar — no invitar dos veces a la
misma persona, no invitarse a uno mismo, y que un invitado no pueda invitar a otros.

---

## 10. Sockets: colaboracion en tiempo real

Una sala por proyecto (`proyecto:<uuid>`), los cambios se ven al instante, y el guardado
sigue una sola cadencia **por sala**, no una por persona.

### Que viaja

- [x] **El comando, no el diagrama.** Es el pago de CLAUDE.md §6.2: toda mutacion ya pasa
      por un comando con payload JSON serializable, asi que difundir `{ type, payload }`
      **es** el mecanismo de sincronizacion. Mover una caja son decenas de bytes
- [x] Deshacer, rehacer e importar son la excepcion: reemplazan el documento entero en vez
      de aplicar un comando, asi que no hay nada pequeño que mandar y va todo
- [x] `onStoreChange` / `applyRemote` en el store: lo que llega de la sala se aplica **sin**
      volver a anunciarse. Sin eso dos clientes se rebotan el mismo comando para siempre
- [x] Lo remoto entra con `history: false`: Ctrl+Z deshace lo tuyo, nunca lo de otro
- [x] Nada del socket se cree: un documento que llega se valida con zod igual que un
      archivo importado

### El guardado: un contador por sala

- [x] El temporizador vive en el **servidor**, uno por sala (`sockets/salas.js`)
- [x] Al vencer, el servidor le pide el documento a un cliente designado (`pedir-snapshot`),
      lo guarda, y avisa a todos con `guardado`
- [x] `sala.sucia`: sin cambios no escribe, aunque el temporizador siga corriendo
- [x] `sala.version`: si alguien edita **entre** que se pide el documento y que termina la
      escritura, la sala sigue sucia y se vuelve a guardar. Sin esto ese cambio se perdia
      hasta que alguien volviera a editar
- [x] `useAutosave` cede: con la sala conectada se apagan **el debounce y el latido**
      locales. Queda solo el guardado de salida, que no es un contador sino el cierre de
      la puerta, y que cubre que el socket se caiga

### Lo demas

- [x] Autenticacion del socket con el mismo JWT del REST, y `proyecto.service.getById`
      decide si entras: la sala no es una puerta trasera al contenido
- [x] Al entrar, si ya habia alguien, el estado inicial se le pide a esa persona y no a la
      base: su pantalla puede tener cambios sin guardar
- [x] Indicador "N en la sala" en la barra del editor
- [x] `AUTOSAVE_INTERVAL_MS` configurable en el backend

**Listo cuando**: dos navegadores con el mismo proyecto abierto se ven mover las cajas,
crear y borrar clases, relaciones, atributos y operaciones, y renombrar cualquier cosa; y
en la base hay **un** guardado cada n segundos, no dos.

**Verificado contra el backend real** (17 comprobaciones, `scratchpad/sockets-e2e.js`):
aislamiento entre salas, sincronizacion, ausencia de eco, y que los dos miembros reciben
**el mismo instante de guardado** — un solo guardado, no uno por persona.

### Limite conocido

Las posiciones intermedias de un arrastre no viajan. CLAUDE.md §6.3 manda que solo el
evento final sea un cambio del documento, asi que el otro lado ve la caja **al soltarla**,
no siguiendo el puntero. Hacerlo en vivo es un canal efimero aparte, que no toca el
documento ni el historial.

## Fuera de alcance (lo que NO se hace en este pedido)

`Ctrl+S` manual, renombrar y borrar proyectos desde la home, el arrastre en vivo (ver el
limite del bloque 10), y la resolucion de conflictos cuando dos personas editan **el mismo
elemento** a la vez: gana el ultimo comando que llega. Para algo mejor hace falta CRDT
(Yjs), que es lo que CLAUDE.md §6.4 ya anticipaba.

El `version` del proyecto en Prisma dejo de ser urgente para el caso colaborativo — la
sala guarda una sola vez y desde un solo sitio — pero sigue faltando para dos pestañas del
**mismo** usuario en proyectos sin sala.

El `version` de CLAUDE.md §10 **no existe en el schema de Prisma**. Es lo primero que hay
que agregar: mientras no esté, el autoguardado del bloque 7 resuelve los conflictos por
"gana el último que escribe", que para un proyecto compartido no alcanza.
