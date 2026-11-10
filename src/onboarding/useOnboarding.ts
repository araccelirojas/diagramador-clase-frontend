import { createContext, useContext } from 'react'

import type { TourStep } from '@/onboarding/tourSteps'

export type OnboardingContextValue = {
  step: TourStep | null
  active: boolean
  open: () => void
}
export const OnboardingContext = createContext<OnboardingContextValue | null>(null)

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('La guía requiere OnboardingProvider.')
  return context
}
