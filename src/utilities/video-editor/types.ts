/**
 * Data model for the video editor.
 *
 * Everything is held in memory: media files become object URLs (no upload),
 * and the timeline is plain serializable-ish state describing how those URLs
 * are arranged in time. The two pure helpers at the bottom turn that state into
 * "what is on screen at time t", and are shared by the live preview and the
 * exporter so both render identically.
 */

/** Default project canvas, used until a clip sets the aspect ratio. Clips are
 *  fitted into this box (cover or contain) and overlay coordinates are stored
 *  normalized to it, so they stay stable whatever the output dimensions are. */
export const DEFAULT_WIDTH = 1280
export const DEFAULT_HEIGHT = 720

/** How a clip fills the project canvas. */
export type FitMode = 'cover' | 'contain'

/**
 * Even-integer canvas dimensions for a given aspect ratio (width / height),
 * with the longer side capped at `base`. Even dimensions keep H.264 happy.
 */
export function dimsForAspect(aspect: number, base = DEFAULT_WIDTH): { width: number; height: number } {
  if (!isFinite(aspect) || aspect <= 0) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }
  let w: number
  let h: number
  if (aspect >= 1) {
    w = base
    h = base / aspect
  } else {
    h = base
    w = base * aspect
  }
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)
  return { width: even(w), height: even(h) }
}

/** A trimmed video segment on the single video track. Clips play back-to-back
 *  in array order — that ordering IS the stitch. */
export interface VideoClip {
  id: string
  name: string
  /** Object URL of the source file (revoked on remove / unmount). */
  url: string
  /** Intrinsic source duration in seconds. */
  duration: number
  width: number
  height: number
  /** Trim window into the source, in seconds (0 ≤ trimStart < trimEnd ≤ duration). */
  trimStart: number
  trimEnd: number
  /** This clip's own audio. */
  muted: boolean
  volume: number
}

/** Length this clip occupies on the timeline after trimming. */
export function clipLength(c: VideoClip): number {
  return Math.max(0, c.trimEnd - c.trimStart)
}

export type OverlayType = 'text' | 'image' | 'color'

interface OverlayBase {
  id: string
  type: OverlayType
  /** Start time on the global timeline (seconds). */
  start: number
  /** How long it stays on screen (seconds). */
  duration: number
  /** Box in normalized canvas space (0..1). */
  x: number
  y: number
  w: number
  h: number
}

export interface TextOverlay extends OverlayBase {
  type: 'text'
  text: string
  color: string
  /** Optional solid background behind the text; null = transparent. */
  bg: string | null
  /** Font size as a fraction of canvas height. */
  fontScale: number
  align: 'left' | 'center' | 'right'
  bold: boolean
}

export interface ImageOverlay extends OverlayBase {
  type: 'image'
  name: string
  url: string
}

export interface ColorOverlay extends OverlayBase {
  type: 'color'
  color: string
  opacity: number
}

export type Overlay = TextOverlay | ImageOverlay | ColorOverlay

/** An extra audio file laid over the timeline (music, voice-over). Separate
 *  from per-clip audio so it can span clip boundaries. */
export interface AudioTrack {
  id: string
  name: string
  url: string
  /** Intrinsic length of the source file (seconds) — the cap for `length`. */
  duration: number
  /** How long the track occupies the timeline (seconds); ≤ duration. */
  length: number
  /** Start time on the global timeline (seconds). */
  start: number
  volume: number
  muted: boolean
}

// ---- Pure timeline math (shared by preview + export) ----------------------

export interface PlacedClip {
  clip: VideoClip
  /** Global start time of the clip on the timeline. */
  offset: number
  length: number
}

/** Resolve each clip's absolute position once; everything else queries this. */
export function layoutClips(clips: VideoClip[]): PlacedClip[] {
  let offset = 0
  return clips.map((clip) => {
    const length = clipLength(clip)
    const placed = { clip, offset, length }
    offset += length
    return placed
  })
}

export function totalDuration(clips: VideoClip[]): number {
  return clips.reduce((sum, c) => sum + clipLength(c), 0)
}

/** Which clip is showing at global time t, and the matching time *inside the
 *  source file* (accounting for the trim). Returns null past the end. */
export function clipAt(
  placed: PlacedClip[],
  t: number
): { placed: PlacedClip; sourceTime: number } | null {
  for (const p of placed) {
    if (t >= p.offset && t < p.offset + p.length) {
      return { placed: p, sourceTime: p.clip.trimStart + (t - p.offset) }
    }
  }
  // Clamp exactly-at-end to the last frame of the last clip.
  const last = placed[placed.length - 1]
  if (last && t >= last.offset + last.length && last.length > 0) {
    return { placed: last, sourceTime: last.clip.trimEnd }
  }
  return null
}

export function overlaysAt(overlays: Overlay[], t: number): Overlay[] {
  return overlays.filter((o) => t >= o.start && t < o.start + o.duration)
}
