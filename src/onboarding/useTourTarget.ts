import { useEffect, useState } from 'react'

import { findTourTargets, type TourRect } from '@/onboarding/tourGeometry'

export const TARGET_WAIT_MS = 1800

/** Intersection with scroll containers keeps the spotlight on the visible control. */
function visibleRect(element: HTMLElement): TourRect | null {
  const box = element.getBoundingClientRect()
  if (!box.width || !box.height || getComputedStyle(element).visibility === 'hidden') return null
  let left = Math.max(4, box.left - 5)
  let top = Math.max(4, box.top - 5)
  let right = Math.min(window.innerWidth - 4, box.right + 5)
  let bottom = Math.min(window.innerHeight - 4, box.bottom + 5)
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent)
    const bounds = parent.getBoundingClientRect()
    if (/(hidden|auto|scroll|clip)/.test(css.overflowX)) {
      left = Math.max(left, bounds.left)
      right = Math.min(right, bounds.right)
    }
    if (/(hidden|auto|scroll|clip)/.test(css.overflowY)) {
      top = Math.max(top, bounds.top)
      bottom = Math.min(bottom, bounds.bottom)
    }
  }
  return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null
}

export function useTourTarget(target: string | undefined, onMissing: () => void): TourRect | null {
  const [measurement, setMeasurement] = useState<{ target: string; rect: TourRect; viewport: string } | null>(null)
  useEffect(() => {
    if (!target) return
    let frame = 0
    let scrolled = false
    let visible = false
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule())
    const observed = new Set<HTMLElement>()
    const read = () => {
      const elements = findTourTargets(document, target)
      const first = elements.find((element) => element.getBoundingClientRect().width > 0)
      if (first && !scrolled) {
        scrolled = true
        first.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
      }
      const rects = elements.map((element) => {
        if (!observed.has(element)) { resizeObserver?.observe(element); observed.add(element) }
        return visibleRect(element)
      }).filter((rect): rect is TourRect => rect !== null)
      visible = rects.length > 0
      if (!visible) { setMeasurement(null); return }
      const left = Math.min(...rects.map((r) => r.left))
      const top = Math.min(...rects.map((r) => r.top))
      const rect = { left, top, width: Math.max(...rects.map((r) => r.left + r.width)) - left, height: Math.max(...rects.map((r) => r.top + r.height)) - top }
      const viewport = `${window.innerWidth}:${window.innerHeight}`
      setMeasurement((previous) => previous?.target === target && previous.viewport === viewport && Object.entries(rect).every(([key, value]) => previous.rect[key as keyof TourRect] === value) ? previous : { target, rect, viewport })
    }
    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(read)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('root') ?? document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    const timeout = window.setTimeout(() => { if (!visible) onMissing() }, TARGET_WAIT_MS)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timeout)
      observer.disconnect()
      resizeObserver?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
    }
  }, [target, onMissing])
  return measurement && measurement.target === target ? measurement.rect : null
}
