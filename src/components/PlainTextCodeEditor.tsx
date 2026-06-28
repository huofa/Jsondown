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
  onChange: (value: string) => void
}

export const PlainTextCodeEditor = forwardRef<PlainTextCodeEditorHandle, PlainTextCodeEditorProps>(
  function PlainTextCodeEditor({ value, readOnly = false, autoFocusStart = false, onChange }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const selectionRef = useRef<{ start: number; end: number } | null>(null)

    const rememberSelection = () => {
      const textarea = textareaRef.current
      if (!textarea) return false
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

    return (
      <textarea
        ref={textareaRef}
        className="plain-text-code-editor"
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onBlur={rememberSelection}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onSelect={rememberSelection}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    )
  },
)
