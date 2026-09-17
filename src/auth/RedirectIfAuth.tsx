import { Navigate, Outlet } from 'react-router-dom'

import { useAuthStore } from '@/auth/useAuthStore'

/** The inverse gate: /login and /registro make no sense with a session open. */
export function RedirectIfAuth() {
  const token = useAuthStore((state) => state.token)

  return token === null ? <Outlet /> : <Navigate to="/" replace />
}
