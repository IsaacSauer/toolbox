import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'

/**
 * Save indicator shown in a utility's header. Signed in it reflects the
 * debounced config save; signed out it becomes a sign-in nudge, since
 * utilities still work without an account — settings just aren't persisted.
 */
export function SaveStatus({ saving }: { saving: boolean }) {
  const { user } = useAuth()

  if (!user) {
    return (
      <Link
        to="/login"
        className="text-xs text-slate-500 transition-colors hover:text-indigo-300"
      >
        Sign in to save settings →
      </Link>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-500">
      <span
        className={`size-1.5 rounded-full ${saving ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'}`}
      />
      {saving ? 'Saving…' : 'Settings saved'}
    </span>
  )
}
