import { create } from 'zustand'

type FileTreeState = {
  expandedIds: Set<string>
  toggleExpanded: (id: string) => void
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  expandedIds: new Set(['dir-inbox', 'dir-projects', 'dir-jsondown', 'dir-assets', 'dir-weekly']),
  toggleExpanded: (id) =>
    set((state) => {
      const expandedIds = new Set(state.expandedIds)
      expandedIds.has(id) ? expandedIds.delete(id) : expandedIds.add(id)
      return { expandedIds }
    }),
}))
