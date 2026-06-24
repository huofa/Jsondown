import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type NewFolderDialogProps = {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => void
  description?: string
  locationHint?: string
}

export function NewFolderDialog({
  open,
  onClose,
  onCreate,
  description = '选择一个本地位置后创建新资料夹。',
  locationHint = '点击创建后选择位置',
}: NewFolderDialogProps) {
  const [name, setName] = useState('新建资料夹')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.select(), 0)
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <form
        className="native-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(name)
          onClose()
        }}
      >
        <h3>新建资料夹</h3>
        <p>{description}</p>
        <label>
          名称
          <input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="mock-location">位置　{locationHint}</div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="submit" className="primary">创建</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
