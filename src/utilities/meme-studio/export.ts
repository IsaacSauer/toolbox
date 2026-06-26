/**
 * Exporters. Everything reuses drawMeme() from render.ts so the output matches
 * the live preview exactly.
 *
 *  • exportStill  — bakes one frame to a PNG blob (images, or a GIF/video frame).
 *  • recordClip   — draws each frame to an offscreen canvas, captures it as a
 *                   MediaStream and records a WebM (or MP4 on Safari) via
 *                   MediaRecorder. Used for video and GIF sources, so the flip
 *                   and captions are burned into the moving picture. Video audio
 *                   is muxed in when the source exposes it.
 *
 * No external libraries: encoding is whatever the browser's MediaRecorder
 * supports, which is why animated output is WebM/MP4 rather than a re-encoded
 * GIF.
 */
import { drawMeme, displayedSize, type Caption, type Transform } from './render'

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke a tick later so the navigation has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportStill(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  transform: Transform,
  captions: Caption[]
): Promise<Blob> {
  const { dw, dh } = displayedSize(sw, sh, transform.rotate)
  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  drawMeme(ctx, source, sw, sh, transform, captions, dw, dh)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      'image/png'
    )
  })
}

export type ClipFormat = 'webm' | 'mp4'

const WEBM_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
const MP4_CANDIDATES = ['video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4']

function firstSupported(candidates: string[]): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null
}

/**
 * Best supported MediaRecorder mime type for the preferred container, falling
 * back to the other container if the browser can't encode the preferred one.
 * Returns null when the browser can't record at all.
 */
export function pickRecorderMime(prefer: ClipFormat = 'webm'): string | null {
  const order =
    prefer === 'mp4' ? [MP4_CANDIDATES, WEBM_CANDIDATES] : [WEBM_CANDIDATES, MP4_CANDIDATES]
  for (const list of order) {
    const m = firstSupported(list)
    if (m) return m
  }
  return null
}

/** Which containers this browser's MediaRecorder can actually produce. */
export function supportedFormats(): Record<ClipFormat, boolean> {
  return {
    webm: firstSupported(WEBM_CANDIDATES) !== null,
    mp4: firstSupported(MP4_CANDIDATES) !== null,
  }
}

export function recorderSupported(): boolean {
  return pickRecorderMime() !== null
}

export interface RecordOptions {
  /** For GIFs (no intrinsic duration) — seconds to capture. Ignored for video. */
  gifDurationSec?: number
  fps?: number
  /** Preferred output container; falls back to the other if unsupported. */
  format?: ClipFormat
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

type VideoWithCapture = HTMLVideoElement & { captureStream?: () => MediaStream }

/**
 * Record a video or animated GIF source with the transform + captions baked in.
 * Returns the encoded blob and the file extension to use.
 */
export async function recordClip(
  kind: 'video' | 'gif',
  source: HTMLVideoElement | HTMLImageElement,
  sw: number,
  sh: number,
  transform: Transform,
  captions: Caption[],
  opts: RecordOptions = {}
): Promise<{ blob: Blob; ext: string }> {
  const mime = pickRecorderMime(opts.format)
  if (!mime) throw new Error('This browser can’t record video (MediaRecorder unavailable).')

  const fps = opts.fps ?? 30
  const { dw, dh } = displayedSize(sw, sh, transform.rotate)
  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const canvasStream = canvas.captureStream(fps)

  // Mux in the original audio track for videos, when available.
  if (kind === 'video') {
    const v = source as VideoWithCapture
    try {
      const vs = v.captureStream?.()
      vs?.getAudioTracks().forEach((track) => canvasStream.addTrack(track))
    } catch {
      /* audio capture is best-effort; carry on with a silent clip */
    }
  }

  const recorder = new MediaRecorder(canvasStream, { mimeType: mime })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  const video = kind === 'video' ? (source as HTMLVideoElement) : null
  const durationSec =
    kind === 'video' && video && isFinite(video.duration) && video.duration > 0
      ? video.duration
      : Math.max(0.5, opts.gifDurationSec ?? 3)

  return new Promise<{ blob: Blob; ext: string }>((resolve, reject) => {
    let rafId = 0
    let startTs = 0
    let finished = false

    const cleanup = () => {
      cancelAnimationFrame(rafId)
      if (video) {
        video.pause()
        video.onended = null
      }
      opts.signal?.removeEventListener('abort', onAbort)
    }

    const finish = () => {
      if (finished) return
      finished = true
      cleanup()
      if (recorder.state !== 'inactive') recorder.stop()
    }

    const onAbort = () => {
      cleanup()
      if (recorder.state !== 'inactive') recorder.stop()
      reject(new DOMException('Recording cancelled', 'AbortError'))
    }
    opts.signal?.addEventListener('abort', onAbort)

    recorder.onstop = () => {
      if (finished === false) return // aborted path already rejected
      const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm'
      resolve({ blob: new Blob(chunks, { type: mime }), ext })
    }
    recorder.onerror = () => {
      cleanup()
      reject(new Error('Recording failed'))
    }

    const drawSource = (): CanvasImageSource => source

    const tick = (ts: number) => {
      if (!startTs) startTs = ts
      const elapsed = (ts - startTs) / 1000
      drawMeme(ctx, drawSource(), sw, sh, transform, captions, dw, dh)
      opts.onProgress?.(Math.min(1, elapsed / durationSec))
      // GIFs have no "ended" event, so stop on elapsed time.
      if (kind === 'gif' && elapsed >= durationSec) {
        finish()
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    recorder.start()

    if (video) {
      video.onended = () => {
        opts.onProgress?.(1)
        finish()
      }
      video.currentTime = 0
      video.muted = false
      video
        .play()
        .then(() => {
          rafId = requestAnimationFrame(tick)
        })
        .catch((err) => {
          cleanup()
          if (recorder.state !== 'inactive') recorder.stop()
          reject(err instanceof Error ? err : new Error('Could not play the video'))
        })
    } else {
      rafId = requestAnimationFrame(tick)
    }
  })
}
