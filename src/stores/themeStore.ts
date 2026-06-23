import { create } from 'zustand'
import type { EditorTheme } from '../types/editor'

type ThemeState = {
  theme: EditorTheme
  setTheme: (theme: EditorTheme) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'paper-white',
  setTheme: (theme) => set({ theme }),
}))
