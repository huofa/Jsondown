import type { EditableFile } from '../types/file'
import type { OpenedFileCacheEntry } from '../stores/openedFileCacheStore'
import { MarkdownRenderedViewer } from './MarkdownRenderedViewer'

export type ReadonlyEditAnchor = {
  clientX: number
  clientY: number
  viewportOffset?: number
  textSnippet?: string
  textBefore?: string
  textAfter?: string
  textOffset?: number
}

type ReadonlyChunkViewerProps = {
  file: EditableFile
  entry?: OpenedFileCacheEntry
  editable?: boolean
  onEnterEdit?: (anchor?: ReadonlyEditAnchor) => void
}

const getCaretRangeFromPoint = (clientX: number, clientY: number) => {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  const caretPosition = doc.caretPositionFromPoint?.(clientX, clientY)
  if (caretPosition) {
    return {
      node: caretPosition.offsetNode,
      offset: caretPosition.offset,
    }
  }

  const range = doc.caretRangeFromPoint?.(clientX, clientY)
  if (!range) return null

  return {
    node: range.startContainer,
    offset: range.startOffset,
  }
}

const getTextOffsetWithin = (root: HTMLElement, targetNode: Node, targetOffset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let offset = 0
  let current = walker.nextNode()

  while (current) {
    if (current === targetNode) return offset + targetOffset
    offset += current.textContent?.length ?? 0
    current = walker.nextNode()
  }

  return undefined
}

const buildTextAnchor = (block: HTMLElement | null, clientX: number, clientY: number) => {
  if (!block) return {}

  const caret = getCaretRangeFromPoint(clientX, clientY)
  const blockText = block.textContent ?? ''

  if (!caret || !block.contains(caret.node)) return {}

  const textOffset = getTextOffsetWithin(block, caret.node, caret.offset)
  if (typeof textOffset !== 'number') return {}

  return {
    textOffset,
    textBefore: blockText.slice(Math.max(0, textOffset - 48), textOffset),
    textAfter: blockText.slice(textOffset, textOffset + 48),
  }
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
        const textAnchor = buildTextAnchor(block, event.clientX, event.clientY)

        onEnterEdit?.({
          clientX: event.clientX,
          clientY: event.clientY,
          viewportOffset,
          textSnippet: block?.dataset.jdText || block?.textContent?.trim().slice(0, 80),
          ...textAnchor,
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
        {!entry && <div className="readonly-skeleton">正在加载…</div>}
        {entry?.mode === 'readonly-loading' && <div className="readonly-skeleton">正在加载…</div>}
        {entry?.mode === 'error' && <div className="readonly-error">{entry.error ?? '读取失败'}</div>}
        {entry?.mode === 'readonly' && (shouldUseMarkdownRenderer
          ? <MarkdownRenderedViewer markdown={text} />
          : <pre className="readonly-plain-text"><code>{text || '暂无内容'}</code></pre>)}
      </div>
    </article>
  )
}
