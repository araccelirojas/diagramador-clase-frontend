# MANUAL DE USUARIO

## 1. Introducción

### 1.1 Propósito del manual

Este manual explica cómo utilizar la aplicación **Diagramador UML** desde el registro de una cuenta hasta la creación, colaboración, importación, exportación y recuperación de diagramas. Está dirigido a personas usuarias; no requiere conocimientos de programación ni explica la construcción interna del sistema.

### 1.2 Descripción de la aplicación

Diagramador UML permite crear diagramas de clases en un lienzo visual. Una persona puede crear clases e interfaces, añadir atributos y operaciones, relacionar los elementos, trabajar al mismo tiempo con otras personas y conservar el diagrama en línea.

La aplicación también permite:

- importar y exportar diagramas en JSON y XMI;
- reconstruir un diagrama a partir de una imagen o fotografía;
- conversar con una IA por texto o voz;
- solicitar a la IA cambios que el equipo confirma mediante votación;
- guardar y restaurar versiones;
- generar un backend Spring Boot descargable.

### 1.3 Usuarios del sistema

Todas las personas utilizan una cuenta registrada. Según el proyecto abierto, la misma persona puede actuar como:

- **Dueño del proyecto:** creó el proyecto, puede editarlo e invitar a otras personas.
- **Colaborador:** aceptó una invitación y puede abrir y editar el proyecto compartido. No puede invitar a otras personas desde ese proyecto.

No existe una pantalla separada para administrar roles.

## 2. Requisitos para utilizar la aplicación

Para utilizar la aplicación se necesita:

- un navegador web moderno;
- conexión a Internet;
- una cuenta en la aplicación;
- permiso para usar el micrófono cuando se utilicen notas de voz o el agente virtual;
- acceso a descargas del navegador para exportar JSON, XMI o el backend Spring Boot.

Las funciones de boceto, chat con IA, voz y agente virtual también dependen de que el servicio de IA se encuentre disponible.

## 3. Acceso al sistema

### 3.1 Registrarse

**Objetivo:** crear una cuenta para guardar y compartir diagramas.

**Pasos:**

1. Abra la aplicación.
2. En la pantalla **Inicia sesión**, presione **Crea una**.
3. Complete **Nombre**, **Correo**, **Contraseña** y **Repite la contraseña**.
4. La contraseña debe tener al menos 8 caracteres.
5. Presione **Crear cuenta**.

**Resultado esperado:** la cuenta se crea, la sesión se inicia automáticamente y se muestra la pantalla de proyectos.

**Nota:** si el correo ya está registrado, el formulario lo indicará junto al campo **Correo**.

> **[CAPTURA 01 – Pantalla de registro]**

*Figura 1. Formulario para crear una cuenta.*

### 3.2 Iniciar sesión

**Objetivo:** ingresar a los proyectos de una cuenta existente.

**Pasos:**

1. Abra la aplicación.
2. Escriba su **Correo** y **Contraseña**.
3. Presione **Entrar**.

**Resultado esperado:** se muestra la pantalla principal con los proyectos propios y los proyectos compartidos.

> **[CAPTURA 02 – Pantalla de inicio de sesión]**

*Figura 2. Formulario de inicio de sesión.*

### 3.3 Cerrar sesión

**Objetivo:** finalizar la sesión actual.

**Pasos:**

1. Regrese a la pantalla de proyectos.
2. Presione **Cerrar sesión** en la parte superior derecha.

**Resultado esperado:** la aplicación vuelve a la pantalla **Inicia sesión**.

## 4. Pantalla principal

La pantalla principal muestra el nombre de la persona conectada y su **UUID**, que es el identificador utilizado para recibir invitaciones.

Los proyectos se separan en dos grupos:

- **Mis proyectos:** proyectos creados por la persona conectada.
- **Proyectos invitados:** proyectos de otras personas a los que se obtuvo acceso al aceptar una invitación. Estas tarjetas llevan la indicación **Compartido** y muestran el nombre del dueño.

Las acciones visibles son:

- **Copiar:** copia el UUID propio.
- **Importar boceto:** inicia la reconstrucción de un diagrama desde una imagen.
- **Nuevo proyecto:** crea un proyecto vacío.
- **Invitaciones:** muestra las invitaciones recibidas.
- **Cerrar sesión:** finaliza la sesión.

> **[CAPTURA 03 – Pantalla principal y lista de proyectos]**

*Figura 3. Pantalla principal con proyectos propios, proyectos invitados y UUID.*

## 5. Gestión de proyectos

### 5.1 Crear un proyecto

**Objetivo:** crear un espacio de trabajo vacío para un diagrama UML.

**Pasos:**

1. Ingrese a la pantalla principal.
2. Presione **Nuevo proyecto**.
3. Escriba el nombre en **Nombre del proyecto**.
4. Presione **Crear y abrir**.

**Resultado esperado:** se crea el proyecto y se abre directamente el editor con un lienzo vacío.

> **[CAPTURA 04 – Creación de un proyecto]**

*Figura 4. Formulario de creación de un proyecto.*

### 5.2 Abrir un proyecto propio

**Objetivo:** continuar trabajando en un proyecto creado por usted.

**Pasos:**

1. Localice el proyecto en **Mis proyectos**.
2. Presione su tarjeta.

**Resultado esperado:** se carga el diagrama y se abre el editor.

### 5.3 Abrir un proyecto compartido

**Objetivo:** colaborar en un proyecto de otra persona.

**Pasos:**

1. Acepte primero la invitación correspondiente.
2. Localice el proyecto en **Proyectos invitados**.
3. Presione la tarjeta marcada como **Compartido**.

**Resultado esperado:** se abre el editor del proyecto compartido.

**Nota:** la interfaz actual no ofrece acciones para renombrar o eliminar proyectos. El campo de nombre de la barra del editor cambia el nombre del modelo UML, no el nombre de la tarjeta del proyecto.

### 5.4 Compartir su UUID

**Objetivo:** entregar a un dueño de proyecto el identificador necesario para que pueda invitarle.

**Pasos:**

1. En la pantalla principal, localice **Tu UUID**.
2. Presione **Copiar**.
3. Envíe el valor al dueño del proyecto por el medio que acuerden.

**Resultado esperado:** el botón muestra **Copiado** y el identificador queda disponible para pegarlo.

**Nota:** si el navegador impide copiar automáticamente, el valor queda seleccionado para copiarlo manualmente.

### 5.5 Invitar a una persona

**Objetivo:** permitir que otra persona colabore en un proyecto propio.

**Pasos:**

1. Abra uno de sus proyectos.
2. Presione **Invitar**.
3. Pegue el **UUID del usuario**.
4. Presione **Buscar**.
5. Compruebe el nombre y correo encontrados.
6. Presione **Invitar**.

**Resultado esperado:** la invitación aparece en **Invitaciones que enviaste** con su estado.

**Nota:** el botón **Invitar** está desactivado en proyectos de los que usted no es dueño.

> **[CAPTURA 05 – Invitación a un colaborador]**

*Figura 5. Búsqueda por UUID y envío de una invitación.*

### 5.6 Cancelar una invitación enviada

**Objetivo:** retirar una invitación que ya no debe estar disponible.

**Pasos:**

1. Abra el proyecto y presione **Invitar**.
2. En **Invitaciones que enviaste**, localice la invitación.
3. Presione el icono cuyo texto de ayuda es **Cancelar la invitación**.

**Resultado esperado:** la invitación se elimina de la lista.

### 5.7 Aceptar o rechazar una invitación

**Objetivo:** responder una invitación recibida.

**Pasos:**

1. En la pantalla principal, presione **Invitaciones**.
2. Localice una invitación con estado pendiente.
3. Presione **Aceptar** para obtener acceso o **Rechazar** para no participar.

**Resultado esperado:** al aceptar, el proyecto aparece en **Proyectos invitados**. Al rechazar, la invitación cambia de estado y no se concede acceso.

> **[CAPTURA 06 – Invitaciones recibidas]**

*Figura 6. Ventana para aceptar o rechazar invitaciones.*

## 6. Editor de diagramas UML

### 6.1 Interfaz del editor

El editor está formado por:

- una barra superior con **Proyectos**, nombre del modelo, **Deshacer**, **Rehacer**, importaciones, exportaciones, estado de guardado, participantes, **Exportar backend** e **Invitar**;
- el panel izquierdo **Clases**, que contiene la paleta de elementos;
- el lienzo central, con controles de zoom y minimapa;
- el panel derecho, con las pestañas **Propiedades**, **Chat** y **Versiones**.

Los paneles laterales se pueden ocultar y volver a mostrar con sus botones de plegado.

El estado de guardado puede mostrar **Cambios sin guardar**, **Guardando…**, **Guardado** o **No se pudo guardar**.

> **[CAPTURA 07 – Editor UML completo]**

*Figura 7. Interfaz principal del editor de diagramas.*

### 6.2 Crear una clase o interfaz

**Objetivo:** añadir un clasificador al diagrama.

**Pasos:**

1. En el panel **Clases**, localice **Clase**, **Clase abstracta** o **Interfaz**.
2. Utilice una de estas formas:
   - arrastre el elemento hasta el lugar deseado del lienzo; o
   - presione el elemento y luego presione el lugar del lienzo donde desea crearlo.
3. Para volver al modo normal, presione **Seleccionar** o la tecla `Esc`.

**Resultado esperado:** aparece una nueva caja UML en el lienzo.

### 6.3 Renombrar y configurar una clase

**Objetivo:** cambiar los datos generales de una clase o interfaz.

**Pasos:**

1. Seleccione la caja.
2. Abra la pestaña **Propiedades**.
3. Modifique **Nombre**, **Visibilidad** o **Estereotipos**.
4. En una clase, active **Clase abstracta** cuando corresponda.

**Resultado esperado:** el elemento se actualiza en el lienzo.

**Nota:** también puede hacer doble clic en el nombre mostrado dentro de la caja para editarlo.

### 6.4 Agregar un atributo

**Objetivo:** añadir una propiedad a una clase.

**Pasos:**

1. Seleccione la clase.
2. En **Propiedades**, ubique **Atributos**.
3. Presione **+ agregar**.
4. Complete **Nombre**, **Tipo** y **Visibilidad**.
5. Active **{id}** si el atributo identifica a la clase y debe utilizarse como clave primaria al exportar el backend.
6. Abra **Más opciones** si necesita multiplicidad, valor por defecto o modificadores como `static`, `derivado`, `readOnly`, `ordered` o `unique`.

**Resultado esperado:** el atributo aparece en el compartimento de atributos de la clase.

**Alternativa:** arrastre **Atributo** desde la paleta hasta una clase, o seleccione **Atributo** y luego presione la clase.

### 6.5 Agregar una operación

**Objetivo:** añadir una operación o método UML.

**Pasos:**

1. Seleccione la clase o interfaz.
2. En **Propiedades**, ubique **Operaciones**.
3. Presione **+ agregar**.
4. Complete **Nombre**, **Retorno** y **Visibilidad**.
5. Para añadir argumentos, presione **+ parámetro** y configure su nombre, tipo, dirección y valor por defecto.
6. En **Más opciones**, active `static`, **abstracta** o `query` si corresponde.

**Resultado esperado:** la operación aparece en el compartimento de operaciones.

**Alternativa:** arrastre **Operación** desde la paleta hasta una clase, o selecciónela y luego presione la clase.

> **[CAPTURA 08 – Propiedades, atributos y operaciones]**

*Figura 8. Edición de una clase desde la pestaña Propiedades.*

### 6.6 Reordenar o eliminar atributos, operaciones y parámetros

**Objetivo:** organizar o quitar miembros de una clase.

**Pasos:**

1. Seleccione la clase y abra el miembro en **Propiedades**.
2. Use **↑** o **↓** para cambiar el orden de un atributo u operación.
3. Presione **✕**, cuyo nombre accesible es **Eliminar**, para quitarlo.
4. En un parámetro, presione **✕**, cuyo nombre accesible es **Quitar parámetro**.

**Resultado esperado:** la lista y la caja UML se actualizan.

### 6.7 Crear una relación

**Objetivo:** unir dos clasificadores mediante una relación UML.

Relaciones disponibles:

- **Asociación**;
- **Asociación dirigida**;
- **Agregación**;
- **Composición**;
- **Generalización**;
- **Realización**;
- **Clase de asociación**.

**Pasos:**

1. En **Relaciones**, seleccione el tipo deseado.
2. Arrastre desde una clase hasta la otra; también puede presionar primero la clase de origen y luego la de destino.
3. Presione `Esc` al terminar para volver a **Seleccionar**.

**Resultado esperado:** se dibuja la relación. Si la combinación no es válida, aparece un aviso sobre el lienzo.

**Nota:** al crear una **Clase de asociación**, el editor crea la relación y también una caja asociada, con multiplicidades `0..*` en ambos extremos de forma inicial.

### 6.8 Configurar una relación y sus multiplicidades

**Objetivo:** definir el significado y la presentación de una relación.

**Pasos:**

1. Seleccione la línea de la relación.
2. En **Propiedades**, configure el **Nombre** y la **Lectura** cuando estén disponibles.
3. Elija el **Trazado**: **Recta**, **Ortogonal** o **Curva**.
4. En **Origen** y **Destino**, complete **Rol** y **Multiplicidad**.
5. Configure **Visibilidad**, **Navegable**, `ordered` y `unique` cuando corresponda.

**Resultado esperado:** las etiquetas, multiplicidades y forma de la línea se actualizan.

**Nota:** las relaciones de generalización y realización no muestran campos que no correspondan a su notación.

> **[CAPTURA 09 – Relación y multiplicidades]**

*Figura 9. Propiedades de una relación con sus extremos.*

### 6.9 Mover, redimensionar y acomodar elementos

**Objetivo:** ordenar visualmente el diagrama.

**Pasos:**

1. Active **Seleccionar**.
2. Arrastre una clase para moverla.
3. Utilice los controles de tamaño de la caja para redimensionarla.
4. Con una relación seleccionada, arrastre los puntos de la línea para doblarla.
5. Si una relación tiene puntos manuales, presione **Enderezar** para quitarlos.

**Resultado esperado:** el diagrama adopta la nueva distribución.

Atajos útiles:

- flechas: mover la selección 1 unidad;
- `Mayús` + flechas: mover 10 unidades;
- `Ctrl` + `A`: seleccionar todo;
- `Ctrl` + `0`: ajustar todo el diagrama a la vista.

### 6.10 Eliminar elementos

**Objetivo:** quitar clases o relaciones seleccionadas.

**Pasos:**

1. Active **Seleccionar**.
2. Seleccione uno o varios elementos.
3. Presione `Supr` o `Retroceso`.

**Resultado esperado:** los elementos desaparecen del diagrama.

**Advertencia:** al eliminar una clase también pueden desaparecer sus relaciones. Si fue un error, utilice **Deshacer** inmediatamente.

### 6.11 Deshacer y rehacer

**Objetivo:** revertir o recuperar cambios locales del editor.

**Pasos:**

1. Presione **Deshacer** o use `Ctrl` + `Z`.
2. Presione **Rehacer**, `Ctrl` + `Mayús` + `Z` o `Ctrl` + `Y` para recuperar el cambio.

**Resultado esperado:** el diagrama vuelve al estado anterior o posterior correspondiente.

**Nota:** el historial de deshacer corresponde a sus acciones locales; no deshace una acción remota de otra persona.

### 6.12 Cambiar el nombre del modelo

**Objetivo:** cambiar el nombre interno del diagrama abierto.

**Pasos:**

1. En la barra superior, edite el campo **Nombre del modelo** situado junto a **Diagramador UML**.
2. Haga clic fuera del campo para finalizar la edición.

**Resultado esperado:** el modelo adopta el nuevo nombre y se guarda con el diagrama.

**Nota:** esta acción no cambia el nombre de la tarjeta del proyecto en la pantalla principal.

## 7. Colaboración en tiempo real

### 7.1 Trabajar simultáneamente

**Objetivo:** editar un proyecto con otras personas al mismo tiempo.

**Pasos:**

1. El dueño invita a las demás personas y ellas aceptan.
2. Cada participante abre el mismo proyecto.
3. Realicen cambios normalmente en el editor.

**Resultado esperado:** clases, relaciones, movimientos y ediciones se actualizan en las demás pantallas. El guardado de la sala se coordina automáticamente.

### 7.2 Ver participantes y estados

**Objetivo:** saber quién se encuentra en el proyecto y qué está haciendo.

**Pasos:**

1. Presione el grupo de avatares de la barra superior.
2. Revise el nombre y estado de cada participante.

Estados disponibles:

- **Conectado**;
- **Editando**;
- **Escribiendo…**;
- **Grabando…**;
- **Inactivo**;
- **Desconectado**.

**Resultado esperado:** se muestra la lista de personas presentes. Cada una conserva un color estable en cursores y selecciones.

### 7.3 Seguir la ubicación de otra persona

**Objetivo:** centrar la vista en el trabajo de otro participante.

**Pasos:**

1. Abra la lista de participantes.
2. Presione el nombre de otra persona.

**Resultado esperado:** la vista se centra en su cursor o, si no está sobre el lienzo, en los elementos que tenga seleccionados.

**Nota:** si la persona no tiene cursor ni selección visible, la aplicación muestra un aviso.

### 7.4 Reconexión

Si se interrumpe la conexión, la barra superior muestra **Reconectando…**. Puede continuar editando: la aplicación conserva una cola de cambios y trata de enviarlos cuando vuelve la conexión.

Si durante la desconexión se reemplaza el diagrama completo —por ejemplo, mediante una importación—, al reconectar esa copia puede reemplazar la de la sala y la aplicación lo avisa.

> **[CAPTURA 10 – Participantes y presencia remota]**

*Figura 10. Lista de participantes, estados, cursor y selección remota.*

## 8. Importar y exportar diagramas

### 8.1 Exportar XMI

**Objetivo:** descargar el diagrama en XMI 2.1, utilizable en herramientas como Enterprise Architect.

**Pasos:**

1. Abra el proyecto.
2. Presione **Exportar XMI** en la barra superior.
3. Guarde el archivo cuando el navegador lo solicite.

**Resultado esperado:** se descarga un archivo `.xmi` con el modelo.

### 8.2 Importar XMI

**Objetivo:** reemplazar el diagrama abierto con un modelo contenido en un archivo XMI.

**Pasos:**

1. Abra el proyecto que recibirá el contenido.
2. Presione **Importar XMI**.
3. Seleccione un archivo `.xmi` o `.xml`.
4. Revise el aviso que aparece sobre el lienzo.

**Resultado esperado:** las clases, interfaces, miembros y relaciones reconocidos reemplazan el diagrama del proyecto y quedan pendientes de guardado.

**Nota:** el importador reconoce XMI 2.1 y archivos XMI 1.x de Enterprise Architect. Si el archivo contiene elementos no soportados, se importa lo reconocido y el aviso indica las omisiones. Cuando no hay posiciones utilizables, las cajas se distribuyen automáticamente.

**Advertencia:** la importación reemplaza el contenido actual del editor. Guarde una versión antes si necesita volver con facilidad.

Errores posibles:

- el archivo no es XML válido;
- el archivo está vacío;
- no se encuentra ninguna clase o interfaz;
- alguna información del archivo no está soportada y se omite.

> **[CAPTURA 11 – Controles de importación y exportación]**

*Figura 11. Botones JSON y XMI de la barra del editor.*

### 8.3 Exportar JSON

**Objetivo:** guardar una copia en el formato propio del diagramador.

**Pasos:**

1. Presione **Exportar JSON**.
2. Guarde el archivo `.uml.json`.

**Resultado esperado:** se descarga una copia completa del diagrama.

### 8.4 Importar JSON

**Objetivo:** cargar una copia creada por el diagramador.

**Pasos:**

1. Presione **Importar JSON**.
2. Seleccione el archivo `.uml.json` o `.json`.
3. Revise el mensaje mostrado sobre el lienzo.

**Resultado esperado:** el documento válido reemplaza el diagrama actual y se guarda posteriormente en el proyecto.

**Advertencia:** la importación reemplaza el contenido actual del editor.

## 9. Importar un diagrama desde un boceto

### 9.1 Procesar y crear el proyecto

**Objetivo:** reconstruir un diagrama a partir de una foto o captura.

**Pasos:**

1. En la pantalla principal, presione **Importar boceto**.
2. Escriba el **Nombre del proyecto** o déjelo vacío para usar el nombre del archivo.
3. Presione el área **Elegí una foto o captura**.
4. Seleccione una imagen PNG, JPG o WebP de hasta 10 MB.
5. Espere mientras aparece **Leyendo el boceto…**.
6. Revise el resumen de clases, atributos, operaciones, relaciones y los posibles avisos.
7. Presione **Crear proyecto y abrirlo**.

**Resultado esperado:** se crea un proyecto con el diagrama interpretado y se abre en el editor.

**Nota:** la aplicación puede ajustar el tamaño de la imagen para leer mejor el texto pequeño.

**Advertencia:** la interpretación puede confundir nombres, posiciones, tipos de relación o multiplicidades. Revise siempre el resultado antes de continuar el modelado.

> **[CAPTURA 12 – Selección de un boceto]**

*Figura 12. Carga de una fotografía o captura del diagrama.*

> **[CAPTURA 13 – Resumen del boceto interpretado]**

*Figura 13. Resumen y avisos antes de crear el proyecto.*

## 10. Generar backend Spring Boot

### 10.1 Preparar el diagrama

Para exportar, el diagrama debe contener al menos una clase. Cada clase normal debe tener exactamente un atributo marcado como **{id}**. Las subclases heredan la clave de la raíz de su jerarquía. Una clase de asociación utiliza una clave compuesta basada en sus extremos y no necesita elegir una clave propia.

### 10.2 Generar y descargar el backend

**Objetivo:** descargar un proyecto Spring Boot generado desde el diagrama.

**Pasos:**

1. Abra el proyecto y espere a que los cambios estén guardados.
2. Presione **Exportar backend**.
3. En **Exportar backend**, revise las clases y los tipos de sus atributos.
4. Para cada clase que lo requiera, seleccione un atributo en la columna **clave**.
5. Corrija las filas que indiquen **Ninguna propiedad marcada como clave** o varias claves.
6. Presione **Exportar**.

**Resultado esperado:** el navegador descarga un archivo `.zip` con el proyecto generado.

El archivo incluye la aplicación Spring Boot, entidades, DTO, mapeadores, repositorios, servicios y controladores para las clases concretas, documentación Swagger/OpenAPI, configuración y una colección de Postman. Las clases abstractas e interfaces se representan en el código, pero no generan un CRUD propio.

**Nota:** antes de exportar, la aplicación guarda lo que está en pantalla porque el servidor genera el archivo desde el contenido guardado.

> **[CAPTURA 14 – Exportación del backend]**

*Figura 14. Revisión de claves y tipos antes de descargar Spring Boot.*

## 11. Agente Virtual

### 11.1 Iniciar una conversación de voz

**Objetivo:** consultar o modificar el diagrama mediante órdenes habladas.

**Pasos:**

1. Abra la pestaña **Propiedades**.
2. Presione **Hablar con el agente**.
3. Cuando el navegador solicite acceso, conceda permiso al micrófono.
4. Espere el indicador **Te escucho**.
5. Hable de forma breve y mencione los nombres de los elementos.
6. Presione **Colgar** al terminar.

**Resultado esperado:** el agente responde por voz, muestra la transcripción del diálogo y aplica las operaciones solicitadas cuando son válidas.

Puede usar **Silenciar** y volver a activar el micrófono durante la llamada.

> **[CAPTURA 15 – Agente virtual de voz]**

*Figura 15. Controles, estado y registro del agente virtual.*

### 11.2 Operaciones disponibles

El agente puede:

- resumir el diagrama y describir una clase;
- crear, renombrar, mover o eliminar clases;
- agregar, modificar o quitar atributos;
- agregar o quitar operaciones;
- crear, modificar o eliminar relaciones;
- ordenar el diagrama;
- cambiar el trazado o enderezar una relación;
- deshacer la última acción local.

Ejemplos respaldados por la interfaz:

- “Agregá un atributo precio a Película”.
- “¿Qué relaciones tiene Socio?”.
- “Poné NotaAlquiler a la derecha de Ejemplar”.
- “Ordená el diagrama”.

### 11.3 Confirmaciones y nombres ambiguos

Antes de eliminar una clase o relación, el agente debe pedir una confirmación explícita. La eliminación no se ejecuta si no recibe esa confirmación.

Si varios elementos tienen nombres parecidos, el agente debe pedir que indique cuál. Si no entiende un nombre, repítalo con más claridad o seleccione y edite el elemento manualmente.

### 11.4 Problemas del agente

Si aparece un mensaje sobre el micrófono, revise el permiso del navegador. Si la llamada muestra **Se cortó la llamada** o informa que no pudo contactar con la IA, cuelgue y vuelva a intentarlo cuando la conexión o el servicio estén disponibles.

## 12. Funciones colaborativas avanzadas

### 12.1 Chat grupal de texto

**Objetivo:** conversar con las personas del proyecto.

**Pasos:**

1. Abra la pestaña **Chat**.
2. Escriba en **Escribí un mensaje… (@IA para preguntarle)**.
3. Presione `Enter` o el botón **Enviar mensaje**.
4. Use `Mayús` + `Enter` para insertar una nueva línea.

**Resultado esperado:** el mensaje aparece para toda la sala y queda en el historial del proyecto.

Si el envío falla, el mensaje muestra **No enviado** y permite **Reintentar** o descartarlo.

### 12.2 Preguntar a la IA por texto

**Objetivo:** hacer una consulta sobre el diagrama o proponer un cambio.

**Pasos:**

1. En **Chat**, escriba `@IA` seguido de la pregunta; también puede presionar el botón con destellos para insertar la mención.
2. Envíe el mensaje.
3. Espere el indicador **La IA está escribiendo…**.

**Resultado esperado:** la respuesta aparece en el chat, vinculada a la pregunta y visible para toda la sala. La IA recibe el estado actual del diagrama y el contexto reciente de la conversación.

> **[CAPTURA 16 – Chat grupal y consulta a la IA]**

*Figura 16. Mensajes de la sala y respuesta compartida de la IA.*

### 12.3 Grabar una nota de voz

**Objetivo:** enviar audio a la sala.

**Pasos:**

1. Mantenga presionado el micrófono normal.
2. Hable mientras lo mantiene presionado.
3. Suelte para enviar.

**Resultado esperado:** se publica una nota reproducible con su transcripción cuando está disponible.

Para cancelar, deslice hacia la izquierda antes de soltar o presione `Esc`. La duración máxima es de dos minutos.

### 12.4 Preguntar a la IA por voz

**Objetivo:** enviar una nota de voz que la IA responda con voz y texto.

**Pasos:**

1. Mantenga presionado el micrófono violeta con destellos.
2. Haga la pregunta.
3. Suelte para enviar.

**Resultado esperado:** la nota se transcribe; la IA publica una respuesta compartida con audio y texto. La reproducción automática puede depender de la configuración del navegador.

> **[CAPTURA 17 – Nota de voz y respuesta de la IA]**

*Figura 17. Grabación, transcripción y reproducción de mensajes de voz.*

### 12.5 Votar los cambios propuestos por la IA

Cuando una solicitud del chat modifica el diagrama, el cambio se aplica de forma provisional y se marca en el lienzo hasta que la sala decida.

**Objetivo:** conservar o descartar como equipo los cambios de la IA.

**Pasos:**

1. Revise el panel **Cambios de la IA** sobre el cuadro de mensaje.
2. Examine la lista de cambios y el tiempo restante.
3. Presione **Conservar** o **Descartar**.
4. Si lo desea, cambie su voto antes del cierre.

**Resultado esperado:** al cerrar la votación, la aplicación indica si los cambios se conservan o se descartan. Si se descartan, se revierte el cambio; si se conservan, se crea una versión de origen IA.

También se reconocen respuestas breves como “sí” o “no” en el chat y en notas de voz. La votación cierra cuando votaron todas las personas presentes o al llegar al límite de dos minutos. En empate, decide el voto de quien pidió el cambio. Si nadie vota antes de finalizar la votación, los cambios se conservan porque ya fueron aplicados al diagrama.

> **[CAPTURA 18 – Votación de cambios de la IA]**

*Figura 18. Cambios provisionales, conteo y botones de votación.*

### 12.6 Guardar una versión manual

**Objetivo:** conservar un punto reconocible del diagrama.

**Pasos:**

1. Abra la pestaña **Versiones**.
2. Escriba un texto en **Nombre (opcional)**.
3. Presione **Guardar versión**.

**Resultado esperado:** la versión aparece en la lista con número, fecha, autor y cantidad de clases y relaciones.

La sala también crea versiones automáticas mientras se edita, versiones de los cambios de IA conservados y respaldos antes de restaurar.

### 12.7 Consultar y restaurar una versión

**Objetivo:** revisar un estado anterior y recuperarlo para toda la sala.

**Pasos:**

1. Abra **Versiones**.
2. Presione una versión de la lista.
3. Revise la vista **Solo lectura**.
4. Presione **Restaurar esta versión**.
5. Revise el aviso y presione **Sí, restaurar**.

**Resultado esperado:** la versión elegida reemplaza el diagrama de toda la sala. El estado anterior se guarda como una versión nueva para poder recuperarlo.

**Advertencia:** no se puede restaurar mientras existe una votación abierta sobre cambios de la IA.

> **[CAPTURA 19 – Historial de versiones]**

*Figura 19. Lista de versiones manuales, automáticas, de IA y restauración.*

> **[CAPTURA 20 – Previsualización y restauración]**

*Figura 20. Vista de solo lectura y confirmación de restauración.*

## 13. Solución de problemas

| Problema | Posible causa | Solución |
|---|---|---|
| No se puede iniciar sesión | Correo o contraseña incorrectos; cuenta desactivada; conexión interrumpida | Revise los datos. Si aparece **Credenciales invalidas**, vuelva a escribirlos. Compruebe la conexión y reintente. |
| No se cargan los proyectos | El servidor o la conexión no están disponibles | Presione **Reintentar**. |
| No se puede abrir un proyecto | El proyecto no existe, no tiene permisos o el contenido no es válido | Regrese con **Volver a mis proyectos**. Compruebe que la invitación esté aceptada y pida al dueño que confirme el acceso. |
| No aparece un proyecto invitado | La invitación sigue pendiente o la lista no se actualizó | Abra **Invitaciones**, presione **Aceptar** y, si hace falta, **Actualizar**. |
| No se puede invitar | No es el dueño, el UUID no es válido, no existe el usuario o ya fue invitado | Use un proyecto propio y copie exactamente el UUID de la otra persona. |
| Aparece **Reconectando…** | Se interrumpió el socket de la sala | Continúe con precaución y espere la reconexión. Revise después el aviso de sincronización y el estado de guardado. |
| Aparece **No se pudo guardar** | Falló la conexión o el servidor rechazó el guardado | Mantenga el editor abierto, recupere la conexión y realice otro cambio o vuelva a la lista para provocar un nuevo intento de guardado. |
| XMI no se importa | El archivo no es XML válido, está vacío o no contiene clases/interfaz reconocibles | Exporte nuevamente desde la herramienta de origen como XMI 1.x o 2.1 y revise el archivo. |
| Faltan elementos después de importar XMI | El archivo contiene elementos no soportados | Revise el aviso mostrado y complete manualmente lo omitido. |
| El boceto no se reconoce | Imagen borrosa, inclinada, demasiado grande o IA no disponible | Use una foto nítida y frontal en PNG, JPG o WebP de hasta 10 MB y vuelva a intentar. |
| El micrófono no funciona | Permiso bloqueado o dispositivo no disponible | Permita el micrófono para el sitio y compruebe el dispositivo seleccionado por el navegador. |
| Una nota queda **Sin transcripción** | No se entendió el audio o falló el servicio | Reproduzca la nota y vuelva a grabarla con menos ruido. |
| La IA no responde | Servicio de IA no configurado, no disponible o tiempo de espera agotado | Reintente más tarde. El resto del editor puede seguir utilizándose. |
| No se puede exportar Spring Boot | No hay clases o alguna clase no tiene exactamente una clave | Agregue un atributo, marque **{id}** o elija la clave en **Exportar backend**. |
| No se puede restaurar una versión | Hay una votación abierta o la versión no se pudo cargar | Espere el cierre de la votación y vuelva a intentar. |

## 14. Preguntas frecuentes

### ¿Cómo creo un proyecto?

En **Mis proyectos**, presione **Nuevo proyecto**, escriba el nombre y elija **Crear y abrir**.

### ¿Cómo invito a otra persona?

Pídale su UUID, abra un proyecto propio, presione **Invitar**, busque el UUID y confirme con **Invitar**.

### ¿Puedo trabajar con otra persona al mismo tiempo?

Sí. Cuando ambas personas abren el proyecto, los cambios, cursores, selecciones, estados y mensajes se comparten en tiempo real.

### ¿Cómo exporto mi diagrama?

Use **Exportar JSON** para una copia propia del diagramador o **Exportar XMI** para XMI 2.1. Para código, use **Exportar backend**.

### ¿Qué formatos XMI se pueden importar?

La aplicación acepta archivos `.xmi` y `.xml`, reconoce XMI 2.1 y archivos XMI 1.x de Enterprise Architect. La exportación genera XMI 2.1.

### ¿El boceto crea el proyecto inmediatamente?

No. Primero se muestra un resumen de lo interpretado; el proyecto se crea al presionar **Crear proyecto y abrirlo**.

### ¿Qué hago si la IA interpreta mal mi comando?

Explique el nombre exacto o haga el cambio manualmente. Para una acción local del agente puede usar **Deshacer**. En el chat, descarte la propuesta durante la votación.

### ¿Puedo recuperar un diagrama anterior?

Sí. Abra **Versiones**, previsualice una versión y use **Restaurar esta versión**. Antes de restaurar se conserva una copia del estado actual.

### ¿Cómo se cancela una nota de voz?

Mientras mantiene presionado el micrófono, deslice hacia la izquierda o presione `Esc`; luego suelte.

### ¿Puedo renombrar o eliminar un proyecto desde la pantalla principal?

No. La interfaz actual permite crear y abrir proyectos, pero no muestra acciones para renombrarlos o eliminarlos. Cambiar **Nombre del modelo** dentro del editor no cambia la tarjeta del proyecto.

## 15. Glosario

- **UML:** lenguaje visual utilizado para representar la estructura de un sistema.
- **Clase:** elemento que representa un tipo de objeto con atributos y operaciones.
- **Interfaz:** contrato de operaciones que una clase puede realizar.
- **Clase abstracta:** clase que sirve como base de otras y no se instancia directamente.
- **Atributo:** dato o propiedad de una clase.
- **Operación:** acción o método definido en una clase o interfaz.
- **Parámetro:** dato que recibe una operación.
- **Relación:** vínculo entre dos elementos del diagrama.
- **Multiplicidad:** cantidad permitida de objetos en un extremo de una relación, por ejemplo `1`, `0..1` o `0..*`.
- **Navegabilidad:** indica desde qué extremo se puede recorrer una relación.
- **Clase de asociación:** clase que guarda datos propios de una relación.
- **XMI:** formato XML para intercambiar modelos UML entre herramientas.
- **JSON:** formato utilizado por la copia completa propia del diagramador.
- **Spring Boot:** estructura de backend Java que la aplicación puede generar y descargar.
- **Boceto:** fotografía o captura de un diagrama que la aplicación intenta reconstruir.
- **IA:** asistente que puede responder preguntas y proponer o ejecutar operaciones sobre el diagrama.
- **Proyecto compartido:** proyecto de otra persona al que se accede mediante una invitación aceptada.
- **UUID:** identificador único de la cuenta utilizado para enviar invitaciones.
- **Sala:** sesión en tiempo real formada por las personas que tienen abierto el mismo proyecto.
- **Versión:** copia guardada del diagrama en un momento determinado.
- **Cambio provisional:** modificación propuesta por la IA que todavía espera la decisión de la sala.
