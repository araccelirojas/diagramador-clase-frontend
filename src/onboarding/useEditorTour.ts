import { useEffect, type Dispatch, type SetStateAction } from 'react'

import { useOnboarding } from '@/onboarding/useOnboarding'

type EditorTab = 'propiedades' | 'chat' | 'versiones'

/** Prepare view-only controls; never dispatch diagram commands or start services. */
export function useEditorTour(
  setLeftCollapsed: Dispatch<SetStateAction<boolean>>,
  setRightCollapsed: Dispatch<SetStateAction<boolean>>,
  setTab: Dispatch<SetStateAction<EditorTab>>,
) {
  const target = useOnboarding().step?.target
  useEffect(() => {
    if (target === 'paleta' || target === 'clase' || target === 'relaciones') setLeftCollapsed(false)
    if (target === 'propiedades' || target === 'chat' || target === 'versiones' || target === 'agente') {
      setRightCollapsed(false)
      setTab(target === 'agente' ? 'propiedades' : target)
    }
  }, [target, setLeftCollapsed, setRightCollapsed, setTab])
}
