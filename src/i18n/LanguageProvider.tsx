import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  detectLang,
  LANG_STORAGE_KEY,
  LanguageContext,
  LOCALES,
  type Lang,
} from './LanguageContext'

/** Provides the active language + setter to the tree. See ./LanguageContext. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l)
    } catch {
      /* persistence is best-effort */
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => ({ lang, locale: LOCALES[lang], setLang }), [lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
