/**
 * Offline (faster-than-realtime) exporter built on WebCodecs.
 *
 * Instead of playing the timeline back in real time and recording it (see
 * export.ts), this renders each output frame as fast as the machine allows and
 * feeds it straight to a hardware `VideoEncoder`; the audio is mixed in one shot
 * through an `OfflineAudioContext` and run through an `AudioEncoder`. The encoded
 * chunks are muxed into an .mp4 / .webm with mp4-muxer / webm-muxer (tiny, pure
 * TS — no WASM). A 1-minute timeline exports in a few seconds rather than a
 * minute.
 *
 * Frame sourcing: we seek the per-clip <video> elements to each frame's source
 * time and draw with the same drawFrame() the preview and the realtime exporter
 * use, so the output stays pixel-for-pixel identical to the preview.
 *
 * When the browser has no WebCodecs, or no codec it can use for the requested
 * container, exportTimelineFast throws FastExportUnsupportedError so the caller
 * can fall back to the realtime MediaRecorder path.
 */
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer'
import { Muxer as WebMMuxer, ArrayBufferTarget as WebMTarget } from 'webm-muxer'
import { loadImage, loadVideo, type ClipFormat, type ExportOptions } from './export'
import { drawFrame, type ActiveOverlay } from './render'
import {
  clipAt,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  layoutClips,
  overlaysAt,
  totalDuration,
  type AudioTrack,
  type Overlay,
  type VideoClip,
} from './types'

/** Thrown when the fast path can't run; the caller should use the realtime exporter. */
export class FastExportUnsupportedError extends Error {
  constructor(message = 'WebCodecs offline export is not available in this browser') {
    super(message)
    this.name = 'FastExportUnsupportedError'
  }
}

const SAMPLE_RATE = 48_000
const AUDIO_BITRATE = 160_000

/** True when this browser exposes the WebCodecs + OfflineAudioContext we need. */
export function fastExportSupported(): boolean {
  return (
    typeof VideoEncoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof AudioData !== 'undefined' &&
    typeof EncodedVideoChunk !== 'undefined' &&
    (typeof OfflineAudioContext !== 'undefined' ||
      typeof (window as unknown as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext !==
        'undefined')
  )
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2)

function videoBitrate(w: number, h: number, fps: number): number {
  return Math.min(16_000_000, Math.max(1_000_000, Math.round(w * h * fps * 0.12)))
}

interface ResolvedConfig {
  ext: 'mp4' | 'webm'
  mime: string
  video: VideoEncoderConfig
  audio: AudioEncoderConfig
  /** Codec id as the matching muxer expects it. */
  muxerVideoCodec: string
  muxerAudioCodec: string
}

/**
 * Pick a VideoEncoder + AudioEncoder config the browser actually supports for
 * the preferred container, falling back to the other container. Returns null
 * when neither can be configured.
 */
async function resolveConfig(
  prefer: ClipFormat,
  w: number,
  h: number,
  fps: number
): Promise<ResolvedConfig | null> {
  const bitrate = videoBitrate(w, h, fps)

  const tryMp4 = async (): Promise<ResolvedConfig | null> => {
    const audio: AudioEncoderConfig = {
      codec: 'mp4a.40.2',
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: AUDIO_BITRATE,
    }
    if (!(await AudioEncoder.isConfigSupported(audio)).supported) return null
    // High → Main → Baseline, highest level first; isConfigSupported rejects
    // codecs whose level is too low for the requested resolution.
    for (const codec of ['avc1.640034', 'avc1.640028', 'avc1.4d4028', 'avc1.42e01f']) {
      const video: VideoEncoderConfig = {
        codec,
        width: w,
        height: h,
        bitrate,
        framerate: fps,
        avc: { format: 'avc' },
      }
      if ((await VideoEncoder.isConfigSupported(video)).supported) {
        return {
          ext: 'mp4',
          mime: 'video/mp4',
          video,
          audio,
          muxerVideoCodec: 'avc',
          muxerAudioCodec: 'aac',
        }
      }
    }
    return null
  }

  const tryWebm = async (): Promise<ResolvedConfig | null> => {
    const audio: AudioEncoderConfig = {
      codec: 'opus',
      sampleRate: SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: AUDIO_BITRATE,
    }
    if (!(await AudioEncoder.isConfigSupported(audio)).supported) return null
    const candidates: Array<{ codec: string; muxer: string }> = [
      { codec: 'vp09.00.51.08', muxer: 'V_VP9' },
      { codec: 'vp09.00.41.08', muxer: 'V_VP9' },
      { codec: 'vp09.00.31.08', muxer: 'V_VP9' },
      { codec: 'vp09.00.10.08', muxer: 'V_VP9' },
      { codec: 'vp8', muxer: 'V_VP8' },
    ]
    for (const { codec, muxer } of candidates) {
      const video: VideoEncoderConfig = { codec, width: w, height: h, bitrate, framerate: fps }
      if ((await VideoEncoder.isConfigSupported(video)).supported) {
        return {
          ext: 'webm',
          mime: 'video/webm',
          video,
          audio,
          muxerVideoCodec: muxer,
          muxerAudioCodec: 'A_OPUS',
        }
      }
    }
    return null
  }

  const order = prefer === 'webm' ? [tryWebm, tryMp4] : [tryMp4, tryWebm]
  for (const attempt of order) {
    const cfg = await attempt()
    if (cfg) return cfg
  }
  return null
}

/** Seek a media element and resolve once the frame at `time` is ready. */
function seekTo(el: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const target = Math.max(0, time)
    if (el.readyState >= 2 && Math.abs(el.currentTime - target) < 1e-3) {
      resolve()
      return
    }
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeEventListener('seeked', finish)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, 3000) // never hang on a stubborn seek
    el.addEventListener('seeked', finish)
    try {
      el.currentTime = target
    } catch {
      finish()
    }
  })
}

/** Wait until the encoder's queue drains below `target` so memory stays bounded. */
function drainTo(encoder: VideoEncoder, target: number): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (encoder.encodeQueueSize <= target) resolve()
      else setTimeout(check, 0)
    }
    check()
  })
}

/**
 * Mix every clip's own audio and every extra audio track into one stereo buffer
 * via an OfflineAudioContext (renders far faster than real time). Returns null
 * when the timeline has no audible audio, so the caller can mux a silent file.
 */
async function mixAudioOffline(
  clips: VideoClip[],
  audioTracks: AudioTrack[],
  total: number
): Promise<AudioBuffer | null> {
  const frames = Math.ceil(total * SAMPLE_RATE)
  if (frames <= 0) return null

  const OfflineCtor: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext
  const octx = new OfflineCtor(2, frames, SAMPLE_RATE)

  const cache = new Map<string, Promise<AudioBuffer | null>>()
  const decode = (url: string): Promise<AudioBuffer | null> => {
    let p = cache.get(url)
    if (!p) {
      p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((buf) => octx.decodeAudioData(buf))
        .catch(() => null) // no audio track / undecodable → silent
      cache.set(url, p)
    }
    return p
  }

  let any = false
  const schedule = (buffer: AudioBuffer, when: number, offset: number, duration: number, vol: number) => {
    const src = octx.createBufferSource()
    src.buffer = buffer
    const gain = octx.createGain()
    gain.gain.value = vol
    src.connect(gain).connect(octx.destination)
    src.start(Math.max(0, when), Math.max(0, offset), Math.max(0, duration))
    any = true
  }

  for (const p of layoutClips(clips)) {
    const c = p.clip
    if (c.muted || c.volume <= 0 || p.length <= 0) continue
    const buf = await decode(c.url)
    if (buf) schedule(buf, p.offset, c.trimStart, p.length, c.volume)
  }
  for (const tr of audioTracks) {
    if (tr.muted || tr.volume <= 0 || tr.length <= 0) continue
    const buf = await decode(tr.url)
    if (buf) schedule(buf, tr.start, 0, Math.min(tr.length, tr.duration), tr.volume)
  }

  if (!any) return null
  return octx.startRendering()
}

/** Feed a rendered stereo buffer to the AudioEncoder in fixed-size slices. */
function encodeAudio(buffer: AudioBuffer, encoder: AudioEncoder) {
  const frames = buffer.length
  const ch0 = buffer.getChannelData(0)
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0
  const CHUNK = 4096
  for (let i = 0; i < frames; i += CHUNK) {
    const n = Math.min(CHUNK, frames - i)
    // f32-planar: all of channel 0's samples, then all of channel 1's.
    const data = new Float32Array(n * 2)
    data.set(ch0.subarray(i, i + n), 0)
    data.set(ch1.subarray(i, i + n), n)
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: SAMPLE_RATE,
      numberOfFrames: n,
      numberOfChannels: 2,
      timestamp: Math.round((i / SAMPLE_RATE) * 1e6),
      data,
    })
    encoder.encode(audioData)
    audioData.close()
  }
}

type AnyMuxer = {
  addVideoChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void
  addAudioChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void
  finalize: () => void
  target: { buffer: ArrayBuffer }
}

/**
 * Render + encode the whole timeline offline. Same signature/return as
 * exportTimeline; throws FastExportUnsupportedError when the fast path can't run.
 */
export async function exportTimelineFast(
  clips: VideoClip[],
  overlays: Overlay[],
  audioTracks: AudioTrack[],
  opts: ExportOptions = {}
): Promise<{ blob: Blob; ext: string }> {
  const total = totalDuration(clips)
  if (total <= 0) throw new Error('Add at least one video clip before exporting.')
  if (!fastExportSupported()) throw new FastExportUnsupportedError()

  const fps = opts.fps ?? 30
  const outW = even(opts.width ?? DEFAULT_WIDTH)
  const outH = even(opts.height ?? DEFAULT_HEIGHT)
  const fit = opts.fit ?? 'contain'
  const aborted = () => opts.signal?.aborted === true
  const throwIfAborted = () => {
    if (aborted()) throw new DOMException('Export cancelled', 'AbortError')
  }

  const cfg = await resolveConfig(opts.format ?? 'mp4', outW, outH, fps)
  if (!cfg) throw new FastExportUnsupportedError('No usable WebCodecs codec for this output')

  // Hidden pool of media elements used only for this export.
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden'
  document.body.appendChild(container)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    container.remove()
    throw new Error('Canvas 2D context unavailable')
  }

  const videoEls = new Map<string, HTMLVideoElement>()
  const images = new Map<string, HTMLImageElement>()
  let videoEncoder: VideoEncoder | null = null
  let audioEncoder: AudioEncoder | null = null

  const cleanup = () => {
    container.remove()
    try {
      if (videoEncoder && videoEncoder.state !== 'closed') videoEncoder.close()
    } catch {
      /* already closed */
    }
    try {
      if (audioEncoder && audioEncoder.state !== 'closed') audioEncoder.close()
    } catch {
      /* already closed */
    }
  }

  try {
    // Load every source up front so per-frame seeking is fast.
    await Promise.all(
      clips.map(async (c) => {
        videoEls.set(c.id, await loadVideo(c.url, container))
      })
    )
    await Promise.all(
      overlays
        .filter((o): o is Extract<Overlay, { type: 'image' }> => o.type === 'image')
        .map(async (o) => {
          images.set(o.id, await loadImage(o.url))
        })
    )
    throwIfAborted()

    // Mix audio first so we know whether to declare an audio track at all.
    opts.onProgress?.(0.02)
    const wantsAudio =
      clips.some((c) => !c.muted && c.volume > 0) ||
      audioTracks.some((tr) => !tr.muted && tr.volume > 0 && tr.length > 0)
    const audioBuffer = await mixAudioOffline(clips, audioTracks, total)
    // Audio was expected but nothing could be decoded here — rather than ship a
    // silent file, defer to the realtime exporter which captures audio reliably.
    if (wantsAudio && !audioBuffer) throw new FastExportUnsupportedError('Audio could not be decoded offline')
    throwIfAborted()
    opts.onProgress?.(0.12)

    const muxer = (
      cfg.ext === 'mp4'
        ? new Mp4Muxer({
            target: new Mp4Target(),
            fastStart: 'in-memory',
            firstTimestampBehavior: 'offset',
            video: { codec: cfg.muxerVideoCodec as 'avc', width: outW, height: outH, frameRate: fps },
            ...(audioBuffer
              ? { audio: { codec: cfg.muxerAudioCodec as 'aac', numberOfChannels: 2, sampleRate: SAMPLE_RATE } }
              : {}),
          })
        : new WebMMuxer({
            target: new WebMTarget(),
            firstTimestampBehavior: 'offset',
            video: { codec: cfg.muxerVideoCodec, width: outW, height: outH, frameRate: fps },
            ...(audioBuffer
              ? { audio: { codec: cfg.muxerAudioCodec, numberOfChannels: 2, sampleRate: SAMPLE_RATE } }
              : {}),
          })
    ) as unknown as AnyMuxer

    let encodeError: unknown = null
    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        encodeError = e
      },
    })
    videoEncoder.configure(cfg.video)

    if (audioBuffer) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => {
          encodeError = e
        },
      })
      audioEncoder.configure(cfg.audio)
      encodeAudio(audioBuffer, audioEncoder)
    }

    // --- Video frames -------------------------------------------------------
    const placed = layoutClips(clips)
    const totalFrames = Math.max(1, Math.round(total * fps))
    const frameDur = 1e6 / fps
    const keyInterval = Math.max(1, Math.round(fps * 2))
    let lastClipId: string | null = null
    let lastSourceTime = Number.NaN

    for (let i = 0; i < totalFrames; i++) {
      throwIfAborted()
      if (encodeError) throw encodeError

      // Sample slightly inside the timeline so the final frame still lands on
      // the last clip rather than past its end.
      const t = Math.min(total - 1e-4, i / fps)
      const hit = clipAt(placed, t)

      let source: HTMLVideoElement | null = null
      let sw = 0
      let sh = 0
      if (hit) {
        const el = videoEls.get(hit.placed.clip.id)
        if (el) {
          const st = hit.sourceTime
          if (hit.placed.clip.id !== lastClipId || Math.abs(st - lastSourceTime) > 0.5 / fps) {
            await seekTo(el, st)
          }
          lastClipId = hit.placed.clip.id
          lastSourceTime = el.currentTime
          source = el
          sw = el.videoWidth
          sh = el.videoHeight
        }
      }

      const active: ActiveOverlay[] = overlaysAt(overlays, t).map((o) => ({
        overlay: o,
        image: o.type === 'image' ? images.get(o.id) ?? null : null,
      }))
      drawFrame(ctx, outW, outH, source, sw, sh, active, fit)

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i * frameDur),
        duration: Math.round(frameDur),
      })
      videoEncoder.encode(frame, { keyFrame: i % keyInterval === 0 })
      frame.close()

      if (videoEncoder.encodeQueueSize > 8) await drainTo(videoEncoder, 4)
      opts.onProgress?.(0.12 + 0.83 * ((i + 1) / totalFrames))
    }

    throwIfAborted()
    await videoEncoder.flush()
    if (audioEncoder) await audioEncoder.flush()
    if (encodeError) throw encodeError

    muxer.finalize()
    opts.onProgress?.(1)

    const blob = new Blob([muxer.target.buffer], { type: cfg.mime })
    cleanup()
    return { blob, ext: cfg.ext }
  } catch (err) {
    cleanup()
    throw err
  }
}
