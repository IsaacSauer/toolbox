import { useLang, type Lang } from '../i18n/LanguageContext'

const LANGS: { code: Lang; label: string }[] = [
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
]

/** Compact NL/EN segmented toggle for the active site language. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div className={`inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 ${className ?? ''}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
            lang === l.code ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
