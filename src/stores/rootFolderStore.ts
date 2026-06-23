import { create } from 'zustand'
import type { RootFolder } from '../types/rootFolder'
import { createMockFolder, mockFileContents, mockRootFolders } from '../utils/mockFileSystem'

type RootFolderState = {
  folders: RootFolder[]
  activeFolderId: string | null
  addMockFolder: () => void
  removeFolder: (id: string) => void
  selectFolder: (id: string) => void
  reorderFolders: (sourceId: string, targetId: string) => void
}

export const useRootFolderStore = create<RootFolderState>((set) => ({
  folders: mockRootFolders,
  activeFolderId: mockRootFolders[0]?.id ?? null,
  addMockFolder: () =>
    set((state) => {
      const folder = createMockFolder(state.folders.length + 1)
      const note = folder.tree?.[0]
      if (note) mockFileContents[note.id] = '# 未命名笔记\n\n从这里开始写。'
      return { folders: [...state.folders, folder], activeFolderId: folder.id }
    }),
  removeFolder: (id) =>
    set((state) => {
      const folders = state.folders.filter((folder) => folder.id !== id)
      return {
        folders,
        activeFolderId:
          state.activeFolderId === id ? (folders[0]?.id ?? null) : state.activeFolderId,
      }
    }),
  selectFolder: (id) => set({ activeFolderId: id }),
  reorderFolders: (sourceId, targetId) =>
    set((state) => {
      const folders = [...state.folders].sort((a, b) => a.order - b.order)
      const from = folders.findIndex((folder) => folder.id === sourceId)
      const to = folders.findIndex((folder) => folder.id === targetId)
      if (from < 0 || to < 0 || from === to) return state
      const [moved] = folders.splice(from, 1)
      folders.splice(to, 0, moved)
      return { folders: folders.map((folder, order) => ({ ...folder, order })) }
    }),
}))
