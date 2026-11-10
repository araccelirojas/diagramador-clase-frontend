import { describe, expect, it } from 'vitest'

import { placeTooltip } from '@/onboarding/tourGeometry'

describe('tour card placement', () => {
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 640 }]) {
    it(`stays inside ${viewport.width}×${viewport.height} at edges and over large targets`, () => {
      const card = { width: 320, height: 240 }
      const targets = [
        { left: 5, top: 5, width: 100, height: 30 },
        { left: viewport.width - 110, top: viewport.height - 40, width: 100, height: 30 },
        { left: 5, top: 48, width: viewport.width - 10, height: viewport.height - 53 },
      ]
      for (const target of targets) {
        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
          const placed = placeTooltip(target, card, viewport, side)
          expect(placed.left).toBeGreaterThanOrEqual(12)
          expect(placed.top).toBeGreaterThanOrEqual(12)
          expect(placed.left + card.width).toBeLessThanOrEqual(viewport.width - 12)
          expect(placed.top + card.height).toBeLessThanOrEqual(viewport.height - 12)
          expect(placed.arrow).toBeGreaterThanOrEqual(18)
        }
      }
    })
  }

  it('flips the card above a target near the bottom', () => {
    expect(placeTooltip({ left: 500, top: 700, width: 100, height: 30 }, { width: 320, height: 240 }, { width: 1366, height: 768 }).side).toBe('top')
  })
})
