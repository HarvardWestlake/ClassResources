import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { enqueueHeatmapEvent } from './tracker'
import { getDeviceType, getClickPosition, getScrollMetrics } from './utils'
import { getModuleTypeForPath } from './moduleMap'

/** Mount once near the root of the app to track page views, clicks, and scrolls. */
export function GlobalHeatmapTracker() {
  const location = useLocation()

  // Track page views on route change
  useEffect(() => {
    const path = location.pathname + location.search + location.hash
    const moduleType = getModuleTypeForPath(location.pathname)
    enqueueHeatmapEvent({
      type: 'page-view',
      path,
      moduleType,
      widgetId: null,
      deviceType: getDeviceType(),
    })
  }, [location])

  // Global click and scroll listeners (page-level for now).
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const path = window.location.pathname + window.location.search + window.location.hash
      const moduleType = getModuleTypeForPath(window.location.pathname)
      const clickPayload = getClickPosition(event)
      enqueueHeatmapEvent({
        type: 'click',
        path,
        moduleType,
        widgetId: null,
        deviceType: getDeviceType(),
        ...clickPayload,
      })
    }

    let lastScrollEventTime = 0
    const SCROLL_THROTTLE_MS = 500

    const handleScroll = () => {
      const now = Date.now()
      if (now - lastScrollEventTime < SCROLL_THROTTLE_MS) return
      lastScrollEventTime = now

      const path = window.location.pathname + window.location.search + window.location.hash
      const moduleType = getModuleTypeForPath(window.location.pathname)
      const scrollPayload = getScrollMetrics()
      enqueueHeatmapEvent({
        type: 'scroll',
        path,
        moduleType,
        widgetId: null,
        deviceType: getDeviceType(),
        ...scrollPayload,
      })
    }

    window.addEventListener('click', handleClick)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return null
}


