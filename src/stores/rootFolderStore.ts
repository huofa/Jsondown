import { create } from 'zustand'
import type { RootFolder } from '../types/rootFolder'
import { createMockFolder, mockFileContents, mockRootFolders } from '../utils/mockFileSystem'

type RootFolderState = {
  folders: RootFolder[]
  activeFolderId: string | null
  addMockFolder: (name?: string) => void
  importMockFile: (folderId: string) => string | null
  createMockDocument: (folderId?: string | null) => string | null
  removeFolder: (id: string) => void
  renameFolder: (id: string, name: string) => void
  renameFile: (id: string, name: string) => void
  selectFolder: (id: string) => void
  reorderFolders: (sourceId: string, targetId: string) => void
}

export const useRootFolderStore = create<RootFolderState>((set) => ({
  folders: mockRootFolders,
  activeFolderId: mockRootFolders[0]?.id ?? null,
  addMockFolder: (name) =>
    set((state) => {
      const folder = createMockFolder(state.folders.length + 1, name?.trim() || undefined)
      const note = folder.tree?.[0]
      if (note) mockFileContents[note.id] = '# 未命名笔记\n\n从这里开始写。'
      return { folders: [...state.folders, folder], activeFolderId: folder.id }
    }),
  importMockFile: (folderId) => {
    let createdId: string | null = null
    set((state) => ({
      folders: state.folders.map((folder) => {
        if (folder.id !== folderId) return folder
        createdId = `file-import-${Date.now()}`
        const name = '导入的笔记.md'
        mockFileContents[createdId] = '# 导入的笔记\n\n这是阶段 A 模拟导入的本地文件。'
        return {
          ...folder,
          tree: [...(folder.tree ?? []), {
            id: createdId,
            name,
            path: `${folder.path}/${name}`,
            kind: 'file' as const,
            extension: 'md',
          }],
        }
      }),
    }))
    return createdId
  },
  createMockDocument: (folderId) => {
    let createdId: string | null = null
    set((state) => {
      const targetId = folderId && folderId !== 'all' ? folderId : state.folders[0]?.id
      return {
        folders: state.folders.map((folder) => {
          if (folder.id !== targetId) return folder
          createdId = `file-note-${Date.now()}`
          const name = '新建笔记.md'
          mockFileContents[createdId] = '# 新建笔记\n\n'
          return {
            ...folder,
            tree: [{
              id: createdId,
              name,
              path: `${folder.path}/${name}`,
              kind: 'file' as const,
              extension: 'md',
            }, ...(folder.tree ?? [])],
          }
        }),
      }
    })
    return createdId
  },
  removeFolder: (id) =>
    set((state) => {
      const folders = state.folders.filter((folder) => folder.id !== id)
      return {
        folders,
        activeFolderId:
          state.activeFolderId === id ? (folders[0]?.id ?? null) : state.activeFolderId,
      }
    }),
  renameFolder: (id, name) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === id ? { ...folder, name: name.trim() || folder.name } : folder),
    })),
  renameFile: (id, name) =>
    set((state) => {
      const renameNodes = (nodes: NonNullable<RootFolder['tree']>): NonNullable<RootFolder['tree']> =>
        nodes.map((node) => {
          if (node.id === id) {
            const parent = node.path.slice(0, node.path.lastIndexOf('/'))
            return { ...node, name, path: `${parent}/${name}` }
          }
          return node.children ? { ...node, children: renameNodes(node.children) } : node
        })
      return {
        folders: state.folders.map((folder) => ({
          ...folder,
          tree: renameNodes(folder.tree ?? []),
        })),
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
