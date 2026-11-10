import type { TourSide } from '@/onboarding/tourSteps'

export type TourRect = { left: number; top: number; width: number; height: number }
export type Viewport = { width: number; height: number }
const GAP = 14
const MARGIN = 12
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)))

/** Pure geometry in CSS pixels: browser zoom and devicePixelRatio need no manual correction. */
export function placeTooltip(target: TourRect, card: { width: number; height: number }, viewport: Viewport, preferred: TourSide = 'bottom') {
  const x = target.left + target.width / 2
  const y = target.top + target.height / 2
  const positions: Record<TourSide, { left: number; top: number }> = {
    bottom: { left: x - card.width / 2, top: target.top + target.height + GAP },
    top: { left: x - card.width / 2, top: target.top - card.height - GAP },
    right: { left: target.left + target.width + GAP, top: y - card.height / 2 },
    left: { left: target.left - card.width - GAP, top: y - card.height / 2 },
  }
  const order = [...new Set([preferred, 'bottom', 'top', 'right', 'left'] as TourSide[])]
  const side = order.find((candidate) => {
    const p = positions[candidate]
    // Cross-axis positions can be clamped without losing the direction of the arrow.
    return candidate === 'top' || candidate === 'bottom'
      ? p.top >= MARGIN && p.top + card.height <= viewport.height - MARGIN
      : p.left >= MARGIN && p.left + card.width <= viewport.width - MARGIN
  }) ?? preferred
  const position = positions[side]
  const left = clamp(position.left, MARGIN, viewport.width - card.width - MARGIN)
  const top = clamp(position.top, MARGIN, viewport.height - card.height - MARGIN)
  const arrow = side === 'top' || side === 'bottom'
    ? clamp(x - left, 18, card.width - 18)
    : clamp(y - top, 18, card.height - 18)
  return { left, top, side, arrow }
}

export function findTourTargets(root: ParentNode, target: string): HTMLElement[] {
  // Names are controlled by tourSteps, never by user input or visible labels.
  return [...root.querySelectorAll<HTMLElement>('[data-tour]')].filter((element) => element.dataset.tour === target)
}
