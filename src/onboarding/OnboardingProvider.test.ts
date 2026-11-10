// @vitest-environment jsdom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { completeOnboarding, fetchProfile } from '@/api/auth'
import type { Usuario } from '@/api/types'
import { useAuthStore } from '@/auth/useAuthStore'
import { GuideButton } from '@/onboarding/GuideButton'
import { OnboardingProvider } from '@/onboarding/OnboardingProvider'
import { tourScope, tourSteps } from '@/onboarding/tourSteps'
import { TARGET_WAIT_MS } from '@/onboarding/useTourTarget'

vi.mock('@/api/auth', () => ({ completeOnboarding: vi.fn(), fetchProfile: vi.fn() }))
const user: Usuario = { idUsuario: 'u1', nombre: 'Susana', correo: 'susana@example.test', fechaRegistro: '2026-11-10', estado: true, onboardingCompletado: false }
let root: Root
let container: HTMLDivElement
let absent: string | undefined

function Screen() {
  const location = useLocation()
  const navigate = useNavigate()
  return h('div', null,
    h(GuideButton),
    h('button', { onClick: () => navigate('/proyectos/p1') }, 'Abrir proyecto'),
    ...tourSteps.filter((s) => s.scope === tourScope(location.pathname) && s.target && s.target !== absent)
      .map((s) => h('button', { key: s.id, 'data-tour': s.target }, s.title)),
  )
}

async function render() {
  await act(async () => { root.render(h(MemoryRouter, null, h(OnboardingProvider, null, h(Screen)))) })
  await act(async () => { await vi.advanceTimersByTimeAsync(35) })
}

async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent === label)
  if (!button) throw new Error(`Missing button: ${label}. Screen: ${document.body.textContent}`)
  await act(async () => { button.click() })
  await act(async () => { await vi.advanceTimersByTimeAsync(35) })
}

const title = () => document.querySelector('#tour-title')?.textContent

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return DOMRect.fromRect({ x: 100, y: 100, width: this.hasAttribute('data-onboarding-card') ? 320 : 100, height: this.hasAttribute('data-onboarding-card') ? 240 : 30 })
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  useAuthStore.getState().signIn({ token: 'test-token', usuario: { ...user } })
  vi.mocked(fetchProfile).mockResolvedValue({ ...user })
  vi.mocked(completeOnboarding).mockResolvedValue({ ...user, onboardingCompletado: true })
  absent = undefined
  container = document.createElement('div')
  container.id = 'root'
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  useAuthStore.getState().signOut()
  vi.clearAllMocks()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('onboarding integration', () => {
  it('welcomes a pending user, moves next/previous and permits interaction', async () => {
    await render()
    expect(document.body.textContent).toContain('¡Hola, Susana!')
    await click('Comenzar recorrido')
    expect(title()).toBe('Tu identificador')
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    await click('Siguiente →')
    expect(title()).toBe('Crea tu primer proyecto')
    await click('← Anterior')
    expect(title()).toBe('Tu identificador')
    expect(completeOnboarding).not.toHaveBeenCalled()
  })

  it('uses the fresh profile and allows manual repetition without resetting completion', async () => {
    vi.mocked(fetchProfile).mockResolvedValue({ ...user, onboardingCompletado: true })
    await render()
    expect(document.querySelector('[data-onboarding-root]')).toBeNull()
    await click('Guía')
    await click('Comenzar recorrido')
    expect(title()).toBe('Tu identificador')
    await click('Saltar recorrido')
    expect(useAuthStore.getState().usuario?.onboardingCompletado).toBe(true)
    expect(completeOnboarding).not.toHaveBeenCalled()
  })

  it('trusts a pending server profile even when an old browser cache says completed', async () => {
    useAuthStore.getState().setUsuario({ ...user, onboardingCompletado: true })
    await render()
    expect(document.body.textContent).toContain('¡Hola, Susana!')
  })

  it('persists omission and does not auto-open in a new authenticated mount', async () => {
    await render()
    await click('Omitir')
    expect(completeOnboarding).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().usuario?.onboardingCompletado).toBe(true)
    await act(async () => root.unmount())
    root = createRoot(container)
    vi.mocked(fetchProfile).mockResolvedValue({ ...user, onboardingCompletado: true })
    await render()
    expect(document.querySelector('[data-onboarding-root]')).toBeNull()
  })

  it('continues Home → Editor and persists only when Finalizar is pressed', async () => {
    await render()
    await click('Comenzar recorrido')
    for (let i = 0; i < 4; i++) await click('Siguiente →')
    expect(document.body.textContent).toContain('Continuemos en tu diagrama')
    expect(completeOnboarding).not.toHaveBeenCalled()
    await click('Abrir proyecto')
    expect(title()).toBe('Elementos UML')
    for (let i = 0; i < 10; i++) await click('Siguiente →')
    expect(title()).toBe('Modela usando tu voz')
    expect(completeOnboarding).not.toHaveBeenCalled()
    await click('Finalizar recorrido')
    expect(completeOnboarding).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('¡Listo!')
    await click('Empezar a diagramar')
    expect(completeOnboarding).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-onboarding-root]')).toBeNull()
  })

  it('waits briefly and skips a missing target without persisting completion', async () => {
    absent = 'uuid'
    await render()
    await click('Comenzar recorrido')
    expect(document.body.textContent).toContain('Preparando el siguiente paso')
    await act(async () => { await vi.advanceTimersByTimeAsync(TARGET_WAIT_MS + 35) })
    await act(async () => { await vi.advanceTimersByTimeAsync(35) })
    expect(title()).toBe('Crea tu primer proyecto')
    expect(completeOnboarding).not.toHaveBeenCalled()
  })

  it('keeps a failed persistence request retryable and handles Escape as omission', async () => {
    vi.mocked(completeOnboarding).mockRejectedValueOnce(new Error('offline'))
    await render()
    await click('Omitir')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('No se pudo guardar')
    expect(useAuthStore.getState().usuario?.onboardingCompletado).toBe(false)
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })) })
    expect(completeOnboarding).toHaveBeenCalledTimes(2)
    expect(document.querySelector('[data-onboarding-root]')).toBeNull()
  })

  it('does not persist automatically when the final target is absent', async () => {
    absent = 'agente'
    await render()
    await click('Comenzar recorrido')
    await click('Abrir proyecto')
    for (let i = 0; i < 10; i++) await click('Siguiente →')
    await act(async () => { await vi.advanceTimersByTimeAsync(TARGET_WAIT_MS + 35) })
    expect(document.body.textContent).toContain('¡Listo!')
    expect(completeOnboarding).not.toHaveBeenCalled()
    expect(useAuthStore.getState().usuario?.onboardingCompletado).toBe(false)
    await click('Empezar a diagramar')
    expect(completeOnboarding).toHaveBeenCalledTimes(1)
  })

  it('repositions on resize even when the target stays at the same coordinates', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return DOMRect.fromRect({ x: this.dataset.tour === 'uuid' ? 900 : 100, y: 100, width: this.hasAttribute('data-onboarding-card') ? 320 : 100, height: this.hasAttribute('data-onboarding-card') ? 240 : 30 })
    })
    vi.stubGlobal('innerWidth', 1024)
    await render()
    await click('Comenzar recorrido')
    const before = document.querySelector<HTMLElement>('[data-onboarding-card]')?.style.left
    vi.stubGlobal('innerWidth', 1366)
    await act(async () => { window.dispatchEvent(new Event('resize')); await vi.advanceTimersByTimeAsync(35) })
    const after = document.querySelector<HTMLElement>('[data-onboarding-card]')?.style.left
    expect(before).not.toBe(after)
    expect(completeOnboarding).not.toHaveBeenCalled()
  })
})
