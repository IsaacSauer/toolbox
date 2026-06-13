import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getUtilities } from '../utilities/registry'

export function Home() {
  const { user } = useAuth()
  const utilities = getUtilities().filter((u) => user || u.availableWithoutAccount)

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome to your <span className="text-gradient">Toolbox</span>
      </h1>
      <p className="mt-2 max-w-xl text-slate-400">
        {user ? (
          'Pick a utility below. Your settings are saved to your account automatically.'
        ) : (
          <>
            Pick a utility below.{' '}
            <Link to="/login" className="text-indigo-300 transition-colors hover:text-indigo-200">
              Sign in
            </Link>{' '}
            to save your settings and creations.
          </>
        )}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {utilities.map((u, i) => (
          <Link
            key={u.id}
            to={`/tools/${u.id}`}
            style={{ animationDelay: `${i * 60}ms` }}
            className="glass card-spotlight group relative animate-fade-up overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-xl hover:shadow-indigo-500/10"
          >
            {/* Accent glow that fades in on hover */}
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-indigo-500/20 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

            <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-xl ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
              {u.icon}
            </span>
            <h2 className="mt-3 text-sm font-semibold tracking-tight text-white">{u.name}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{u.description}</p>

            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-300 opacity-0 transition-all duration-300 group-hover:opacity-100">
              Open tool
              <svg className="size-3 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10m0 0L9 4m4 4l-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
