import { create } from 'zustand'
import type { CustomEditorLayout, LayoutDensity } from '../types/settings'

export const defaultCustomEditorLayout: CustomEditorLayout = {
  fontSize: 16,
  lineHeight: 1.82,
  paragraphSpacing: 0.76,
  horizontalPadding: 22,
  maxWidth: 1080,
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
