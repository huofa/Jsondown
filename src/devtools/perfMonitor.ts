import type { PerfCategory, PerfEvent, PerfSummary } from './perfTypes'

const DEV_PERF_ENABLED = import.meta.env.DEV
const WINDOW_MS = 5000
const SELF_SAVE_WINDOW_MS = 2000

type Listener = () => void

const now = () => performance.now()
const wallNow = () => Date.now()

const makeId = () => `perf-${Math.round(now())}-${Math.round(Math.random() * 1_000_000)}`

class PerfMonitor {
  private events: PerfEvent[] = []
  private listeners = new Set<Listener>()
  private fileOpenStartedAt = new Map<string, number>()
  private recentlySaved = new Map<string, number>()
  private inFlightWrites = new Set<string>()
  private panelOpen = false
  private jsHeap: PerfSummary['jsHeap']

  get enabled() {
    return DEV_PERF_ENABLED
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  togglePanel() {
    if (!this.enabled) return
    this.panelOpen = !this.panelOpen
    this.emit()
  }

  setPanelOpen(open: boolean) {
    if (!this.enabled) return
    this.panelOpen = open
    this.emit()
  }

  isPanelOpen() {
    return this.enabled && this.panelOpen
  }

  begin(category: PerfCategory, name: string, detail?: Partial<PerfEvent>) {
    const event: PerfEvent = {
      id: makeId(),
      category,
      name,
      startedAt: now(),
      ...detail,
    }
    return event
  }

  end(event: PerfEvent, extraDetail?: Record<string, unknown>) {
    if (!this.enabled) return event
    const endedAt = now()
    const done: PerfEvent = {
      ...event,
      endedAt,
      durationMs: endedAt - event.startedAt,
      detail: {
        ...event.detail,
        ...extraDetail,
      },
    }
    this.push(done)
    return done
  }

  instant(category: PerfCategory, name: string, detail?: Partial<PerfEvent>) {
    if (!this.enabled) return
    this.push({
      id: makeId(),
      category,
      name,
      startedAt: now(),
      endedAt: now(),
      durationMs: 0,
      ...detail,
    })
  }

  measureSync<T>(category: PerfCategory, name: string, fn: () => T, detail?: Partial<PerfEvent>) {
    if (!this.enabled) return fn()
    const event = this.begin(category, name, detail)
    try {
      return fn()
    } finally {
      this.end(event)
    }
  }

  beginFileOpen(path: string, fileSize?: number) {
    if (!this.enabled) return
    this.fileOpenStartedAt.set(path, now())
    this.currentFile(path, fileSize)
    this.instant('file-click', 'file-card-click', {
      path,
      fileSize,
    })
  }

  markFileLoading(path: string) {
    if (!this.enabled) return
    const started = this.fileOpenStartedAt.get(path)
    if (!started) return
    const durationMs = now() - started
    this.push({
      id: makeId(),
      category: 'file-click',
      name: 'click-to-loading',
      path,
      startedAt: started,
      endedAt: now(),
      durationMs,
      detail: { clickToLoadingMs: durationMs },
    })
  }

  finishFileOpen(path: string, name = 'file-open-total') {
    if (!this.enabled) return
    const started = this.fileOpenStartedAt.get(path)
    if (!started) return
    const ended = now()
    this.push({
      id: makeId(),
      category: 'file-click',
      name,
      path,
      startedAt: started,
      endedAt: ended,
      durationMs: ended - started,
    })
    this.fileOpenStartedAt.delete(path)
  }

  currentFile(path: string, fileSize?: number, content?: string) {
    if (!this.enabled) return
    const lineCount = content ? content.split(/\r?\n/).length : undefined
    this.instant('memory', 'current-file', {
      path,
      fileSize,
      lineCount,
      charCount: content?.length,
    })
  }

  markSaved(path: string) {
    if (!this.enabled) return
    this.recentlySaved.set(path, wallNow())
  }

  classifyWatcher(path: string) {
    const savedAt = this.recentlySaved.get(path)
    if (!savedAt) return 'external'
    if (wallNow() - savedAt <= SELF_SAVE_WINDOW_MS) return 'self-save'
    return 'external'
  }

  beginWrite(path: string) {
    if (!this.enabled) return { concurrent: false }
    const concurrent = this.inFlightWrites.has(path)
    if (concurrent) {
      this.warning('file-write', 'concurrent-write', { path })
    }
    this.inFlightWrites.add(path)
    this.instant('file-write', 'save-queue', {
      path,
      detail: { status: 'saving', concurrent },
    })
    return { concurrent }
  }

  endWrite(path: string, durationMs?: number) {
    if (!this.enabled) return
    this.inFlightWrites.delete(path)
    this.markSaved(path)
    this.instant('file-write', 'save-queue', {
      path,
      durationMs,
      detail: { status: 'saved' },
    })
    if (durationMs !== undefined && durationMs > 300) {
      this.warning('file-write', 'slow-write', { path, durationMs })
    }
  }

  warning(category: PerfCategory, name: string, detail?: Partial<PerfEvent>) {
    if (!this.enabled) return
    this.instant(category, `[warning] ${name}`, detail)
  }

  updateMemory() {
    if (!this.enabled) return
    const memory = (performance as Performance & {
      memory?: {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
      }
    }).memory
    if (!memory) return
    this.jsHeap = {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    }
    this.instant('memory', 'js-heap', {
      detail: this.jsHeap,
    })
  }

  summary(): PerfSummary & { panelOpen: boolean } {
    const since = now() - WINDOW_MS
    const recent = this.events.filter((event) => event.startedAt >= since)
    const last = (category: PerfCategory, name?: string) =>
      [...this.events].reverse().find((event) =>
        event.category === category && (!name || event.name.includes(name)),
      )
    const current = [...this.events].reverse().find((event) => event.name === 'current-file')

    return {
      enabled: this.enabled,
      panelOpen: this.isPanelOpen(),
      currentPath: current?.path,
      fileSize: current?.fileSize,
      lineCount: current?.lineCount,
      charCount: current?.charCount,
      lastOpenTotalMs: last('file-click', 'file-open-total')?.durationMs,
      lastReadMs: last('file-read')?.durationMs,
      lastCrepeInitMs: last('crepe-init')?.durationMs,
      transactions5s: recent.filter((event) => event.category === 'input-transaction').length,
      docChanged5s: recent.filter((event) => event.category === 'input-transaction' && event.detail?.docChanged === true).length,
      selectionOnly5s: recent.filter((event) => event.category === 'input-transaction' && event.detail?.docChanged === false).length,
      serialize5s: recent.filter((event) => event.category === 'serialize').length,
      lastSerializeMs: last('serialize')?.durationMs,
      lastWriteMs: last('file-write', 'write-text-file')?.durationMs ?? last('file-write', 'save-queue')?.durationMs,
      watcherEvents: this.events.filter((event) => event.category === 'watcher').length,
      watcherSelfSaveEvents: this.events.filter((event) => event.category === 'watcher' && event.detail?.source === 'self-save').length,
      watcherExternalEvents: this.events.filter((event) => event.category === 'watcher' && event.detail?.source === 'external').length,
      jsHeap: this.jsHeap,
      events: this.events.slice(-80).reverse(),
    }
  }

  private push(event: PerfEvent) {
    if (!this.enabled) return
    this.events = [...this.events, event].slice(-500)
    this.consoleLog(event)
    this.checkThresholds(event)
    this.emit()
  }

  private consoleLog(event: PerfEvent) {
    const duration = event.durationMs === undefined ? '' : ` duration=${event.durationMs.toFixed(1)}ms`
    const path = event.path ? ` path=${event.path}` : ''
    const detail = event.detail ? ` ${Object.entries(event.detail).map(([key, value]) => `${key}=${String(value)}`).join(' ')}` : ''
    console.info(`[perf][${event.category}] ${event.name}${path}${duration}${detail}`)
  }

  private checkThresholds(event: PerfEvent) {
    if (event.category === 'file-read' && (event.durationMs ?? 0) > 300) this.warning('file-read', 'slow-read', event)
    if (event.category === 'crepe-init' && (event.durationMs ?? 0) > 500) this.warning('crepe-init', 'slow-crepe-init', event)
    if (event.category === 'serialize' && (event.durationMs ?? 0) > 200) this.warning('serialize', 'slow-serialize', event)

    const since = now() - WINDOW_MS
    const recentSerialize = this.events.filter((item) => item.category === 'serialize' && item.startedAt >= since)
    if (event.category === 'serialize' && recentSerialize.length > 3) {
      this.warning('serialize', 'too-frequent', { detail: { count5s: recentSerialize.length } })
    }
    const recentWatcher = this.events.filter((item) => item.category === 'watcher' && item.startedAt >= since)
    if (event.category === 'watcher' && recentWatcher.length > 20) {
      this.warning('watcher', 'too-many-events', { detail: { count5s: recentWatcher.length } })
    }
  }

  private emit() {
    this.listeners.forEach((listener) => listener())
  }
}

export const perfMonitor = new PerfMonitor()

if (DEV_PERF_ENABLED && typeof window !== 'undefined') {
  window.setInterval(() => perfMonitor.updateMemory(), 5000)
}
