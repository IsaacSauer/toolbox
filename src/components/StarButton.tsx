import { Star } from 'lucide-react'

/**
 * Star toggle used on sidebar nav rows and home cards. Both of those live
 * inside a router `<Link>`/`<NavLink>`, so the click is stopped from bubbling
 * and from triggering navigation.
 */
export function StarButton({
  active,
  onClick,
  title,
  className = '',
}: {
  active: boolean
  onClick: () => void
  title: string
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      aria-label={title}
      aria-pressed={active}
      title={title}
      className={`grid size-7 place-items-center rounded-lg transition-colors ${
        active ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-amber-300'
      } ${className}`}
    >
      <Star className={`size-4 ${active ? 'fill-amber-400' : ''}`} />
    </button>
  )
}
