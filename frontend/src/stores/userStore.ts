import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { User } from '../types'

interface UserState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface UserActions {
  setUser: (user: User | null) => void
  setAuthenticated: (isAuthenticated: boolean) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
}

type UserStore = UserState & UserActions

export const useUserStore = create<UserStore>()(
  devtools(
    persist(
      set => ({
        // State
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Actions
        setUser: user =>
          set({
            user,
            isAuthenticated: !!user,
          }),

        setAuthenticated: isAuthenticated => set({ isAuthenticated }),
        setLoading: isLoading => set({ isLoading }),
        setError: error => set({ error }),

        logout: () =>
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          }),
      }),
      {
        name: 'user-store',
        partialize: state => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'user-store',
    }
  )
)
