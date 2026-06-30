import { create } from 'zustand'
import { readTextFile } from '../services/tauriFileService'
import type { EditableFile } from '../types/file'

export const FULL_FILE_CACHE_LIMIT = 10

export type FullFileCacheEntry = {
  path: string
  updatedAt?: string
  sizeBytes?: number
  content: string
  scrollTop: number
  mode: 'readonly' | 'editing'
  lastAccessedAt: number
  error?: string
}

type FullFileCacheStore = {
  entries: Record<string, FullFileCacheEntry>
  getEntry: (file: EditableFile) => FullFileCacheEntry | undefined
  ensureFullFileLoaded: (file: EditableFile) => Promise<string>
  upsertContent: (file: Pick<EditableFile, 'path' | 'updatedAt' | 'size'>, content: string) => void
  updateScrollTop: (file: EditableFile, scrollTop: number) => void
  invalidatePath: (path: string) => void
  clear: () => void
}

const loadingMap = new Map<string, Promise<string>>()

const pruneEntries = (entries: Record<string, FullFileCacheEntry>) => {
  const ordered = Object.entries(entries)
    .sort(([, a], [, b]) => b.lastAccessedAt - a.lastAccessedAt)
    .slice(0, FULL_FILE_CACHE_LIMIT)
  return Object.fromEntries(ordered)
}

const isFreshForFile = (entry: FullFileCacheEntry | undefined, file: EditableFile) => {
  if (!entry) return false
  if (entry.path !== file.path) return false
  if (entry.updatedAt && file.updatedAt && entry.updatedAt !== file.updatedAt) return false
  return true
}

export const useFullFileCacheStore = create<FullFileCacheStore>((set, get) => ({
  entries: {},
  getEntry: (file) => {
    const entry = get().entries[file.path]
    if (!isFreshForFile(entry, file)) return undefined
    if (entry) {
      set((state) => ({
        entries: {
          ...state.entries,
          [file.path]: { ...entry, lastAccessedAt: Date.now() },
        },
      }))
    }
    return entry
  },
  ensureFullFileLoaded: async (file) => {
    const cached = get().getEntry(file)
    if (cached) return cached.content

    const existing = loadingMap.get(file.path)
    if (existing) return existing

    const promise = readTextFile(file.path, file.id)
      .then((content) => {
        get().upsertContent(file, content)
        return content
      })
      .catch((error) => {
        set((state) => ({
          entries: {
            ...state.entries,
            [file.path]: {
              path: file.path,
              updatedAt: file.updatedAt,
              sizeBytes: file.size,
              content: '',
              scrollTop: 0,
              mode: 'readonly',
              lastAccessedAt: Date.now(),
              error: error instanceof Error ? error.message : String(error),
            },
          },
        }))
        throw error
      })
      .finally(() => {
        loadingMap.delete(file.path)
      })

    loadingMap.set(file.path, promise)
    return promise
  },
  upsertContent: (file, content) => {
    set((state) => ({
      entries: pruneEntries({
        ...state.entries,
        [file.path]: {
          path: file.path,
          updatedAt: file.updatedAt,
          sizeBytes: file.size ?? new Blob([content]).size,
          content,
          scrollTop: state.entries[file.path]?.scrollTop ?? 0,
          mode: state.entries[file.path]?.mode ?? 'readonly',
          lastAccessedAt: Date.now(),
        },
      }),
    }))
  },
  updateScrollTop: (file, scrollTop) => {
    set((state) => {
      const entry = state.entries[file.path]
      if (!entry) return state
      return {
        entries: {
          ...state.entries,
          [file.path]: {
            ...entry,
            scrollTop,
            lastAccessedAt: Date.now(),
          },
        },
      }
    })
  },
  invalidatePath: (path) => {
    loadingMap.delete(path)
    set((state) => ({
      entries: Object.fromEntries(
        Object.entries(state.entries).filter(([entryPath]) => entryPath !== path),
      ),
    }))
  },
  clear: () => {
    loadingMap.clear()
    set({ entries: {} })
  },
}))
