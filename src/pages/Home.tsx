import { Link } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { useFavorites } from '../favorites/favorites-context'
import { getUtilities } from '../utilities/registry'
import { useLang, useT } from '../i18n/LanguageContext'
import { localizedUtility } from '../i18n/utilities'
import { StarButton } from '../components/StarButton'

const STR = {
  en: {
    welcome: 'Welcome to your',
    pickSaved: 'Pick a utility below. Your settings are saved to your account automatically.',
    pickPrefix: 'Pick a utility below. ',
    signIn: 'Sign in',
    pickSuffix: ' to save your settings and creations.',
    openTool: 'Open tool',
    addFavourite: 'Add to favourites',
    removeFavourite: 'Remove from favourites',
  },
  nl: {
    welcome: 'Welkom in je',
    pickSaved: 'Kies hieronder een hulpmiddel. Je instellingen worden automatisch in je account bewaard.',
    pickPrefix: 'Kies hieronder een hulpmiddel. ',
    signIn: 'Meld je aan',
    pickSuffix: ' om je instellingen en creaties te bewaren.',
    openTool: 'Tool openen',
    addFavourite: 'Toevoegen aan favorieten',
    removeFavourite: 'Verwijderen uit favorieten',
  },
}

export function Home() {
  const { user } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()
  const t = useT(STR)
  const { lang } = useLang()
  const utilities = getUtilities().filter((u) => user || u.availableWithoutAccount)

  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-bold tracking-tight">
        {t.welcome} <span className="text-gradient">Toolbox</span>
      </h1>
      <p className="mt-2 max-w-xl text-slate-400">
        {user ? (
          t.pickSaved
        ) : (
          <>
            {t.pickPrefix}
            <Link to="/login" className="text-indigo-300 transition-colors hover:text-indigo-200">
              {t.signIn}
            </Link>
            {t.pickSuffix}
          </>
        )}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {utilities.map((u, i) => {
          const local = localizedUtility(u.id, lang, u)
          const fav = isFavorite(u.id)
          return (
          <Link
            key={u.id}
            to={`/tools/${u.id}`}
            style={{ animationDelay: `${i * 60}ms` }}
            className="glass card-spotlight group relative animate-fade-up overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400/40 hover:shadow-xl hover:shadow-indigo-500/10"
          >
            {/* Accent glow that fades in on hover */}
            <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-indigo-500/20 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <span className="grid size-10 place-items-center rounded-xl bg-white/5 text-xl ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-110">
                {u.icon}
              </span>
              {user && (
                <StarButton
                  active={fav}
                  onClick={() => toggleFavorite(u.id)}
                  title={fav ? t.removeFavourite : t.addFavourite}
                  className={fav ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}
                />
              )}
            </div>
            <h2 className="mt-3 text-sm font-semibold tracking-tight text-white">{local.name}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{local.description}</p>

            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-300 opacity-0 transition-all duration-300 group-hover:opacity-100">
              {t.openTool}
              <svg className="size-3 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8h10m0 0L9 4m4 4l-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
          )
        })}
      </div>
    </div>
  )
}
