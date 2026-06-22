import { createContext, useContext } from 'react'

/**
 * Site-wide language. The app ships English (the source strings) and Dutch.
 *
 * The active language defaults to the device locale (a `nl-*` browser language
 * picks Dutch) and is then remembered in localStorage once the user toggles it.
 * Components localize by co-locating their own `{ en, nl }` string objects and
 * reading the active one through `useT(...)` — there is no central dictionary,
 * so each tool stays self-contained.
 *
 * The provider lives in ./LanguageProvider (a component file); this module
 * holds the context, hooks and helpers so importing them doesn't break React
 * Fast Refresh.
 */
export type Lang = 'en' | 'nl'

export const LANG_STORAGE_KEY = 'toolbox:lang'
/** BCP-47 locale per language, used for date/number formatting. */
export const LOCALES: Record<Lang, string> = { en: 'en-US', nl: 'nl-BE' }

export function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY)
    if (saved === 'en' || saved === 'nl') return saved
  } catch {
    /* localStorage unavailable — fall through to navigator */
  }
  const nav =
    typeof navigator !== 'undefined' ? navigator.language || navigator.languages?.[0] || '' : ''
  return nav.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

export interface LanguageContextValue {
  lang: Lang
  /** BCP-47 locale string for `toLocaleDateString` / `Intl` formatting. */
  locale: string
  setLang: (l: Lang) => void
}

export const LanguageContext = createContext<LanguageContextValue | null>(null)

export function useLang(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within a LanguageProvider')
  return ctx
}

/**
 * Pick the translations for the active language from a co-located dictionary:
 *
 *   const t = useT({ en: { title: 'Meals' }, nl: { title: 'Maaltijden' } })
 *   <h1>{t.title}</h1>
 */
export function useT<T>(dict: { en: T; nl: T }): T {
  const { lang } = useLang()
  return dict[lang]
}
