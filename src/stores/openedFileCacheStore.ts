import { create } from 'zustand'
import { readFileChunk, type FileChunkResult } from '../services/tauriFileService'
import type { EditableFile } from '../types/file'

export const FIRST_CHUNK_SIZE = 64 * 1024
export const OPENED_FILE_CACHE_LIMIT = 10

export type OpenedFileMode = 'readonly-loading' | 'readonly' | 'error'

export type OpenedFileCacheEntry = {
  path: string
  updatedAt?: string
  sizeBytes: number
  createdAt?: string
  mode: OpenedFileMode
  readonlyChunks: FileChunkResult[]
  readonlyLoadedBytes: number
  readonlyEof: boolean
  scrollTop: number
  lastOpenedAt: number
  lastAccessedAt: number
  error?: string
}

type OpenedFileCacheStore = {
  entries: Record<string, OpenedFileCacheEntry>
  openReadonlyFile: (file: EditableFile) => Promise<void>
  loadNextReadonlyChunk: (file: EditableFile) => Promise<void>
  ensureReadonlyBytes: (file: EditableFile, minBytes: number) => Promise<void>
  updateScrollTop: (file: EditableFile, scrollTop: number) => void
  getCacheKey: (file: EditableFile) => string
  invalidatePath: (path: string) => void
}

const getCacheKey = (file: EditableFile) => `${file.path}::${file.updatedAt ?? ''}`
const loadingMoreKeys = new Set<string>()

const pruneEntries = (entries: Record<string, OpenedFileCacheEntry>) => {
  const ordered = Object.entries(entries)
    .sort(([, a], [, b]) => b.lastAccessedAt - a.lastAccessedAt)
    .slice(0, OPENED_FILE_CACHE_LIMIT)
  return Object.fromEntries(ordered)
}

export const useOpenedFileCacheStore = create<OpenedFileCacheStore>((set, get) => ({
  entries: {},
  getCacheKey,
  openReadonlyFile: async (file) => {
    const key = getCacheKey(file)
    const now = Date.now()
    const current = get().entries[key]
    if (current?.mode === 'readonly' || current?.mode === 'readonly-loading') {
      set((state) => ({
        entries: {
          ...state.entries,
          [key]: { ...current, lastAccessedAt: now },
        },
      }))
      return
    }

    set((state) => ({
      entries: pruneEntries({
        ...state.entries,
        [key]: {
          path: file.path,
          updatedAt: file.updatedAt,
          sizeBytes: file.size ?? 0,
          createdAt: file.createdAt,
          mode: 'readonly-loading',
          readonlyChunks: [],
          readonlyLoadedBytes: 0,
          readonlyEof: false,
          scrollTop: 0,
          lastOpenedAt: now,
          lastAccessedAt: now,
        },
      }),
    }))

    try {
      const chunk = await readFileChunk(file.path, 0, FIRST_CHUNK_SIZE, file.id)
      set((state) => {
        const entry = state.entries[key]
        if (!entry) return state
        return {
          entries: pruneEntries({
            ...state.entries,
            [key]: {
              ...entry,
              mode: 'readonly',
              sizeBytes: chunk.sizeBytes,
              createdAt: chunk.createdAt ?? entry.createdAt,
              readonlyChunks: [chunk],
              readonlyLoadedBytes: chunk.endByte,
              readonlyEof: chunk.eof,
              lastAccessedAt: Date.now(),
            },
          }),
        }
      })
    } catch (error) {
      set((state) => {
        const entry = state.entries[key]
        if (!entry) return state
        return {
          entries: {
            ...state.entries,
            [key]: {
              ...entry,
              mode: 'error',
              error: error instanceof Error ? error.message : String(error),
            },
          },
        }
      })
    }
  },
  loadNextReadonlyChunk: async (file) => {
    const key = getCacheKey(file)
    const entry = get().entries[key]
    if (!entry || entry.mode !== 'readonly' || entry.readonlyEof || loadingMoreKeys.has(key)) return
    loadingMoreKeys.add(key)
    try {
      const chunk = await readFileChunk(file.path, entry.readonlyLoadedBytes, FIRST_CHUNK_SIZE, file.id)
      set((state) => {
        const current = state.entries[key]
        if (!current) return state
        return {
          entries: pruneEntries({
            ...state.entries,
            [key]: {
              ...current,
              readonlyChunks: [...current.readonlyChunks, chunk],
              readonlyLoadedBytes: chunk.endByte,
              readonlyEof: chunk.eof,
              sizeBytes: chunk.sizeBytes,
              lastAccessedAt: Date.now(),
            },
          }),
        }
      })
    } finally {
      loadingMoreKeys.delete(key)
    }
  },
  ensureReadonlyBytes: async (file, minBytes) => {
    const key = getCacheKey(file)
    let safety = 0

    while (safety < 12) {
      const entry = get().entries[key]
      if (!entry || entry.mode !== 'readonly' || entry.readonlyEof) return
      if (entry.readonlyLoadedBytes >= minBytes) return

      await get().loadNextReadonlyChunk(file)
      safety += 1
    }
  },
  updateScrollTop: (file, scrollTop) => {
    const key = getCacheKey(file)
    set((state) => {
      const entry = state.entries[key]
      if (!entry) return state
      return {
        entries: {
          ...state.entries,
          [key]: {
            ...entry,
            scrollTop,
            lastAccessedAt: Date.now(),
          },
        },
      }
    })
  },
  invalidatePath: (path) => {
    set((state) => ({
      entries: Object.fromEntries(
        Object.entries(state.entries).filter(([, entry]) => entry.path !== path),
      ),
    }))
  },
}))
