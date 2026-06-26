import type { EditableFile } from '../types/file'
import type { OpenedFileCacheEntry } from '../stores/openedFileCacheStore'
import { MilkdownEditor } from './MilkdownEditor'

type ReadonlyChunkViewerProps = {
  file: EditableFile
  entry?: OpenedFileCacheEntry
  editable?: boolean
  onEnterEdit?: () => void
}

export function ReadonlyChunkViewer({ file, entry, editable, onEnterEdit }: ReadonlyChunkViewerProps) {
  const text = entry?.readonlyChunks.map((chunk) => chunk.text).join('') ?? ''
  const shouldUseReadonlyMilkdown = file.kind === 'markdown'
  const showMeta = !shouldUseReadonlyMilkdown

  return (
    <article
      className={`readonly-chunk-viewer ${editable ? 'is-editable' : ''}`}
      onClick={() => {
        if (editable) onEnterEdit?.()
      }}
      title={editable ? '点击正文进入编辑' : undefined}
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
        {entry?.mode === 'readonly' && (shouldUseReadonlyMilkdown
          ? (
            <MilkdownEditor
              key={`${file.id}:readonly:${entry.updatedAt ?? ''}:${text.length}`}
              value={text}
              readOnly
              onChange={() => {}}
            />
          )
          : <pre className="readonly-plain-text"><code>{text || '暂无内容'}</code></pre>)}
      </div>
    </article>
  )
}
