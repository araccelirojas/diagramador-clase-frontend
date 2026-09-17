import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { register } from '@/api/auth'
import { ApiError } from '@/api/client'
import {
  normalizeCorreo,
  PASSWORD_MIN_LENGTH,
  validateCorreo,
  validateNombre,
  validatePassword,
} from '@/auth/validation'
import { useAuthStore } from '@/auth/useAuthStore'
import { AuthLayout } from '@/ui/auth/AuthLayout'
import { Field } from '@/ui/auth/Field'
import { FormError } from '@/ui/auth/FormError'
import { SubmitButton } from '@/ui/auth/SubmitButton'

type FieldErrors = {
  nombre: string | null
  correo: string | null
  password: string | null
  confirmacion: string | null
}

const NO_ERRORS: FieldErrors = { nombre: null, correo: null, password: null, confirmacion: null }

export function SignupPage() {
  const navigate = useNavigate()
  const signIn = useAuthStore((state) => state.signIn)

  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    if (pending) return

    const errors: FieldErrors = {
      nombre: validateNombre(nombre),
      correo: validateCorreo(correo),
      password: validatePassword(password),
      confirmacion: password !== confirmacion ? 'Las contraseñas no coinciden.' : null,
    }
    setFieldErrors(errors)
    setFormError(null)

    if (Object.values(errors).some((message) => message !== null)) return

    setPending(true)

    try {
      const sesion = await register({
        nombre: nombre.trim(),
        correo: normalizeCorreo(correo),
        password,
      })

      // The backend hands back a token on registration, so there is no reason
      // to bounce a brand-new user through the login form.
      signIn(sesion)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // "Ya existe un usuario con ese correo" is about one field; showing it
        // as a banner leaves the user hunting for which one.
        setFieldErrors({ ...errors, correo: error.message })
      } else {
        setFormError(
          error instanceof ApiError ? error.message : 'No se pudo crear la cuenta. Intenta de nuevo.',
        )
      }

      setPending(false)
    }
  }

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Necesitas una para guardar y compartir tus diagramas."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-sky-600 hover:text-sky-700">
            Inicia sesión
          </Link>
        </>
      }
    >
      <form onSubmit={(event) => void submit(event)} noValidate>
        <FormError message={formError} />

        <Field
          label="Nombre"
          value={nombre}
          onChange={setNombre}
          error={fieldErrors.nombre}
          autoComplete="name"
          placeholder="Tu nombre"
          disabled={pending}
        />

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
          hint={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`}
          autoComplete="new-password"
          disabled={pending}
        />

        <Field
          label="Repite la contraseña"
          type="password"
          value={confirmacion}
          onChange={setConfirmacion}
          error={fieldErrors.confirmacion}
          autoComplete="new-password"
          disabled={pending}
        />

        <SubmitButton label="Crear cuenta" pending={pending} />
      </form>
    </AuthLayout>
  )
}
