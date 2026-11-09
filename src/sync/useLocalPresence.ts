import { useEffect } from 'react'

import { onStoreChange, useDiagramStore } from '@/state/useDiagramStore'
import { deriveStatus, type LocalActivity } from '@/sync/presence'
import { sendEphemeral, usePresenceStore } from '@/sync/usePresenceStore'

/**
 * Tells the room what THIS client has selected and what it is doing (CU-01).
 * The cursor is not here: it is a canvas thing and lives in `UmlCanvas`.
 *
 * Everything is sent on change only. A status is re-derived once a second
 * (that is how "editando" fades back to "conectado" and how "inactivo"
 * arrives), but it only reaches the wire when it is different.
 */

/** How often the status is re-derived when nothing else triggers it. */
const TICK_MS = 1000

/**
 * A text field that edits the diagram. Opt out with `data-presence-ignore`
 * (the chat input does: typing there is "escribiendo", not "editando").
 */
function isEditingField(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false
  if (element.closest('[data-presence-ignore]')) return false

  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element.isContentEditable
  )
}

export function useLocalPresence(): void {
  // Selection: straight from the diagram store, on change.
  useEffect(() => {
    return useDiagramStore.subscribe((state, previous) => {
      if (state.selection === previous.selection) return

      sendEphemeral({
        tipo: 'seleccion',
        nodos: state.selection.nodes,
        aristas: state.selection.edges,
      })
    })
  }, [])

  // Status.
  useEffect(() => {
    const activity: LocalActivity = {
      recording: usePresenceStore.getState().recording,
      typing: usePresenceStore.getState().typing,
      editingField: isEditingField(document.activeElement),
      lastEditAt: null,
      lastInputAt: Date.now(),
      hidden: document.visibilityState === 'hidden',
    }

    const update = (): void => {
      const status = deriveStatus(activity, Date.now())
      const presence = usePresenceStore.getState()
      if (status === presence.selfStatus) return

      presence.setSelfStatus(status)
      sendEphemeral({ tipo: 'estado', estado: status })
    }

    const unsubscribeStore = onStoreChange((change) => {
      // Pan and zoom go through a command too, but nobody calls that editing.
      if (change.kind === 'command' && change.options.history === false) return

      activity.lastEditAt = Date.now()
      update()
    })

    const unsubscribePresence = usePresenceStore.subscribe((state, previous) => {
      if (state.recording === previous.recording && state.typing === previous.typing) return

      activity.recording = state.recording
      activity.typing = state.typing
      update()
    })

    const onInput = (): void => {
      const wasIdle = usePresenceStore.getState().selfStatus === 'inactivo'
      activity.lastInputAt = Date.now()
      // Coming back from idle should show at once, not on the next tick.
      if (wasIdle) update()
    }

    const onFocusChange = (): void => {
      activity.editingField = isEditingField(document.activeElement)
      update()
    }

    const onVisibility = (): void => {
      activity.hidden = document.visibilityState === 'hidden'
      if (!activity.hidden) activity.lastInputAt = Date.now()
      update()
    }

    window.addEventListener('pointermove', onInput, { passive: true })
    window.addEventListener('keydown', onInput)
    // focusout fires before focus lands elsewhere; reading activeElement then
    // sees <body>. A microtask later it sees where focus actually went.
    const onFocusOut = (): void => queueMicrotask(onFocusChange)
    document.addEventListener('focusin', onFocusChange)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('visibilitychange', onVisibility)

    const tick = setInterval(update, TICK_MS)
    update()

    return () => {
      clearInterval(tick)
      unsubscribeStore()
      unsubscribePresence()
      window.removeEventListener('pointermove', onInput)
      window.removeEventListener('keydown', onInput)
      document.removeEventListener('focusin', onFocusChange)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('visibilitychange', onVisibility)
      usePresenceStore.getState().setSelfStatus('conectado')
    }
  }, [])
}
