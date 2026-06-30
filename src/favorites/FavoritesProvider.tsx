import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { FavoritesContext } from './favorites-context'

/**
 * Favourites ride on the existing `utility_configs` table under a reserved
 * utility id, so they need no extra table or migration — the same per-user
 * row-level security applies. The config shape is `{ ids: string[] }`.
 */
const FAVORITES_UTILITY_ID = '__favorites__'

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState<string[]>([])

  // Load the user's favourites whenever they sign in. Always set state inside
  // the async callback (so a user with no saved row resets a previous user's
  // list); sign-out is handled by gating the exposed value on `user` below.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    supabase
      .from('utility_configs')
      .select('config')
      .eq('utility_id', FAVORITES_UTILITY_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const ids = (data?.config as { ids?: unknown })?.ids
        setFavorites(
          Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
        )
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const persist = useCallback(
    (ids: string[]) => {
      if (!user) return
      // supabase query builders are lazy thenables — the request is only sent
      // when `.then()`/`await` runs, so this must be chained, not discarded.
      void supabase
        .from('utility_configs')
        .upsert(
          { user_id: user.id, utility_id: FAVORITES_UTILITY_ID, config: { ids } },
          { onConflict: 'user_id,utility_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save favourites:', error.message)
        })
    },
    [user]
  )

  // Toggling is a discrete action (not keystrokes), so persist immediately.
  const toggleFavorite = useCallback(
    (utilityId: string) => {
      setFavorites((prev) => {
        const next = prev.includes(utilityId)
          ? prev.filter((id) => id !== utilityId)
          : [...prev, utilityId]
        persist(next)
        return next
      })
    },
    [persist]
  )

  // Gate on `user` so signing out instantly empties the list without a
  // synchronous state reset in the load effect.
  const visible = useMemo(() => (user ? favorites : []), [user, favorites])
  const isFavorite = useCallback((utilityId: string) => visible.includes(utilityId), [visible])

  return (
    <FavoritesContext.Provider value={{ favorites: visible, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}
