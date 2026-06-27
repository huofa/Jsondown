import type { EditableFile } from '../types/file'
import type { OpenedFileCacheEntry } from '../stores/openedFileCacheStore'
import { MarkdownRenderedViewer } from './MarkdownRenderedViewer'

export type ReadonlyEditAnchor = {
  clientX: number
  clientY: number
  viewportOffset?: number
  textSnippet?: string
}

type ReadonlyChunkViewerProps = {
  file: EditableFile
  entry?: OpenedFileCacheEntry
  editable?: boolean
  onEnterEdit?: (anchor?: ReadonlyEditAnchor) => void
}

export function ReadonlyChunkViewer({ file, entry, editable, onEnterEdit }: ReadonlyChunkViewerProps) {
  const text = entry?.readonlyChunks.map((chunk) => chunk.text).join('') ?? ''
  const shouldUseMarkdownRenderer = file.kind === 'markdown'
  const showMeta = !shouldUseMarkdownRenderer

  return (
    <article
      className={`readonly-chunk-viewer ${editable ? 'is-editable' : ''}`}
      onClick={(event) => {
        if (!editable) return

        const target = event.target as HTMLElement | null
        if (target?.closest?.('button, a, input, textarea, select')) return

        const scroll = target?.closest?.('.editor-scroll') as HTMLElement | null
        const block = target?.closest?.('[data-jd-readonly-block]') as HTMLElement | null
        const viewportOffset = block && scroll
          ? block.getBoundingClientRect().top - scroll.getBoundingClientRect().top
          : undefined

        onEnterEdit?.({
          clientX: event.clientX,
          clientY: event.clientY,
          viewportOffset,
          textSnippet: block?.dataset.jdText || block?.textContent?.trim().slice(0, 80),
        })
      }}
    >
      <div className="readonly-file-shell">
        {showMeta && (
          <div className="readonly-file-meta">
            <span>{file.extension.toUpperCase()}</span>
            <span>{editable ? '点击正文编辑' : '只读预览'}</span>
            {entry?.sizeBytes ? <span>{Math.ceil(entry.sizeBytes / 1024)} KB</span> : null}
          </div>
        )}
        {entry?.mode === 'readonly-loading' && <div className="readonly-skeleton">正在加载前四屏内容…</div>}
        {entry?.mode === 'error' && <div className="readonly-error">{entry.error ?? '读取失败'}</div>}
        {entry?.mode === 'readonly' && (shouldUseMarkdownRenderer
          ? <MarkdownRenderedViewer markdown={text} />
          : <pre className="readonly-plain-text"><code>{text || '暂无内容'}</code></pre>)}
      </div>
    </article>
  )
}
