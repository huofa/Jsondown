export type PerfCategory =
  | 'file-click'
  | 'file-read'
  | 'crepe-init'
  | 'input-transaction'
  | 'serialize'
  | 'file-write'
  | 'watcher'
  | 'memory'

export type PerfEvent = {
  id: string
  category: PerfCategory
  name: string
  path?: string
  startedAt: number
  endedAt?: number
  durationMs?: number
  fileSize?: number
  lineCount?: number
  charCount?: number
  detail?: Record<string, unknown>
}

export type PerfSummary = {
  enabled: boolean
  currentPath?: string
  fileSize?: number
  lineCount?: number
  charCount?: number
  lastOpenTotalMs?: number
  lastReadMs?: number
  lastCrepeInitMs?: number
  transactions5s: number
  docChanged5s: number
  selectionOnly5s: number
  serialize5s: number
  lastSerializeMs?: number
  lastWriteMs?: number
  watcherEvents: number
  watcherSelfSaveEvents: number
  watcherExternalEvents: number
  jsHeap?: {
    used: number
    total: number
    limit: number
  }
  events: PerfEvent[]
}
