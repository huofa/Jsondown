import { create } from 'zustand'
import { loadAppConfig, saveAppConfig } from '../services/tauriFileService'
import type { LastWorkspaceState } from '../types/appConfig'

type WorkspaceStateStore = {
  lastWorkspaceState: LastWorkspaceState | null
  initialized: boolean
  initializeWorkspaceState: () => Promise<void>
  saveLastWorkspaceState: (patch: Partial<LastWorkspaceState>) => Promise<void>
  scheduleSaveLastWorkspaceState: (patch: Partial<LastWorkspaceState>) => void
}

let saveTimer: number | undefined

export const useWorkspaceStateStore = create<WorkspaceStateStore>((set, get) => ({
  lastWorkspaceState: null,
  initialized: false,
  initializeWorkspaceState: async () => {
    const config = await loadAppConfig()
    set({
      lastWorkspaceState: config.lastWorkspaceState ?? null,
      initialized: true,
    })
  },
  saveLastWorkspaceState: async (patch) => {
    const current = get().lastWorkspaceState ?? { updatedAt: new Date().toISOString() }
    const next: LastWorkspaceState = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    set({ lastWorkspaceState: next })
    const config = await loadAppConfig()
    await saveAppConfig({
      ...config,
      lastWorkspaceState: next,
    })
  },
  scheduleSaveLastWorkspaceState: (patch) => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      void get().saveLastWorkspaceState(patch)
    }, 700)
  },
}))
