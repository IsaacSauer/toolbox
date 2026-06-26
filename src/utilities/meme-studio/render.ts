/**
 * Pure canvas-drawing helpers shared by the live preview and the exporters.
 *
 * Everything works in "displayed space": the pixel box you actually see after
 * the flip/rotate transform is applied. Caption positions are stored normalized
 * (0..1) in that same space, so the live <canvas> preview and the exported file
 * are pixel-for-pixel identical — the preview IS the render pipeline, just run
 * once per frame instead of once at export.
 */

export type Rotate = 0 | 90 | 180 | 270

export interface Transform {
  flipH: boolean
  flipV: boolean
  rotate: Rotate
}

export interface Caption {
  id: string
  text: string
  /** Centre, normalized to displayed width/height (0..1). */
  nx: number
  ny: number
  /** Font size as a fraction of displayed height. */
  size: number
  color: string
  outline: boolean
  uppercase: boolean
}

/** Impact is the canonical meme face; the rest are graceful fallbacks. */
const MEME_FONT = 'Impact, "Anton", "Arial Narrow Bold", "Haettenschweiler", sans-serif'

/** Displayed dimensions after rotation (90/270 swap width and height). */
export function displayedSize(w: number, h: number, rotate: Rotate) {
  return rotate === 90 || rotate === 270 ? { dw: h, dh: w } : { dw: w, dh: h }
}

/** Greedy word-wrap; also hard-breaks single words wider than maxWidth. */
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
        // Hard-break a word that is itself too wide.
        if (!line && ctx.measureText(word).width > maxWidth) {
          let chunk = ''
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk)
              chunk = ch
            } else {
              chunk += ch
            }
          }
          line = chunk
        } else {
          line = candidate
        }
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function captionFontSize(cap: Caption, dh: number): number {
  return Math.max(10, cap.size * dh)
}

function applyCaptionFont(ctx: CanvasRenderingContext2D, cap: Caption, dh: number) {
  ctx.font = `900 ${captionFontSize(cap, dh)}px ${MEME_FONT}`
}

export interface CaptionBox {
  x: number
  y: number
  w: number
  h: number
}

/** Pixel bounding box of a caption in displayed space — used for drag hit-tests. */
export function captionBounds(
  ctx: CanvasRenderingContext2D,
  cap: Caption,
  dw: number,
  dh: number
): CaptionBox {
  applyCaptionFont(ctx, cap, dh)
  const text = (cap.uppercase ? cap.text.toUpperCase() : cap.text) || ' '
  const lines = wrapText(ctx, text, dw * 0.94)
  let maxW = 0
  for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line || ' ').width)
  const lineH = captionFontSize(cap, dh) * 1.12
  const h = lines.length * lineH
  const cx = cap.nx * dw
  const cy = cap.ny * dh
  return { x: cx - maxW / 2, y: cy - h / 2, w: maxW, h }
}

function drawCaption(ctx: CanvasRenderingContext2D, cap: Caption, dw: number, dh: number) {
  const text = cap.uppercase ? cap.text.toUpperCase() : cap.text
  if (!text.trim()) return
  const fontSize = captionFontSize(cap, dh)
  applyCaptionFont(ctx, cap, dh)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const lines = wrapText(ctx, text, dw * 0.94)
  const lineH = fontSize * 1.12
  const cx = cap.nx * dw
  let cy = cap.ny * dh - ((lines.length - 1) * lineH) / 2

  for (const line of lines) {
    if (cap.outline) {
      ctx.lineWidth = Math.max(2, fontSize / 6)
      ctx.strokeStyle = '#000000'
      ctx.strokeText(line, cx, cy)
    }
    ctx.fillStyle = cap.color
    ctx.fillText(line, cx, cy)
    cy += lineH
  }
}

/**
 * Render one full frame: clear, draw the (flipped/rotated) source filling the
 * displayed box, then stamp every caption on top. `source` can be an
 * HTMLImageElement (image/gif) or HTMLVideoElement (current frame).
 */
export function drawMeme(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sw: number,
  sh: number,
  transform: Transform,
  captions: Caption[],
  dw: number,
  dh: number
) {
  ctx.clearRect(0, 0, dw, dh)
  ctx.save()
  ctx.translate(dw / 2, dh / 2)
  ctx.rotate((transform.rotate * Math.PI) / 180)
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1)
  ctx.drawImage(source, -sw / 2, -sh / 2, sw, sh)
  ctx.restore()

  for (const cap of captions) drawCaption(ctx, cap, dw, dh)
}
