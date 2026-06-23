import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type NewFolderDialogProps = {
  open: boolean
  onClose: () => void
  onCreate: (name: string) => void
}

export function NewFolderDialog({ open, onClose, onCreate }: NewFolderDialogProps) {
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
        <p>阶段 A 将模拟在桌面创建资料夹。</p>
        <label>
          名称
          <input ref={inputRef} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="mock-location">位置　桌面 / Desktop</div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>取消</button>
          <button type="submit" className="primary">创建</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
