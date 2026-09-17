import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { router } from '@/app/routes'
// Side-effect import: loading the store is what wires the token into the HTTP
// client. The route guards happen to import it too, but relying on that would
// make the session break the day a route is lazy-loaded.
import '@/auth/useAuthStore'
import '@/index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('No se encontró el elemento #root en index.html')
}

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
