import { create } from 'zustand'

type FileTreeState = {
  expandedIds: Set<string>
  expandedRootIds: Set<string>
  toggleExpanded: (id: string) => void
  toggleRootExpanded: (id: string) => void
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  expandedIds: new Set(['dir-inbox', 'dir-projects', 'dir-jsondown', 'dir-assets', 'dir-weekly']),
  expandedRootIds: new Set(['root-notes', 'root-work']),
  toggleExpanded: (id) =>
    set((state) => {
      const expandedIds = new Set(state.expandedIds)
      expandedIds.has(id) ? expandedIds.delete(id) : expandedIds.add(id)
      return { expandedIds }
    }),
  toggleRootExpanded: (id) =>
    set((state) => {
      const expandedRootIds = new Set(state.expandedRootIds)
      expandedRootIds.has(id) ? expandedRootIds.delete(id) : expandedRootIds.add(id)
      return { expandedRootIds }
    }),
}))
