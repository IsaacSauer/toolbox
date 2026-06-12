import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { getUtilities } from '../utilities/registry'

export function Layout() {
  const { user, signOut } = useAuth()
  const utilities = getUtilities()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-indigo-500/15 text-indigo-200 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-indigo-400/30'
        : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`

  return (
    <div className="ambient flex h-screen overflow-hidden bg-surface text-white">
      <aside className="glass relative z-10 m-3 flex w-64 shrink-0 flex-col rounded-2xl">
        <NavLink to="/" className="group flex items-center gap-3 px-5 py-5">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-xl shadow-lg shadow-indigo-500/30 transition-transform duration-200 group-hover:scale-105">
            🧰
          </span>
          <span className="text-lg font-bold tracking-tight">Toolbox</span>
        </NavLink>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            Utilities
          </p>
          {utilities.map((u) => (
            <NavLink key={u.id} to={`/tools/${u.id}`} className={linkClass}>
              <span className="transition-transform duration-200 group-hover:scale-110">
                {u.icon}
              </span>
              <span className="flex-1">{u.name}</span>
              {!user && !u.availableWithoutAccount && (
                <span className="text-xs opacity-60" title="Requires an account">
                  🔒
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/5 p-4">
          {user ? (
            <>
              <p className="truncate text-xs text-slate-500" title={user.email ?? ''}>
                {user.email}
              </p>
              <button
                onClick={signOut}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500">Sign in to save your settings.</p>
              <Link
                to="/login"
                className="mt-3 block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1.5 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:brightness-110"
              >
                Log in
              </Link>
            </>
          )}
        </div>
      </aside>

      <main className="relative z-10 flex-1 overflow-y-auto p-8 lg:p-10">
        <Outlet />
      </main>
    </div>
  )
}
