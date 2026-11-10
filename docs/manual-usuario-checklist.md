# Checklist del Manual de Usuario

## Alcance de la revisión

Este documento contrasta la interfaz de `diagramador-clase-frontend` con el comportamiento de `diagramador-clase-backend`. La clasificación se basa en funciones accesibles desde la interfaz actual; la existencia de una ruta de servidor sin un control visible no convierte la función en una opción disponible para el usuario.

Estados utilizados:

- **Implementado completamente:** existe un flujo visible de principio a fin y el servidor confirma las operaciones que lo requieren.
- **Implementado parcialmente:** existe una parte útil del caso de uso, pero faltan operaciones incluidas en su alcance.
- **No implementado:** no se encontró un flujo utilizable en la interfaz.

## Matriz de casos de uso

| Caso de uso | Funcionalidad | Estado | Evidencia en código | Debe aparecer en el manual |
|---|---|---|---|---|
| CU1 | Gestionar proyectos | Implementado parcialmente | `src/pages/HomePage.tsx` lista, separa proyectos propios/compartidos y crea; `src/ui/home/ProjectCard.tsx` abre. No hay controles de renombrado ni eliminación en el frontend, aunque el backend expone `PUT` y `DELETE` en `src/routes/proyecto.routes.js`. | Sí, solo crear, listar y abrir |
| CU2 | Colaboración en tiempo real | Implementado completamente | `src/sync/useCollaboration.ts` sincroniza comandos y documentos, gestiona reconexión y snapshots; `backend/src/sockets/index.js` valida acceso, difunde cambios y coordina autoguardado. | Sí |
| CU3 | Exportar Spring Boot | Implementado completamente | `src/ui/ExportBackendButton.tsx` y `src/ui/export/ExportDialog.tsx`; `backend/src/routes/proyecto.routes.js` expone `GET /:id/exportar`; `backend/src/export/` genera y comprime el proyecto. | Sí |
| CU4 | Exportar/importar XMI | Implementado completamente | `src/ui/Toolbar.tsx`; `src/io/xmi/exportXmi.ts` exporta XMI 2.1; `src/io/xmi/importXmi.ts` reconoce XMI 2.1 y deriva XMI 1.x a `ea11Leer.ts`. | Sí |
| CU5 | Importar de boceto | Implementado completamente | `src/ui/home/ImportSketchDialog.tsx` carga, previsualiza el resumen y crea el proyecto; `backend/src/routes/boceto.routes.js` y `src/boceto/openai.js` procesan la imagen. | Sí |
| CU6 | Agente Virtual Web | Implementado completamente | `src/voz/VozPanel.tsx`, `src/voz/useVozAgent.ts` y `src/voz/herramientas.ts`; `backend/src/routes/voz.routes.js` crea la sesión de voz. | Sí |
| CU7 | Colaborar en la sala en tiempo real | Implementado parcialmente | La presencia de personas, cursores, selecciones, estados y reconexión está en `src/sync/` y `src/canvas/RemotePresence.tsx`. No se representa a la IA como participante, no hay avisos visibles de entrada/salida ni estados propios de la IA, y el cursor remoto no se atenúa por inactividad. | Sí, solo las funciones disponibles |
| CU8 | Chat grupal de texto con la IA | Implementado completamente | `src/chat/ChatPanel.tsx`, `src/chat/ChatComposer.tsx`, `src/chat/useChatStore.ts`; persistencia en `backend/prisma/schema.prisma`, `src/services/mensaje.service.js` y canal de sala en `src/sockets/index.js`. | Sí |
| CU9 | Chat grupal de voz con la IA | Implementado completamente | `src/chat/RecordingControls.tsx`, `src/chat/VoicePlayer.tsx`, `src/chat/useVoiceRecorder.ts`; carga, transcripción, síntesis y respuesta en `backend/src/controllers/mensaje.controller.js` y `src/ia/`. | Sí |
| CU10 | Confirmar por votación cambios de la IA | Implementado parcialmente | El flujo de propuesta, voto, cierre y reversión existe en `src/chat/VoteBar.tsx`, `src/ia/proposal.ts` y `backend/src/votacion/`. La regla actual del servidor descarta cuando nadie vota, pero el caso de uso exige conservar porque el cambio ya fue aplicado. | Sí, explicando la regla correcta |
| CU11 | Historial de versiones | Implementado parcialmente | Versiones manuales, automáticas y de IA, previsualización, respaldo y restauración existen en `src/versions/` y `backend/src/services/version.service.js`. La restauración no genera un mensaje en el chat. | Sí, excepto el registro en chat |

## Funcionalidades visibles adicionales

| Funcionalidad | Estado | Evidencia | Debe aparecer en el manual |
|---|---|---|---|
| Registro de cuenta | Implementado completamente | `src/pages/SignupPage.tsx`; `POST /auth/registro` en el backend | Sí |
| Inicio y cierre de sesión | Implementado completamente | `src/pages/LoginPage.tsx`, `src/pages/HomePage.tsx`, `src/auth/useAuthStore.ts` | Sí |
| Invitaciones por UUID | Implementado completamente | `src/ui/home/UuidCard.tsx`, `src/ui/invitations/InviteModal.tsx` | Sí |
| Aceptar y rechazar invitaciones | Implementado completamente | `src/ui/invitations/ReceivedInvitationsModal.tsx`; `PATCH /invitaciones/:id` | Sí |
| Cancelar invitaciones enviadas | Implementado completamente | Botón **Cancelar la invitación** en `InviteModal.tsx`; `DELETE /invitaciones/:id` | Sí |
| Crear clase | Implementado completamente | Registro de clasificadores y `src/palette/Palette.tsx` | Sí |
| Crear interfaz | Implementado completamente | `src/uml/registry/classifiers/interface.ts` y paleta | Sí |
| Crear clase de asociación | Implementado completamente | `src/uml/registry/classifiers/associationClass.ts` y `relations/associationClass.ts` | Sí |
| Crear enumeración/literales | No implementado | No existe clasificador de enumeración; `Literal` queda oculto al no haber compartimento utilizable | No |
| Atributos, operaciones y parámetros | Implementado completamente | `src/inspector/CompartmentEditor.tsx` y `src/inspector/members/` | Sí |
| Relaciones UML | Implementado completamente | Asociación, dirigida, agregación, composición, generalización, realización y clase de asociación en `src/uml/registry/relations/` | Sí |
| Multiplicidades, roles y navegabilidad | Implementado completamente | `src/inspector/EdgeInspector.tsx` | Sí |
| Trazado recto, ortogonal y curvo | Implementado completamente | `src/inspector/EdgeInspector.tsx` y manejadores de puntos | Sí |
| Mover, redimensionar y eliminar elementos | Implementado completamente | `src/canvas/UmlCanvas.tsx` y `src/canvas/interaction/useKeyboard.ts` | Sí |
| Deshacer y rehacer | Implementado completamente | Botones en `src/ui/Toolbar.tsx` y atajos en `useKeyboard.ts` | Sí |
| Importar/exportar JSON propio | Implementado completamente | Botones **Exportar JSON** e **Importar JSON** en `src/ui/Toolbar.tsx` | Sí |
| Autoguardado y estado de guardado | Implementado completamente | `src/sync/useAutosave.ts`, `src/sync/SaveStatus.tsx` y autoguardado de sala en `backend/src/sockets/index.js` | Sí |
| Renombrar proyecto desde la lista | No implementado | No existe control en `HomePage.tsx` ni `ProjectCard.tsx` | No |
| Eliminar proyecto desde la interfaz | No implementado | No existe control en `HomePage.tsx` ni `ProjectCard.tsx` | No |
| Renombrar el modelo abierto | Implementado completamente | Campo **Nombre del modelo** en `src/ui/Toolbar.tsx` | Sí, aclarando que no renombra la tarjeta del proyecto |

## Estado del Ciclo 3

### CU7 – Colaborar en la sala en tiempo real

| Verificación | Estado | Evidencia |
|---|---|---|
| Lista de participantes | Implementado | `src/sync/ParticipantList.tsx` |
| Nombre | Implementado | `Participant.nombre` se muestra en lista, cursor y selección |
| Avatar | Implementado | Iniciales calculadas por `initials()` en `src/sync/presence.ts` |
| Color | Implementado | Color estable por usuario con `participantColor()` |
| IA como participante | No implementado | La lista se construye únicamente con sockets de usuarios; la IA solo aparece como autora de mensajes |
| Avisos de entrada y salida | No implementado | Los eventos `entro` y `salio` actualizan la lista, pero no generan un aviso visible en la sala |
| Estados conectado/editando/escribiendo/grabando/inactivo | Implementado | `deriveStatus()` y `STATUS_LABEL` en `src/sync/presence.ts` |
| Estados de la IA | No implementado | **La IA está escribiendo…** aparece en el chat, pero no existe presencia de IA ni estados equivalentes en la lista de participantes |
| Estado desconectado temporal | Implementado | Eventos `salio`, retención y limpieza en presencia/sala |
| Cursor remoto | Implementado | `src/canvas/RemotePresence.tsx`; canal efímero de sockets |
| Cursor oculto fuera del lienzo | Implementado | `UmlCanvas.tsx` envía `cursor: null` al salir y cancela el envío pendiente |
| Cursor atenuado por inactividad | No implementado | Los avatares inactivos se atenúan, pero `RemoteCursors` no consulta el estado del participante |
| Límite aproximado de 20 actualizaciones por segundo | Implementado | `CURSOR_INTERVAL_MS = 50` y envío volátil en `UmlCanvas.tsx` y `useCollaboration.ts` |
| Selección remota | Implementado | Resaltados y etiquetas en `UmlCanvas.tsx` y `RemotePresence.tsx` |
| Centrado de vista en otro participante | Implementado | `centerOn()` en `ParticipantList.tsx` |
| Cursor, selección y estados efímeros | Implementado | Viajan por el canal `efimero`, quedan fuera del documento y no disparan persistencia |
| Reconexión | Implementado | Cola de comandos, reenvío del documento cuando corresponde, reanuncio de presencia y estado **Reconectando…** en `useCollaboration.ts` y `App.tsx` |

**Clasificación CU7:** Implementado parcialmente. Faltan la IA como participante, sus estados, los avisos visibles de entrada/salida y la atenuación del cursor remoto cuando la persona está inactiva.

### CU8 – Chat grupal de texto con la IA

| Verificación | Estado | Evidencia |
|---|---|---|
| Historial persistente y paginado | Implementado | Modelo `Mensaje` en Prisma, consulta por páginas y **Ver mensajes anteriores** en `ChatPanel.tsx` |
| Mensajes grupales | Implementado | Evento `mensaje` en `backend/src/sockets/index.js` |
| Indicador de escritura | Implementado | Presencia `escribiendo` y `typingLabel()` |
| Mensajes propios y ajenos diferenciados | Implementado | `MessageBubble.tsx` alinea y colorea de forma distinta los mensajes propios, ajenos y de IA |
| Nombre, color y hora | Implementado | Los mensajes ajenos muestran nombre y color estable; todas las burbujas muestran la hora |
| `@IA` | Implementado | `mentionsAI()` y botón de IA en `ChatComposer.tsx` |
| Pregunta y respuesta de IA vinculadas | Implementado | `respondeA`, la cita de la pregunta y la referencia al autor se muestran en `MessageBubble.tsx` |
| Respuesta resaltada para quien preguntó | Implementado | `mencionA` activa el anillo y el texto **te responde a vos** |
| Cola cuando la IA está ocupada | Implementado | `backend/src/ia/cola.js` mantiene una cola por sala, limitada a cinco pendientes |
| Contexto del diagrama | Implementado | `diagramForAI()` envía resumen y contenido actual |
| Contexto de conversación, usuario, diagrama y exportador | Implementado | `backend/src/ia/contexto.js` incorpora historial, nombre del autor, participantes y diagrama; `src/ia/exportador.js` añade el contexto de Spring Boot |
| Respuestas compartidas | Implementado | La respuesta se guarda y se emite a toda la sala |

**Clasificación CU8:** Implementado completamente.

### CU9 – Chat grupal de voz con la IA

| Verificación | Estado | Evidencia |
|---|---|---|
| Notas de voz | Implementado | `sendVoiceNote()` y tipo `VOZ` |
| Grabación | Implementado | `useVoiceRecorder.ts` y controles de mantener presionado |
| Cancelación de grabación | Implementado | Deslizamiento a la izquierda, tecla `Esc` y cancelación del puntero en `RecordingControls.tsx` y `ChatComposer.tsx` |
| Duración mínima y máxima | Implementado | Mínimo de 700 ms y máximo de 120 segundos en `useVoiceRecorder.ts` |
| Reproducción | Implementado | `VoicePlayer.tsx` |
| Transcripción | Implementado | Campo `transcripcion` y `backend/src/ia/audio.js` |
| Nota publicada aunque falle la transcripción | Implementado | `backend/src/ia/notaDeVoz.js` emite primero el mensaje y luego informa `transcripcion-error` sin retirar el audio |
| IA por voz | Implementado | Segundo micrófono con destello en `ChatComposer.tsx` |
| Cola de IA | Implementado | Las preguntas de voz llaman a `responderPregunta()` y comparten la cola por sala |
| Respuesta en texto si falla la síntesis | Implementado | `backend/src/ia/index.js` guarda el texto con `audio = null` si falla la generación de voz |
| Misma IA y contexto que el chat de texto | Implementado | La nota transcrita utiliza `responderPregunta()` con conversación, diagrama, participantes, exportador y herramientas |
| Respuesta en voz y texto | Implementado | Cuando la síntesis funciona, la respuesta guarda audio y transcripción visible |

**Clasificación CU9:** Implementado completamente.

### CU10 – Votación de cambios de la IA

| Verificación | Estado | Evidencia |
|---|---|---|
| Cambios provisionales | Implementado | Marcas en lienzo con `ProvisionalTags.tsx` y `proposal.ts` |
| Apertura de votación | Implementado | `backend/src/votacion/index.js` |
| Votos | Implementado | Botones **Conservar** y **Descartar**, además de mensajes breves |
| Conteo | Implementado | `VoteBar.tsx` y `votacion.js` |
| Cierre al votar todos o a los dos minutos | Implementado | `votaronTodos()` cierra antes y `DURACION_MS` fija dos minutos |
| Sala con un solo participante | Implementado | El único participante puede votar y la votación cierra al quedar sin faltantes |
| Empate decidido por quien hizo la pregunta | Implementado | `decidir()` usa el voto del solicitante; si no votó por conservar, el empate se descarta |
| Ningún voto conserva el cambio | No implementado | `decidir()` devuelve `descartada` con motivo `sin-votos`, contrario a la regla del caso de uso |
| Voto ambiguo | Implementado | `interpretarVoto()` ignora frases dudosas y mensajes largos o dirigidos a `@IA` |
| Cambio de voto | Implementado | `registrarVoto()` reemplaza el voto anterior mientras la votación está abierta |
| Salida de participante | Implementado | `revisar()` recalcula faltantes y puede cerrar cuando quienes permanecen ya votaron |
| Solicitud de propuesta alternativa | Implementado | Tras cerrar la votación se puede enviar una nueva solicitud a `@IA`; durante una votación se informa que primero debe finalizar |
| Edición de elementos provisionales | Implementado | Las marcas provisionales no bloquean el inspector ni el lienzo; las referencias se reparan si después se revierte |
| Aprobación | Implementado | Estado `conservada`; crea versión de origen IA |
| Rechazo | Implementado | Estado `descartada` |
| Rechazo y rollback exacto | Implementado | `entitiesToRestore()` captura el estado previo de las entidades afectadas y `restoreEntities()` lo difunde o lo retiene para la próxima reconexión |
| Cambio inválido sin votación | Implementado | Si ninguna operación modifica el documento, `aplicado` es falso y no se abre una votación; si no puede abrirse, se revierte inmediatamente |

**Clasificación CU10:** Implementado parcialmente. Falta aplicar la regla correcta para una votación sin votos: los cambios deben conservarse porque ya están aplicados.

### CU11 – Historial de versiones

| Verificación | Estado | Evidencia |
|---|---|---|
| Versión por cambio de IA aprobado | Implementado | `desdeIA()` crea una versión de origen `IA` al conservarse la propuesta |
| Versiones automáticas | Implementado | `automatica()` tras autoguardado de sala |
| Versiones manuales | Implementado | Formulario **Guardar versión** |
| Consulta del historial | Implementado | Lista paginada en `VersionsPanel.tsx` |
| Fecha, autor y motivo | Implementado | La lista muestra fecha, autor y etiqueta de origen: Manual, Automática, IA o Antes de restaurar |
| Previsualización en solo lectura | Implementado | `VersionPreviewModal.tsx` y `DiagramPreview.tsx` |
| Respaldo antes de restaurar | Implementado | `restaurar()` crea una versión de origen `RESTAURACION` antes de entregar la versión elegida |
| Registro de restauración en el chat | No implementado | La restauración emite la nueva versión y un aviso local, pero no crea ni difunde un mensaje de chat |
| Bloqueo durante votación | Implementado | Frontend y backend impiden restaurar mientras existe una votación abierta |
| Migración o rechazo de versiones antiguas | Implementado | La previsualización y restauración pasan por `deserializeValue()`, que migra formatos conocidos y rechaza los inválidos |
| Restauración | Implementado | Confirmación, respaldo previo y difusión del documento restaurado a la sala |

**Clasificación CU11:** Implementado parcialmente. Falta registrar la restauración como un mensaje visible y persistente en el chat de la sala.

## Funciones excluidas del manual como disponibles

- Renombrar un proyecto desde la pantalla principal.
- Eliminar un proyecto desde la interfaz.
- Enumeraciones y literales UML.
- Recuperación de contraseña o cambio de contraseña.
- Gestión de perfiles o cuentas desde la interfaz.

## Verificación realizada

- Se inspeccionaron rutas, páginas, componentes, controles, formularios, editor, importadores, exportadores, colaboración, IA y errores visibles del frontend.
- Se contrastaron autenticación, permisos, persistencia, sockets, bocetos, voz, chat, votaciones, versiones y exportación Spring Boot en el backend.
- Las pruebas del backend ejecutaron **83 casos: 79 aprobados y 4 no iniciados por dependencias locales faltantes** (`@prisma/client` y un módulo de almacenamiento de audio).
- La compilación y las pruebas del frontend no pudieron iniciarse porque las dependencias locales no están instaladas (`tsc` y `vitest` no disponibles).
- No se modificó código de producción ni se instalaron dependencias.
