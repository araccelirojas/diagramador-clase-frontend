import { createBrowserRouter, Navigate } from 'react-router-dom'

import { RedirectIfAuth } from '@/auth/RedirectIfAuth'
import { RequireAuth } from '@/auth/RequireAuth'
import { EditorPage } from '@/pages/EditorPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'

/**
 * Four screens, split by whether they need a session. The guards are layout
 * routes rather than a check inside each page: one place decides, and a page
 * added later cannot forget to protect itself.
 */
export const router = createBrowserRouter([
  {
    element: <RedirectIfAuth />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/registro', element: <SignupPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: '/', element: <HomePage /> },
      // The editor loads this project's `contenido` before rendering the canvas.
      { path: '/proyectos/:idProyecto', element: <EditorPage /> },
    ],
  },
  // Unknown URL: let the guards decide between home and login.
  { path: '*', element: <Navigate to="/" replace /> },
])
