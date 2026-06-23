import { create } from 'zustand'
import type { LayoutDensity } from '../types/settings'

type SettingsState = {
  layoutDensity: LayoutDensity
  setLayoutDensity: (layoutDensity: LayoutDensity) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  layoutDensity: 'comfortable',
  setLayoutDensity: (layoutDensity) => set({ layoutDensity }),
}))
