import { create } from 'zustand'
import type { CustomEditorLayout, LayoutDensity } from '../types/settings'

export const defaultCustomEditorLayout: CustomEditorLayout = {
  fontSize: 14,
  lineHeight: 1.25,
  paragraphSpacing: -10,
  letterSpacing: -0.4,
  horizontalPadding: 4,
}

type SettingsState = {
  layoutDensity: LayoutDensity
  customEditorLayout: CustomEditorLayout
  setLayoutDensity: (layoutDensity: LayoutDensity) => void
  setCustomEditorLayout: (patch: Partial<CustomEditorLayout>) => void
  resetCustomEditorLayout: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  layoutDensity: 'comfortable',
  customEditorLayout: defaultCustomEditorLayout,
  setLayoutDensity: (layoutDensity) => set({ layoutDensity }),
  setCustomEditorLayout: (patch) =>
    set((state) => ({ customEditorLayout: { ...state.customEditorLayout, ...patch } })),
  resetCustomEditorLayout: () => set({ customEditorLayout: defaultCustomEditorLayout }),
}))
