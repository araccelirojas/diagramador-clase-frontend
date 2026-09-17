import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { login } from '@/api/auth'
import { ApiError } from '@/api/client'
import { normalizeCorreo, validateCorreo } from '@/auth/validation'
import { useAuthStore } from '@/auth/useAuthStore'
import { AuthLayout } from '@/ui/auth/AuthLayout'
import { Field } from '@/ui/auth/Field'
import { FormError } from '@/ui/auth/FormError'
import { SubmitButton } from '@/ui/auth/SubmitButton'

/** Where RequireAuth wanted to go before it bounced us here. */
function intendedDestination(state: unknown): string {
  if (state !== null && typeof state === 'object' && 'from' in state) {
    const { from } = state as { from: unknown }
    // Only same-site paths: an absolute URL in navigation state is an open redirect.
    if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from
  }

  return '/'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const signIn = useAuthStore((state) => state.signIn)

  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ correo: string | null; password: string | null }>(
    { correo: null, password: null },
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (pending) return

    // The password is only checked for presence: an old account may predate the
    // 8-character rule, and refusing to even try would lock its owner out.
    const errors = {
      correo: validateCorreo(correo),
      password: password === '' ? 'Escribe tu contraseña.' : null,
    }
    setFieldErrors(errors)
    setFormError(null)

    if (errors.correo !== null || errors.password !== null) return

    setPending(true)

    try {
      const sesion = await login({ correo: normalizeCorreo(correo), password })
      signIn(sesion)
      navigate(intendedDestination(location.state), { replace: true })
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : 'No se pudo iniciar sesión. Intenta de nuevo.',
      )
      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Inicia sesión"
      subtitle="Entra para ver tus proyectos y abrir sus diagramas."
      footer={
        <>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" className="font-medium text-sky-600 hover:text-sky-700">
            Crea una
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)} noValidate>
        <FormError message={formError} />

        <Field
          label="Correo"
          type="email"
          value={correo}
          onChange={setCorreo}
          error={fieldErrors.correo}
          autoComplete="email"
          placeholder="tucorreo@ejemplo.com"
          disabled={pending}
        />

        <Field
          label="Contraseña"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
          disabled={pending}
        />

        <SubmitButton label="Entrar" pending={pending} />
      </form>
    </AuthLayout>
  )
}
