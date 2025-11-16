export type ModuleType =
  | 'app'
  | 'history'
  | 'math'
  | 'code'
  | 'econ'
  | 'stats'
  | 'chem'

export type DeviceType = 'desktop' | 'tablet' | 'mobile'

export type HeatmapEventType =
  | 'click'
  | 'scroll'
  | 'page-view'
  | 'visibility-change'

export interface HeatmapEventBase {
  /** Anonymous session id for this browser. */
  sessionId: string
  /** Type of interaction event. */
  type: HeatmapEventType
  /** Milliseconds since epoch (Date.now()). */
  timestamp: number
  /** URL path at time of interaction (e.g. /history/world). */
  path: string
  /** High-level module segmentation (math, code, econ, etc.). */
  moduleType: ModuleType
  /** Optional widget-level segmentation (e.g. cubic-sequences, world-globe). */
  widgetId?: string | null
  /** Optional device category for later segmentation. */
  deviceType?: DeviceType
}

export interface ClickEventPayload {
  /** Normalized click X coordinate in viewport space (0–1). */
  xNorm: number
  /** Normalized click Y coordinate in viewport space (0–1). */
  yNorm: number
  /** Optional X coordinate relative to widget element bounds (0–1). */
  xElemNorm?: number
  /** Optional Y coordinate relative to widget element bounds (0–1). */
  yElemNorm?: number
}

export interface ScrollEventPayload {
  /** Current scroll position in pixels from top of page. */
  scrollY: number
  /** Normalized scroll position relative to document height (0–1). */
  scrollNorm: number
  /** Current viewport height in pixels. */
  viewportHeight: number
  /** Total document height in pixels. */
  documentHeight: number
}

export type HeatmapEvent = HeatmapEventBase &
  Partial<ClickEventPayload> &
  Partial<ScrollEventPayload>


