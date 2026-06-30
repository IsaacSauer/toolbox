import { createContext, useContext } from 'react'

/**
 * User-pinned favourite utilities, shared across the whole app so starring a
 * tool in the home grid immediately updates the sidebar (and vice versa).
 *
 * Favourites are per-account and persisted in Supabase (see ./FavoritesProvider).
 * The provider stores the ordered list of utility ids; `favorites` preserves
 * insertion order. Starring requires being signed in — for a guest the list is
 * always empty and `toggleFavorite` is a no-op.
 *
 * This module holds only the context + hook so importing them elsewhere doesn't
 * break React Fast Refresh (the provider lives in the .tsx component file).
 */
export interface FavoritesContextValue {
  /** Favourited utility ids, in the order they were starred. */
  favorites: string[]
  isFavorite: (utilityId: string) => boolean
  toggleFavorite: (utilityId: string) => void
}

export const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined)

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used inside <FavoritesProvider>')
  return ctx
}
