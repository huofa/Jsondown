import { create } from 'zustand'
import { readFilePreview, type FilePreviewPayload } from '../services/tauriFileService'
import type { EditableFile } from '../types/file'

export const MAX_PREVIEW_CONCURRENCY = 3
export const INITIAL_PREVIEW_WINDOW_MS = 500
export const INITIAL_PREVIEW_BATCH_SIZE = 3
export const INITIAL_PREVIEW_BATCH_DELAY_MS = 50

export type FilePreviewStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type FilePreviewEntry = {
  path: string
  updatedAt?: string
  preview?: FilePreviewPayload
  status: FilePreviewStatus
  error?: string
}

type QueueItem = {
  file: EditableFile
  key: string
}

type FilePreviewStore = {
  previews: Record<string, FilePreviewEntry>
  loadPreview: (file: EditableFile) => void
  ensurePreviews: (files: EditableFile[], start: number, count: number) => void
  ensurePreviewsForDuration: (files: EditableFile[], durationMs: number) => void
  getPreviewKey: (file: EditableFile) => string
  removePreview: (path: string) => void
}

const queue: QueueItem[] = []
const queuedKeys = new Set<string>()
let activeCount = 0

const getPreviewKey = (file: EditableFile) => `${file.path}::${file.updatedAt ?? ''}`
type PreviewStoreSet = (
  partial: Partial<FilePreviewStore> | ((state: FilePreviewStore) => Partial<FilePreviewStore>),
) => void

const runQueue = (set: PreviewStoreSet) => {
  while (activeCount < MAX_PREVIEW_CONCURRENCY && queue.length > 0) {
    const item = queue.shift()
    if (!item) return
    queuedKeys.delete(item.key)
    activeCount += 1

    void readFilePreview(item.file.path, 4096, 2, item.file.id)
      .then((preview) => {
        set((state: FilePreviewStore) => ({
          previews: {
            ...state.previews,
            [item.key]: {
              path: item.file.path,
              updatedAt: item.file.updatedAt,
              preview,
              status: 'loaded',
            },
          },
        }))
      })
      .catch((error: unknown) => {
        set((state: FilePreviewStore) => ({
          previews: {
            ...state.previews,
            [item.key]: {
              path: item.file.path,
              updatedAt: item.file.updatedAt,
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
            },
          },
        }))
      })
      .finally(() => {
        activeCount -= 1
        runQueue(set)
      })
  }
}

export const useFilePreviewStore = create<FilePreviewStore>((set, get) => ({
  previews: {},
  getPreviewKey,
  loadPreview: (file) => {
    const key = getPreviewKey(file)
    const current = get().previews[key]
    if (current?.status === 'loaded' || current?.status === 'loading' || queuedKeys.has(key)) return

    set((state) => ({
      previews: {
        ...state.previews,
        [key]: {
          path: file.path,
          updatedAt: file.updatedAt,
          status: 'loading',
        },
      },
    }))
    queue.push({ file, key })
    queuedKeys.add(key)
    runQueue(set)
  },
  ensurePreviews: (files, start, count) => {
    const safeStart = Math.max(0, start)
    files.slice(safeStart, safeStart + count).forEach((file) => get().loadPreview(file))
  },
  ensurePreviewsForDuration: (files, durationMs) => {
    const startedAt = Date.now()
    let index = 0

    const enqueueBatch = () => {
      if (Date.now() - startedAt > durationMs || index >= files.length) return

      let count = 0
      while (count < INITIAL_PREVIEW_BATCH_SIZE && index < files.length) {
        get().loadPreview(files[index])
        index += 1
        count += 1
      }

      if (Date.now() - startedAt <= durationMs && index < files.length) {
        window.setTimeout(enqueueBatch, INITIAL_PREVIEW_BATCH_DELAY_MS)
      }
    }

    enqueueBatch()
  },
  removePreview: (path) => {
    set((state) => ({
      previews: Object.fromEntries(
        Object.entries(state.previews).filter(([, entry]) => entry.path !== path),
      ),
    }))
  },
}))
