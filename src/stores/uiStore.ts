import { create } from 'zustand'

type UiState = {
  isRootSidebarCollapsed: boolean
  toggleRootSidebarCollapsed: () => void
}

export const useUiStore = create<UiState>((set) => ({
  isRootSidebarCollapsed: false,
  toggleRootSidebarCollapsed: () =>
    set((state) => ({ isRootSidebarCollapsed: !state.isRootSidebarCollapsed })),
}))
