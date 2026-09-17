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

## Fuera de alcance (lo que NO se hace en este pedido)

`Ctrl+S` manual, bloqueo optimista con `version`, la pantalla de invitaciones, renombrar
y borrar proyectos desde la home, y los sockets de colaboración.

El `version` de CLAUDE.md §10 **no existe en el schema de Prisma**. Es lo primero que hay
que agregar: mientras no esté, el autoguardado del bloque 7 resuelve los conflictos por
"gana el último que escribe", que para un proyecto compartido no alcanza.
