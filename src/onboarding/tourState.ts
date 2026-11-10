import { FIRST_EDITOR_STEP, LAST_HOME_STEP, tourSteps, type TourScope } from '@/onboarding/tourSteps'

export type TourState = {
  phase: 'idle' | 'welcome' | 'tour' | 'waiting' | 'finished'
  index: number
  checked: boolean
  direction: 1 | -1
}
export const initialTourState: TourState = { phase: 'idle', index: 0, checked: false, direction: 1 }
export type TourAction =
  | { type: 'profile'; completed: boolean }
  | { type: 'open' }
  | { type: 'start'; scope: TourScope }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'missing' }
  | { type: 'route'; scope: TourScope | null }
  | { type: 'completed'; showFinish: boolean }
  | { type: 'close' }

export function needsOnboarding(user: { onboardingCompletado?: boolean } | null): boolean {
  return user !== null && user.onboardingCompletado === false
}

function forward(state: TourState): TourState {
  if (state.index === LAST_HOME_STEP) return { ...state, phase: 'waiting', direction: 1 }
  // A missing final target leads to a closing card, never a persistence write.
  if (state.index >= tourSteps.length - 1) return { ...state, phase: 'finished', direction: 1 }
  return { ...state, phase: 'tour', index: state.index + 1, direction: 1 }
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'profile':
      if (state.checked) return state
      return { ...state, checked: true, phase: state.phase === 'idle' && !action.completed ? 'welcome' : state.phase }
    case 'open':
      return { ...state, phase: 'welcome', index: 0, direction: 1 }
    case 'start':
      return { ...state, phase: 'tour', index: action.scope === 'editor' ? FIRST_EDITOR_STEP : 1, direction: 1 }
    case 'next':
      return forward(state)
    case 'previous':
      if (state.phase === 'waiting') return { ...state, phase: 'tour', index: LAST_HOME_STEP, direction: -1 }
      return { ...state, phase: state.index <= 1 ? 'welcome' : 'tour', index: Math.max(0, state.index - 1), direction: -1 }
    case 'missing':
      return state.direction === -1 ? tourReducer(state, { type: 'previous' }) : forward(state)
    case 'route':
      if (state.phase !== 'tour' && state.phase !== 'waiting') return state
      if (action.scope === 'editor' && state.index < FIRST_EDITOR_STEP) {
        return { ...state, phase: 'tour', index: FIRST_EDITOR_STEP, direction: 1 }
      }
      if (action.scope === 'home' && state.index >= FIRST_EDITOR_STEP) {
        return { ...state, phase: 'waiting', index: LAST_HOME_STEP }
      }
      return state
    case 'completed':
      return { ...state, phase: action.showFinish ? 'finished' : 'idle', checked: true }
    case 'close':
      return { ...state, phase: 'idle' }
  }
}
