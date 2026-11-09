/**
 * Leading + trailing throttle: the first call goes out at once, later calls
 * inside the window collapse into ONE that goes out when the window closes,
 * carrying the latest arguments.
 *
 * The trailing call is the point. A pointer that stops moving must report where
 * it stopped, not where it was 40 ms before.
 */
export type Throttled<A extends unknown[]> = {
  (...args: A): void
  /** Drops a pending trailing call. */
  cancel: () => void
}

export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): Throttled<A> {
  let lastAt = -Infinity
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: A | null = null

  const flush = (): void => {
    timer = null
    if (pending === null) return

    const args = pending
    pending = null
    lastAt = Date.now()
    fn(...args)
  }

  const throttled = (...args: A): void => {
    const elapsed = Date.now() - lastAt

    if (elapsed >= waitMs && timer === null) {
      lastAt = Date.now()
      fn(...args)
      return
    }

    pending = args
    timer ??= setTimeout(flush, Math.max(0, waitMs - elapsed))
  }

  throttled.cancel = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pending = null
  }

  return throttled
}
