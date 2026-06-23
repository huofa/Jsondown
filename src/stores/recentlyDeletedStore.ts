import { create } from 'zustand'
import {
  isTauriRuntime,
  listRecentlyDeleted,
  permanentlyDeleteTrashItem,
  restoreDeletedFile as restoreRealDeletedFile,
} from '../services/tauriFileService'
import type { DeletedFile } from '../types/deletedFile'

const initialDeleted: DeletedFile[] = [
  {
    id: 'deleted-draft',
    name: '旧草稿.md',
    originalPath: '/Users/demo/Documents/Jsondown Notes/旧草稿.md',
    originalRootFolderId: 'root-notes',
    deletedAt: '2026-06-22T09:15:00.000Z',
    extension: 'md',
    kind: 'file',
    editable: true,
    content: '# 旧草稿\n\n这是最近删除功能的阶段 A Mock 文件。',
    node: {
      id: 'deleted-draft',
      name: '旧草稿.md',
      path: '/Users/demo/Documents/Jsondown Notes/旧草稿.md',
      kind: 'file',
      extension: 'md',
    },
  },
]

type RecentlyDeletedState = {
  recentlyDeletedFiles: DeletedFile[]
  loadRecentlyDeleted: (rootPaths: string[]) => Promise<void>
  moveToRecentlyDeleted: (file: DeletedFile) => void
  restoreDeletedFile: (fileId: string, rootPath?: string) => Promise<DeletedFile | null>
  permanentlyDeleteFile: (fileId: string, rootPath?: string) => Promise<void>
}

export const useRecentlyDeletedStore = create<RecentlyDeletedState>((set, get) => ({
  recentlyDeletedFiles: isTauriRuntime() ? [] : initialDeleted,
  loadRecentlyDeleted: async (rootPaths) => {
    if (!isTauriRuntime()) return
    const files = await listRecentlyDeleted(rootPaths)
    set({ recentlyDeletedFiles: files })
  },
  moveToRecentlyDeleted: (file) =>
    set((state) => ({ recentlyDeletedFiles: [file, ...state.recentlyDeletedFiles] })),
  restoreDeletedFile: async (fileId, rootPath) => {
    if (isTauriRuntime()) {
      if (!rootPath) return null
      const restored = await restoreRealDeletedFile(fileId, rootPath)
      set((state) => ({
        recentlyDeletedFiles: state.recentlyDeletedFiles.filter((item) => item.id !== fileId),
      }))
      return restored
    }

    const file = get().recentlyDeletedFiles.find((item) => item.id === fileId) ?? null
    if (file) {
      set((state) => ({
        recentlyDeletedFiles: state.recentlyDeletedFiles.filter((item) => item.id !== fileId),
      }))
    }
    return file
  },
  permanentlyDeleteFile: async (fileId, rootPath) => {
    if (isTauriRuntime() && rootPath) {
      await permanentlyDeleteTrashItem(fileId, rootPath)
    }
    set((state) => ({
      recentlyDeletedFiles: state.recentlyDeletedFiles.filter((item) => item.id !== fileId),
    }))
  },
}))

