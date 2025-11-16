import type {
  ClickEventPayload,
  DeviceType,
  ScrollEventPayload,
} from './types'

/** Derive a coarse device type from the current viewport width. */
export function getDeviceType(width: number = window.innerWidth): DeviceType {
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

/** Compute normalized viewport coordinates for a click event. */
export function getClickPosition(
  event: MouseEvent,
  options?: { widgetRoot?: HTMLElement | null },
): ClickEventPayload {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight

  const xNorm =
    viewportWidth > 0 ? event.clientX / viewportWidth : 0
  const yNorm =
    viewportHeight > 0 ? event.clientY / viewportHeight : 0

  const payload: ClickEventPayload = {
    xNorm: clamp01(xNorm),
    yNorm: clamp01(yNorm),
  }

  const root = options?.widgetRoot
  if (root) {
    const rect = root.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      const xElemNorm = (event.clientX - rect.left) / rect.width
      const yElemNorm = (event.clientY - rect.top) / rect.height
      payload.xElemNorm = clamp01(xElemNorm)
      payload.yElemNorm = clamp01(yElemNorm)
    }
  }

  return payload
}

/** Compute scroll-related metrics for the current document state. */
export function getScrollMetrics(): ScrollEventPayload {
  const scrollY = window.scrollY || window.pageYOffset || 0

  const doc = document.documentElement
  const documentHeight = doc.scrollHeight || doc.clientHeight || 0

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 0

  const scrollNorm =
    documentHeight > 0 ? scrollY / documentHeight : 0

  return {
    scrollY,
    scrollNorm: clamp01(scrollNorm),
    viewportHeight,
    documentHeight,
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}


