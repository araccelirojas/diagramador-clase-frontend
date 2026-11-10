import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'

import { completeOnboarding, fetchProfile } from '@/api/auth'
import { useAuthStore } from '@/auth/useAuthStore'
import { CompletionTourModal } from '@/onboarding/CompletionTourModal'
import { TourBridge } from '@/onboarding/TourBridge'
import { TourOverlay } from '@/onboarding/TourOverlay'
import { WelcomeTourModal } from '@/onboarding/WelcomeTourModal'
import { initialTourState, needsOnboarding, tourReducer } from '@/onboarding/tourState'
import { FIRST_EDITOR_STEP, tourScope, tourSteps } from '@/onboarding/tourSteps'
import { OnboardingContext } from '@/onboarding/useOnboarding'

/** Mounted above both protected routes: navigation never discards tour progress. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const usuario = useAuthStore((state) => state.usuario)
  const token = useAuthStore((state) => state.token)
  const owner = usuario?.idUsuario
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(tourReducer, initialTourState)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<Promise<void> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const cached = useAuthStore.getState().usuario
    // Read the server even when the browser restored an old cached session.
    void fetchProfile(controller.signal).then((profile) => {
      if (controller.signal.aborted || useAuthStore.getState().token !== token) return
      const current = useAuthStore.getState()
      // A completion request can finish before this profile read.
      if (!current.usuario || current.usuario.idUsuario !== owner) return
      const completedWhileReading = current.usuario !== cached && current.usuario.onboardingCompletado
      const fresh = completedWhileReading ? { ...profile, onboardingCompletado: true } : profile
      current.setUsuario(fresh)
      dispatch({ type: 'profile', completed: !needsOnboarding(fresh) })
    }).catch(() => {
      // An unavailable profile must not turn stale browser data into an auto-tour.
      // The Guía button remains available; the HTTP client handles expired tokens.
    })
    return () => controller.abort()
  }, [token, owner])

  useEffect(() => { dispatch({ type: 'route', scope: tourScope(pathname) }) }, [pathname])

  const persist = useCallback((showFinish: boolean) => {
    if (request.current) return
    if (useAuthStore.getState().usuario?.onboardingCompletado) {
      dispatch({ type: 'completed', showFinish })
      return
    }
    setSaving(true)
    setError(null)
    const operation = completeOnboarding().then((profile) => {
      const current = useAuthStore.getState()
      if (current.token !== token || current.usuario?.idUsuario !== owner) return
      current.setUsuario(profile)
      dispatch({ type: 'completed', showFinish })
    }).catch(() => {
      if (useAuthStore.getState().token === token) setError('No se pudo guardar el recorrido. Vuelve a intentarlo.')
    }).finally(() => { request.current = null; setSaving(false) })
    request.current = operation
  }, [token, owner])

  const skip = useCallback(() => persist(false), [persist])
  const missing = useCallback(() => dispatch({ type: 'missing' }), [])
  const previous = () => {
    if (tourScope(pathname) === 'editor' && state.index === FIRST_EDITOR_STEP) navigate('/')
    dispatch({ type: 'previous' })
  }
  const next = () => {
    if (state.index === tourSteps.length - 1) persist(true)
    else dispatch({ type: 'next' })
  }
  const open = () => { setError(null); dispatch({ type: 'open' }) }
  const start = () => dispatch({ type: 'start', scope: tourScope(pathname) ?? 'home' })
  const active = state.phase !== 'idle'
  const step = state.phase === 'tour' ? tourSteps[state.index] ?? null : null

  useEffect(() => {
    if (!active) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      skip()
    }
    document.addEventListener('keydown', escape, true)
    return () => document.removeEventListener('keydown', escape, true)
  }, [active, skip])

  const controls = { previous, next, skip, saving, error }
  return (
    <OnboardingContext.Provider value={{ step, active, open }}>
      {children}
      {active && createPortal(
        <div className="pointer-events-none" data-presence-ignore data-onboarding-root>
          {state.phase === 'welcome' && <WelcomeTourModal name={usuario?.nombre ?? ''} start={start} {...controls} />}
          {step && <TourOverlay key={step.id} step={step} index={state.index} onMissing={missing} {...controls} />}
          {state.phase === 'waiting' && <TourBridge {...controls} />}
          {state.phase === 'finished' && <CompletionTourModal done={() => persist(false)} {...controls} />}
        </div>, document.body,
      )}
    </OnboardingContext.Provider>
  )
}
