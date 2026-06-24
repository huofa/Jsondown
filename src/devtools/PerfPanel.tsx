import { useEffect } from 'react'
import { perfMonitor } from './perfMonitor'
import { usePerfMonitor } from './usePerfMonitor'

const fmtMs = (value?: number) => value === undefined ? '—' : `${value.toFixed(1)}ms`
const fmtBytes = (value?: number) => {
  if (value === undefined) return '—'
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)}MB`
  if (value > 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${value}B`
}

export function PerfPanel() {
  const summary = usePerfMonitor()

  useEffect(() => {
    if (!summary.enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        perfMonitor.togglePanel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [summary.enabled])

  if (!summary.enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={() => perfMonitor.togglePanel()}
        style={{
          position: 'fixed',
          right: 14,
          bottom: 14,
          zIndex: 9998,
          border: '1px solid rgba(0,0,0,.12)',
          borderRadius: 999,
          background: 'rgba(255,255,255,.86)',
          backdropFilter: 'blur(12px)',
          padding: '7px 10px',
          fontSize: 12,
          color: '#5b554b',
          boxShadow: '0 8px 28px rgba(0,0,0,.12)',
        }}
      >
        Perf
      </button>
      {summary.panelOpen && (
        <aside
          style={{
            position: 'fixed',
            right: 14,
            bottom: 54,
            width: 380,
            maxHeight: '72vh',
            overflow: 'auto',
            zIndex: 9999,
            border: '1px solid rgba(0,0,0,.12)',
            borderRadius: 16,
            background: 'rgba(250,248,243,.94)',
            backdropFilter: 'blur(18px)',
            color: '#2d2a25',
            boxShadow: '0 16px 46px rgba(0,0,0,.18)',
            fontSize: 12,
            padding: 14,
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <strong>Jsondown Perf Monitor</strong>
            <button onClick={() => perfMonitor.setPanelOpen(false)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>关闭</button>
          </header>
          <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px', margin: 0 }}>
            <dt>当前文件</dt><dd style={{ maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.currentPath ?? '—'}</dd>
            <dt>文件大小</dt><dd>{fmtBytes(summary.fileSize)}</dd>
            <dt>行数 / 字符</dt><dd>{summary.lineCount ?? '—'} / {summary.charCount ?? '—'}</dd>
            <dt>打开总耗时</dt><dd>{fmtMs(summary.lastOpenTotalMs)}</dd>
            <dt>read_text_file</dt><dd>{fmtMs(summary.lastReadMs)}</dd>
            <dt>Crepe init</dt><dd>{fmtMs(summary.lastCrepeInitMs)}</dd>
            <dt>5秒 transactions</dt><dd>{summary.transactions5s}</dd>
            <dt>5秒 docChanged</dt><dd>{summary.docChanged5s}</dd>
            <dt>5秒 selection-only</dt><dd>{summary.selectionOnly5s}</dd>
            <dt>5秒 serialize</dt><dd>{summary.serialize5s}</dd>
            <dt>最近 serialize</dt><dd>{fmtMs(summary.lastSerializeMs)}</dd>
            <dt>最近写入</dt><dd>{fmtMs(summary.lastWriteMs)}</dd>
            <dt>watcher / self / external</dt><dd>{summary.watcherEvents} / {summary.watcherSelfSaveEvents} / {summary.watcherExternalEvents}</dd>
            <dt>JS heap</dt><dd>{summary.jsHeap ? `${fmtBytes(summary.jsHeap.used)} / ${fmtBytes(summary.jsHeap.total)}` : '—'}</dd>
          </dl>
          <hr style={{ border: 0, borderTop: '1px solid rgba(0,0,0,.1)', margin: '12px 0' }} />
          <div style={{ display: 'grid', gap: 6 }}>
            {summary.events.slice(0, 18).map((event) => (
              <div key={event.id} style={{ padding: '6px 8px', borderRadius: 10, background: event.name.includes('warning') ? 'rgba(196,112,50,.12)' : 'rgba(255,255,255,.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>[{event.category}] {event.name}</strong>
                  <span>{fmtMs(event.durationMs)}</span>
                </div>
                {event.path && <div style={{ opacity: .65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.path}</div>}
              </div>
            ))}
          </div>
        </aside>
      )}
    </>
  )
}
