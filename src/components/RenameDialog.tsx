import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type RenameDialogProps = {
  open: boolean
  title: string
  initialName: string
  kind: 'file' | 'directory'
  onClose: () => void
  onRename: (name: string) => Promise<void> | void
}

const basenameRange = (name: string) => {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { start: 0, end: name.length }
  return { start: 0, end: dot }
}

const validateName = (name: string) => {
  const value = name.trim()
  if (!value) return '名称不能为空'
  if (value.includes('/') || value.includes('\\')) return '名称不能包含路径分隔符'
  if (value === '.' || value === '..') return '名称不能为 . 或 ..'
  return ''
}

export function RenameDialog({ open, title, initialName, kind, onClose, onRename }: RenameDialogProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const unchanged = useMemo(() => name.trim() === initialName, [initialName, name])

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setError('')
    setSubmitting(false)
    window.setTimeout(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      if (kind === 'file') {
        const range = basenameRange(initialName)
        input.setSelectionRange(range.start, range.end)
      } else {
        input.select()
      }
    }, 0)
  }, [initialName, kind, open])

  if (!open) return null

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <form
        className="native-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const validation = validateName(name)
          if (validation) {
            setError(validation)
            return
          }
          if (unchanged) {
            onClose()
            return
          }
          setSubmitting(true)
          setError('')
          Promise.resolve(onRename(name.trim()))
            .then(onClose)
            .catch((error) => {
              setSubmitting(false)
              setError(error instanceof Error ? error.message : String(error))
            })
        }}
      >
        <h3>{title}</h3>
        <p>{kind === 'file' ? '修改真实本地文件名称，父级位置不变。' : '修改真实本地文件夹名称，内部文件保持不变。'}</p>
        <label>
          名称
          <input
            ref={inputRef}
            value={name}
            disabled={submitting}
            onChange={(event) => {
              setName(event.target.value)
              if (error) setError('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose()
            }}
          />
        </label>
        {error && <div className="dialog-error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button type="submit" className="primary" disabled={submitting || !name.trim()}>
            {submitting ? '重命名中…' : '重命名'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
