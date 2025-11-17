import {
  collection as fsCollection,
  doc as fsDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { HeatmapEvent } from './types'

const SESSION_STORAGE_KEY = 'hw-heatmap-session-id'
const FLUSH_INTERVAL_MS = 60_000 // 1 minute for dev; can be increased later

let sessionIdCache: string | null = null
let pendingEvents: HeatmapEvent[] = []
let flushTimerId: number | undefined
let initialized = false

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `sess_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export function getSessionId(): string {
  if (sessionIdCache) return sessionIdCache
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) {
      sessionIdCache = existing
      return existing
    }
  } catch {
    // ignore localStorage errors and fall back to in-memory
  }
  const next = generateSessionId()
  sessionIdCache = next
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, next)
  } catch {
    // ignore
  }
  return next
}

export type EnqueueHeatmapEventInput = Omit<HeatmapEvent, 'sessionId' | 'timestamp'>

/** Enqueue a heatmap event into the buffer (will flush periodically or on lifecycle events). */
export function enqueueHeatmapEvent(input: EnqueueHeatmapEventInput): void {
  const full: HeatmapEvent = {
    ...input,
    sessionId: getSessionId(),
    timestamp: Date.now(),
  }
  pendingEvents.push(full)
}

async function flushInternal(): Promise<void> {
  if (pendingEvents.length === 0) return

  const toFlush = pendingEvents
  pendingEvents = []

  try {
    const batch = writeBatch(db)
    const sessionId = getSessionId()

    const sessionsCol = fsCollection(db, 'sessions')
    const sessionRef = fsDoc(sessionsCol, sessionId)

    const now = serverTimestamp()

    // Upsert session document with updatedAt so we can sort/migrate by latest activity.
    batch.set(
      sessionRef,
      {
        sessionId,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true },
    )

    // Segment events into a chunk document under this session.
    // Path: sessions/{sessionId}/eventChunks/{autoId}
    const chunksCol = fsCollection(sessionRef, 'eventChunks')

    // Build per-module, per-lesson (widget) counts for this chunk.
    const moduleLessonCounts: Record<string, Record<string, number>> = {}
    for (const ev of toFlush) {
      const moduleKey = ev.moduleType
      const lessonKey = ev.widgetId ?? 'page'
      if (!moduleLessonCounts[moduleKey]) {
        moduleLessonCounts[moduleKey] = {}
      }
      moduleLessonCounts[moduleKey][lessonKey] =
        (moduleLessonCounts[moduleKey][lessonKey] ?? 0) + 1
    }

    const chunkRef = fsDoc(chunksCol)
    batch.set(chunkRef, {
      sessionId,
      createdAt: now,
      updatedAt: now,
      eventCount: toFlush.length,
      moduleLessonCounts,
      events: toFlush,
    })

    await batch.commit()
    // eslint-disable-next-line no-console
    console.log(`[heatmap] Flushed ${toFlush.length} event(s) for session ${sessionId}`)
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[heatmap] Failed to flush events; re-queuing', err)
    pendingEvents.push(...toFlush)
  }
}

/** Force a flush of any buffered events (primarily for debugging or lifecycle hooks). */
export async function flushHeatmapEventsNow(): Promise<void> {
  await flushInternal()
}

function ensureInitialized(): void {
  if (initialized) return
  initialized = true

  // Start periodic flush timer in the browser.
  if (typeof window !== 'undefined') {
    flushTimerId = window.setInterval(() => {
      void flushInternal()
    }, FLUSH_INTERVAL_MS)

    window.addEventListener('beforeunload', () => {
      void flushInternal()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void flushInternal()
      }
    })
  }
}

// Initialize immediately when this module is first imported.
ensureInitialized()

