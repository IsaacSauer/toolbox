/**
 * Pure canvas drawing for the video editor. Given the project canvas, the
 * current video frame source, and the overlays that are visible right now, it
 * paints one frame. The live preview and the exporter both call drawFrame() so
 * the recorded MP4 matches the preview pixel-for-pixel.
 */
import type { FitMode, Overlay, TextOverlay } from './types'

const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/**
 * Draw a source (video frame / image) into a box.
 *  • contain — letterbox so the whole source is visible.
 *  • cover   — fill the box and crop the overflow (clipped to the box).
 */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  mode: FitMode
) {
  if (!sw || !sh) return
  const scale = mode === 'cover' ? Math.max(bw / sw, bh / sh) : Math.min(bw / sw, bh / sh)
  const dw = sw * scale
  const dh = sh * scale
  const dx = bx + (bw - dw) / 2
  const dy = by + (bh - dh) / 2
  if (mode === 'cover') {
    ctx.save()
    ctx.beginPath()
    ctx.rect(bx, by, bw, bh)
    ctx.clip()
    ctx.drawImage(source, dx, dy, dw, dh)
    ctx.restore()
  } else {
    ctx.drawImage(source, dx, dy, dw, dh)
  }
}

/** Greedy word-wrap inside a pixel width; also hard-breaks over-long words. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function drawTextOverlay(
  ctx: CanvasRenderingContext2D,
  o: TextOverlay,
  cw: number,
  ch: number
) {
  const bx = o.x * cw
  const by = o.y * ch
  const bw = o.w * cw
  const bh = o.h * ch
  const fontSize = Math.max(8, o.fontScale * ch)
  ctx.font = `${o.bold ? '700' : '400'} ${fontSize}px ${FONT}`
  ctx.textBaseline = 'top'

  const pad = fontSize * 0.3
  const lines = wrapText(ctx, o.text, bw - pad * 2)
  const lineH = fontSize * 1.2
  const blockH = lines.length * lineH

  if (o.bg) {
    ctx.fillStyle = o.bg
    ctx.fillRect(bx, by, bw, Math.min(bh, blockH + pad * 2))
  }

  ctx.fillStyle = o.color
  ctx.textAlign = o.align
  const tx = o.align === 'left' ? bx + pad : o.align === 'right' ? bx + bw - pad : bx + bw / 2
  let ty = by + pad
  for (const line of lines) {
    ctx.fillText(line, tx, ty)
    ty += lineH
  }
}

export interface ActiveOverlay {
  overlay: Overlay
  /** For image overlays: the decoded element to draw. */
  image?: HTMLImageElement | null
}

/**
 * Paint one full frame. `videoSource` is the current decoded video frame (or
 * null for a gap / empty timeline). Overlays are drawn back-to-front in the
 * order given.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  videoSource: CanvasImageSource | null,
  sw: number,
  sh: number,
  overlays: ActiveOverlay[],
  fit: FitMode = 'contain'
) {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, cw, ch)

  if (videoSource) drawFitted(ctx, videoSource, sw, sh, 0, 0, cw, ch, fit)

  for (const { overlay: o, image } of overlays) {
    if (o.type === 'color') {
      ctx.globalAlpha = o.opacity
      ctx.fillStyle = o.color
      ctx.fillRect(o.x * cw, o.y * ch, o.w * cw, o.h * ch)
      ctx.globalAlpha = 1
    } else if (o.type === 'image') {
      if (image && image.complete && image.naturalWidth) {
        drawFitted(
          ctx,
          image,
          image.naturalWidth,
          image.naturalHeight,
          o.x * cw,
          o.y * ch,
          o.w * cw,
          o.h * ch,
          'contain'
        )
      }
    } else {
      drawTextOverlay(ctx, o, cw, ch)
    }
  }
}
