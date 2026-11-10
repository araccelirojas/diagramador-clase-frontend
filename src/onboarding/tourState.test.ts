import { describe, expect, it } from 'vitest'

import { initialTourState, needsOnboarding, tourReducer } from '@/onboarding/tourState'
import { FIRST_EDITOR_STEP, LAST_HOME_STEP, tourScope, tourSteps } from '@/onboarding/tourSteps'

describe('first-use tour state', () => {
  it('opens only for a confirmed pending profile', () => {
    expect(needsOnboarding(null)).toBe(false)
    expect(needsOnboarding({})).toBe(false)
    expect(needsOnboarding({ onboardingCompletado: false })).toBe(true)
    expect(needsOnboarding({ onboardingCompletado: true })).toBe(false)
    expect(tourReducer(initialTourState, { type: 'profile', completed: false }).phase).toBe('welcome')
    expect(tourReducer(initialTourState, { type: 'profile', completed: true }).phase).toBe('idle')
  })

  it('moves forwards/backwards and waits for a real project', () => {
    let state = tourReducer(initialTourState, { type: 'start', scope: 'home' })
    expect(state.index).toBe(1)
    state = tourReducer(state, { type: 'next' })
    expect(state.index).toBe(2)
    state = tourReducer(state, { type: 'previous' })
    expect(state.index).toBe(1)
    state = tourReducer({ ...state, index: LAST_HOME_STEP }, { type: 'next' })
    expect(state.phase).toBe('waiting')
    expect(tourReducer(state, { type: 'previous' }).index).toBe(LAST_HOME_STEP)
    state = tourReducer(state, { type: 'route', scope: 'editor' })
    expect(state).toMatchObject({ phase: 'tour', index: FIRST_EDITOR_STEP })
    expect(tourReducer(state, { type: 'route', scope: 'home' })).toMatchObject({ phase: 'waiting', index: LAST_HOME_STEP })
  })

  it('finishes/skips only via explicit completion and allows reopening', () => {
    const completed = tourReducer(initialTourState, { type: 'completed', showFinish: true })
    expect(completed.phase).toBe('finished')
    const skipped = tourReducer(completed, { type: 'completed', showFinish: false })
    expect(skipped.phase).toBe('idle')
    const reopened = tourReducer(skipped, { type: 'open' })
    expect(reopened.phase).toBe('welcome')
    expect(tourReducer(reopened, { type: 'profile', completed: true }).phase).toBe('welcome')
  })

  it('skips missing targets without changing the permanent completion state', () => {
    const missing = tourReducer({ ...initialTourState, phase: 'tour', index: 6, direction: 1 }, { type: 'missing' })
    expect(missing.index).toBe(7)
    expect(missing.checked).toBe(false)
    const last = tourReducer({ ...missing, index: tourSteps.length - 1 }, { type: 'missing' })
    expect(last.phase).toBe('finished')
    expect(last.checked).toBe(false)
    expect(tourReducer({ ...missing, direction: -1 }, { type: 'missing' }).index).toBe(6)
  })

  it('recognizes protected tour routes without reacting to unrelated screens', () => {
    expect(tourScope('/')).toBe('home')
    expect(tourScope('/proyectos/project-id')).toBe('editor')
    expect(tourScope('/login')).toBeNull()
    const idle = tourReducer(initialTourState, { type: 'route', scope: 'editor' })
    expect(idle.phase).toBe('idle')
  })
})
