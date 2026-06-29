import { create } from 'zustand'
import { loadAppConfig, saveAppConfig } from '../services/tauriFileService'
import type { CustomEditorLayout, LayoutDensity } from '../types/settings'

export const defaultCustomEditorLayout: CustomEditorLayout = {
  fontSize: 13,
  lineHeight: 0.6,
  paragraphSpacing: -2,
  letterSpacing: -0.2,
  horizontalPadding: 18,
}

type SettingsState = {
  layoutDensity: LayoutDensity
  customEditorLayout: CustomEditorLayout
  setLayoutDensity: (layoutDensity: LayoutDensity) => void
  setCustomEditorLayout: (patch: Partial<CustomEditorLayout>) => void
  initializeSettings: () => Promise<void>
  saveCustomEditorLayoutAsDefault: () => Promise<void>
}

const normalizeCustomEditorLayout = (layout?: Partial<CustomEditorLayout>): CustomEditorLayout => ({
  fontSize: Number.isFinite(layout?.fontSize) ? Number(layout?.fontSize) : defaultCustomEditorLayout.fontSize,
  lineHeight: Number.isFinite(layout?.lineHeight) ? Number(layout?.lineHeight) : defaultCustomEditorLayout.lineHeight,
  paragraphSpacing: Number.isFinite(layout?.paragraphSpacing)
    ? Number(layout?.paragraphSpacing)
    : defaultCustomEditorLayout.paragraphSpacing,
  letterSpacing: Number.isFinite(layout?.letterSpacing) ? Number(layout?.letterSpacing) : defaultCustomEditorLayout.letterSpacing,
  horizontalPadding: Number.isFinite(layout?.horizontalPadding)
    ? Number(layout?.horizontalPadding)
    : defaultCustomEditorLayout.horizontalPadding,
})

export const useSettingsStore = create<SettingsState>((set, get) => ({
  layoutDensity: 'comfortable',
  customEditorLayout: defaultCustomEditorLayout,
  setLayoutDensity: (layoutDensity) => set({ layoutDensity }),
  setCustomEditorLayout: (patch) =>
    set((state) => ({ customEditorLayout: { ...state.customEditorLayout, ...patch } })),
  initializeSettings: async () => {
    const config = await loadAppConfig()
    set({
      layoutDensity: config.layoutDensity ?? 'comfortable',
      customEditorLayout: normalizeCustomEditorLayout(config.customEditorLayout),
    })
  },
  saveCustomEditorLayoutAsDefault: async () => {
    const state = get()
    const config = await loadAppConfig()
    await saveAppConfig({
      ...config,
      layoutDensity: state.layoutDensity,
      customEditorLayout: state.customEditorLayout,
    })
  },
}))
