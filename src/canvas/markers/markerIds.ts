import type { MarkerId } from '@/uml/registry'

/**
 * SVG ids of the arrow heads (CLAUDE.md §7.3). The registry names a marker by
 * its MarkerId; this maps that name onto the element declared in UmlMarkers.
 */
export const MARKERS: Record<MarkerId, string> = {
  arrowOpen: 'uml-arrow-open', // dependencia, asociación dirigida
  triangleHollow: 'uml-triangle-hollow', // generalización, realización
  diamondHollow: 'uml-diamond-hollow', // agregación
  diamondFilled: 'uml-diamond-filled', // composición
  circleFilled: 'uml-circle-filled',
}

export const markerUrl = (marker: MarkerId | null): string | undefined =>
  marker === null ? undefined : `url(#${MARKERS[marker]})`
