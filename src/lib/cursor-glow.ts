// Delegated listeners that feed the hovered element's cursor position into
// the --x/--y custom properties consumed by the spotlight CSS in index.css.
// Glow visibility (--glow) is driven from pointer events instead of CSS
// :hover, which some browsers (Safari) leave stale on a previously hovered
// element — that made the glow stick to buttons the cursor already left.
// Fades are asymmetric: easing in looks intentional, but on the way out the
// effect cuts off instantly so no trail lingers on the previous button.
// .no-glow buttons are skipped so a .spotlight ancestor (e.g. a list row
// containing a bare text button) receives the glow instead.
const SELECTOR = 'button:not(.no-glow), .spotlight, .card-spotlight'

function resolve(target: EventTarget | null): HTMLElement | null {
  const el = target instanceof Element ? target.closest(SELECTOR) : null
  return el instanceof HTMLElement ? el : null
}

// The element currently glowing. Tracked so a new pointerover can force-clear
// the previous one even if its pointerout was missed (scroll under a static
// cursor, DOM swaps) — two elements can never glow at once.
let lit: HTMLElement | null = null

function clear(el: HTMLElement, instant: boolean) {
  el.style.setProperty('--glow', '0')
  if (instant && !el.classList.contains('card-spotlight')) {
    el.style.setProperty('--glow-fade', '0s')
    // Also snap the element's own hover styles (bg/border from Tailwind
    // hover: classes) back instantly instead of fading out.
    el.style.transitionDuration = '0s'
  } else {
    // Cards keep a short fade so the large glow doesn't vanish harshly.
    el.style.setProperty('--glow-fade', '0.2s')
  }
  if (lit === el) lit = null
}

export function initCursorGlow() {
  document.addEventListener('pointermove', (e) => {
    const el = resolve(e.target)
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--y', `${e.clientY - rect.top}px`)
  })

  document.addEventListener('pointerover', (e) => {
    const el = resolve(e.target)
    if (!el || el.matches(':disabled')) return
    if (lit && lit !== el) clear(lit, true)
    lit = el
    el.style.setProperty('--glow', '1')
    el.style.setProperty('--glow-fade', el.classList.contains('card-spotlight') ? '0.4s' : '0.3s')
    el.style.transitionDuration = ''
  })

  document.addEventListener('pointerout', (e) => {
    const el = resolve(e.target)
    // Moving onto a child of the same element also fires pointerout — only
    // clear the glow when the pointer actually left the element.
    if (!el || el === resolve(e.relatedTarget)) return
    clear(el, true)
  })
}
