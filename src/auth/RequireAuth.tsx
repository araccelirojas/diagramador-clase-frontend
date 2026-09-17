import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuthStore } from '@/auth/useAuthStore'

/**
 * Gate for every screen that needs a session. The attempted URL rides along in
 * the navigation state so signing in lands you where you were going, not on a
 * generic home — which matters most for a link straight to a project.
 */
export function RequireAuth() {
  const token = useAuthStore((state) => state.token)
  const location = useLocation()

  if (token === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}
