import { create } from 'zustand'
import type { DeletedFile } from '../types/deletedFile'

const initialDeleted: DeletedFile[] = [
  {
    id: 'deleted-draft',
    name: '旧草稿.md',
    originalPath: '/Users/demo/Documents/Jsondown Notes/旧草稿.md',
    originalRootFolderId: 'root-notes',
    deletedAt: '2026-06-22T09:15:00.000Z',
    extension: 'md',
    kind: 'markdown',
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
  moveToRecentlyDeleted: (file: DeletedFile) => void
  restoreDeletedFile: (fileId: string) => DeletedFile | null
  permanentlyDeleteFile: (fileId: string) => void
}

export const useRecentlyDeletedStore = create<RecentlyDeletedState>((set, get) => ({
  recentlyDeletedFiles: initialDeleted,
  moveToRecentlyDeleted: (file) =>
    set((state) => ({ recentlyDeletedFiles: [file, ...state.recentlyDeletedFiles] })),
  restoreDeletedFile: (fileId) => {
    const file = get().recentlyDeletedFiles.find((item) => item.id === fileId) ?? null
    if (file) {
      set((state) => ({
        recentlyDeletedFiles: state.recentlyDeletedFiles.filter((item) => item.id !== fileId),
      }))
    }
    return file
  },
  permanentlyDeleteFile: (fileId) =>
    set((state) => ({
      recentlyDeletedFiles: state.recentlyDeletedFiles.filter((item) => item.id !== fileId),
    })),
}))
