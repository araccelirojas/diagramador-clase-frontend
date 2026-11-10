# Guía interactiva

`RequireAuth` mantiene `OnboardingProvider` por sesión por encima de Home y Editor. El reducer conserva el progreso en memoria al cambiar de ruta. Al recargar se consulta de nuevo el perfil; solo `onboardingCompletado: false` recibido del servidor abre automáticamente la bienvenida.

`Guía` permite repetirla en Home y en la barra del editor. Omitir, Saltar recorrido, Escape o Finalizar recorrido guardan `true` mediante `PATCH /api/auth/onboarding`. El endpoint no recibe identificadores ni permite volver a `false`. Si el guardado falla, la guía informa del error y permite reintentarlo.

Después de los pasos de Home, una tarjeta permite crear o abrir un proyecto mediante el flujo habitual. No se crean datos automáticamente. `useEditorTour` prepara únicamente los paneles y pestañas visibles. Los objetivos se resuelven por `data-tour`, se esperan 1,8 segundos si faltan y se omiten sin guardar la finalización. Si falta el último objetivo, la tarjeta final requiere una acción explícita para guardar.

`TourOverlay` y `TourTooltip` calculan el resaltado y la posición sin dependencias adicionales. La bienvenida y el cierre son modales con foco contenido; los pasos permiten interactuar con la pantalla. El progreso temporal no se persiste en el documento UML ni en el almacenamiento del navegador.

## Manual completo

Configurar en el entorno de Vite y reiniciar/recompilar:

```dotenv
VITE_MANUAL_URL=https://tu-dominio.example/manual/
```

Sin URL se oculta «Abrir manual completo». Con URL abre una pestaña nueva. El manual existente en `docs/` no se modifica.

## Backend

Migración: `20261110000000_onboarding_usuario`. Añade `usuarios.onboardingCompletado BOOLEAN NOT NULL DEFAULT false`, también para las cuentas existentes. Aplicar con `npm run db:deploy` y generar cliente con `npm run db:generate` antes de ejecutar. El arranque habitual también despliega migraciones si `AUTO_MIGRATE` está habilitado.

## Comprobaciones

- Frontend: `npm test -- src/onboarding`, `npm run build`, `npm run lint`.
- Backend: `node --test src/services/onboarding.test.js src/routes/onboarding.test.js`.
- Visual: bienvenida, pasos Home → Editor, controles resaltados utilizables, Anterior/Siguiente, Escape y repetición en 1366×768 y 1920×1080.
