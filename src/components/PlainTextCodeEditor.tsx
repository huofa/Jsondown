import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'

export type PlainTextCodeEditorHandle = {
  rememberSelection: () => boolean
  insertText: (text: string) => boolean
  focusStart: () => boolean
}

type PlainTextCodeEditorProps = {
  value: string
  readOnly?: boolean
  autoFocusStart?: boolean
  searchQuery?: string
  onChange: (value: string) => void
}

const buildHighlightParts = (value: string, query: string) => {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return [{ text: value, highlighted: false }]

  const lowerValue = value.toLocaleLowerCase()
  const lowerQuery = normalizedQuery.toLocaleLowerCase()
  const parts: Array<{ text: string; highlighted: boolean }> = []
  let cursor = 0

  while (cursor < value.length) {
    const index = lowerValue.indexOf(lowerQuery, cursor)
    if (index < 0) break
    if (index > cursor) {
      parts.push({ text: value.slice(cursor, index), highlighted: false })
    }
    parts.push({ text: value.slice(index, index + normalizedQuery.length), highlighted: true })
    cursor = index + Math.max(normalizedQuery.length, 1)
  }

  if (cursor < value.length) {
    parts.push({ text: value.slice(cursor), highlighted: false })
  }

  return parts.length ? parts : [{ text: value, highlighted: false }]
}

export const PlainTextCodeEditor = forwardRef<PlainTextCodeEditorHandle, PlainTextCodeEditorProps>(
  function PlainTextCodeEditor({ value, readOnly = false, autoFocusStart = false, searchQuery = '', onChange }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const highlightLayerRef = useRef<HTMLPreElement>(null)
    const selectionRef = useRef<{ start: number; end: number } | null>(null)
    const highlightParts = buildHighlightParts(value, searchQuery)

    const resizeToContent = () => {
      const textarea = textareaRef.current
      if (!textarea) return
      const scrollParent = textarea.closest('.editor-scroll') as HTMLElement | null
      const parentScrollTop = scrollParent?.scrollTop ?? 0

      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
      textarea.scrollTop = 0

      if (scrollParent) {
        scrollParent.scrollTop = Math.min(
          parentScrollTop,
          Math.max(0, scrollParent.scrollHeight - scrollParent.clientHeight),
        )
      }
    }

    const rememberSelection = () => {
      const textarea = textareaRef.current
      if (!textarea) return false
      const highlightLayer = highlightLayerRef.current
      if (highlightLayer) highlightLayer.scrollTop = textarea.scrollTop
      textarea.scrollTop = 0
      selectionRef.current = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      }
      return true
    }

    const focusStart = () => {
      const textarea = textareaRef.current
      if (!textarea) return false
      textarea.focus()
      textarea.setSelectionRange(0, 0)
      selectionRef.current = { start: 0, end: 0 }
      return true
    }

    const insertText = (text: string) => {
      const textarea = textareaRef.current
      if (!textarea || readOnly) return false

      const savedSelection = selectionRef.current
      const start = savedSelection?.start ?? textarea.selectionStart ?? 0
      const end = savedSelection?.end ?? textarea.selectionEnd ?? start
      const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`
      const nextCursor = start + text.length

      onChange(nextValue)

      window.requestAnimationFrame(() => {
        textarea.focus()
        textarea.setSelectionRange(nextCursor, nextCursor)
        resizeToContent()
        selectionRef.current = { start: nextCursor, end: nextCursor }
      })

      return true
    }

    useImperativeHandle(ref, () => ({
      rememberSelection,
      insertText,
      focusStart,
    }))

    useLayoutEffect(() => {
      if (!autoFocusStart || readOnly) return
      window.requestAnimationFrame(focusStart)
    }, [autoFocusStart, readOnly])

    useLayoutEffect(() => {
      resizeToContent()
    }, [value])

    return (
      <div className="plain-text-code-editor-wrap">
        <pre ref={highlightLayerRef} aria-hidden="true" className="plain-text-code-highlight-layer">
          {highlightParts.map((part, index) =>
            part.highlighted ? (
              <mark key={index}>{part.text}</mark>
            ) : (
              <span key={index}>{part.text}</span>
            ),
          )}
          {'\n'}
        </pre>
        <textarea
          ref={textareaRef}
          className="plain-text-code-editor"
          rows={1}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          onBlur={rememberSelection}
          onKeyUp={rememberSelection}
          onMouseUp={rememberSelection}
          onSelect={rememberSelection}
          onScroll={(event) => {
            const highlightLayer = highlightLayerRef.current
            if (highlightLayer) highlightLayer.scrollTop = event.currentTarget.scrollTop
          }}
          onChange={(event) => {
            onChange(event.currentTarget.value)
            window.requestAnimationFrame(resizeToContent)
          }}
        />
      </div>
    )
  },
)
