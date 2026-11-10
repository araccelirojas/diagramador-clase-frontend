export type TourScope = 'home' | 'editor'
export type TourSide = 'top' | 'right' | 'bottom' | 'left'
export type TourStep = {
  id: string
  scope: TourScope
  title: string
  description: string
  target?: string
  side?: TourSide
}

/** Stable data-tour names are independent of labels, DOM order and UML data. */
export const tourSteps: readonly TourStep[] = [
  { id: 'welcome', scope: 'home', title: '¡Bienvenido a Diagramador UML!', description: 'Con esta herramienta puedes crear diagramas UML, colaborar con otras personas, importar modelos y generar un backend Spring Boot.' },
  { id: 'uuid', scope: 'home', target: 'uuid', title: 'Tu identificador', description: 'Comparte este UUID con otras personas para que puedan invitarte a sus proyectos.', side: 'bottom' },
  { id: 'project', scope: 'home', target: 'nuevo-proyecto', title: 'Crea tu primer proyecto', description: 'Desde aquí puedes crear un nuevo espacio de trabajo y comenzar un diagrama UML desde cero.', side: 'bottom' },
  { id: 'sketch', scope: 'home', target: 'importar-boceto', title: 'Convierte un boceto en un diagrama', description: 'Puedes cargar una fotografía o captura de un diagrama para que el sistema intente reconstruirlo automáticamente.', side: 'bottom' },
  { id: 'invitations', scope: 'home', target: 'invitaciones', title: 'Trabaja con otras personas', description: 'Aquí puedes revisar y aceptar invitaciones a proyectos compartidos.', side: 'top' },
  { id: 'palette', scope: 'editor', target: 'paleta', title: 'Elementos UML', description: 'Desde aquí puedes agregar clases, clases abstractas, interfaces, atributos, operaciones y relaciones.', side: 'right' },
  { id: 'class', scope: 'editor', target: 'clase', title: 'Comienza a modelar', description: 'Selecciona o arrastra una clase al lienzo para comenzar tu diagrama. No necesitas crear una para continuar el recorrido.', side: 'right' },
  { id: 'canvas', scope: 'editor', target: 'lienzo', title: 'Tu espacio de trabajo', description: 'En el lienzo puedes mover, seleccionar y conectar los elementos de tu modelo.', side: 'right' },
  { id: 'properties', scope: 'editor', target: 'propiedades', title: 'Edita los detalles', description: 'Selecciona una clase o relación para modificar sus propiedades, atributos, operaciones y multiplicidades.', side: 'left' },
  { id: 'relations', scope: 'editor', target: 'relaciones', title: 'Conecta tus clases', description: 'Puedes crear asociaciones, agregaciones, composiciones, generalizaciones y otras relaciones UML.', side: 'right' },
  { id: 'exchange', scope: 'editor', target: 'intercambio', title: 'Intercambia tus modelos', description: 'Puedes guardar una copia del diagrama o trabajar con archivos XMI compatibles con otras herramientas.', side: 'bottom' },
  { id: 'collaboration', scope: 'editor', target: 'colaboracion', title: 'Trabaja en equipo', description: 'Invita colaboradores y observa sus cambios, cursores y selecciones en tiempo real.', side: 'bottom' },
  { id: 'chat', scope: 'editor', target: 'chat', title: 'Comunicación del proyecto', description: 'Utiliza el chat de la sala para comunicarte con los demás participantes y consultar a la IA.', side: 'left' },
  { id: 'versions', scope: 'editor', target: 'versiones', title: 'Recupera estados anteriores', description: 'Guarda y consulta versiones del diagrama para poder restaurar estados anteriores.', side: 'left' },
  { id: 'backend', scope: 'editor', target: 'exportar-backend', title: 'Genera tu backend', description: 'Cuando tu modelo esté listo, puedes generar y descargar automáticamente un proyecto Spring Boot.', side: 'bottom' },
  { id: 'voice', scope: 'editor', target: 'agente', title: 'Modela usando tu voz', description: 'El agente virtual puede ayudarte a consultar y modificar el diagrama mediante instrucciones habladas.', side: 'left' },
]

export const FIRST_EDITOR_STEP = 5
export const LAST_HOME_STEP = FIRST_EDITOR_STEP - 1
export const MANUAL_URL: string | undefined = import.meta.env.VITE_MANUAL_URL?.trim() || undefined

export function tourScope(pathname: string): TourScope | null {
  if (pathname === '/') return 'home'
  return /^\/proyectos\/[^/]+\/?$/.test(pathname) ? 'editor' : null
}
