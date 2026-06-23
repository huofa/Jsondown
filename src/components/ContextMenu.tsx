import { Clipboard, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type ContextMenuProps = {
  x: number
  y: number
  onClose: () => void
  onOpenInFinder: () => void
  onCopyPath?: () => void
  onRename?: () => void
  onDelete?: () => void
  deleteLabel?: string
}

export function ContextMenu({
  x,
  y,
  onClose,
  onOpenInFinder,
  onCopyPath,
  onRename,
  onDelete,
  deleteLabel = '删除入口',
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return createPortal(
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      <button onClick={onOpenInFinder}><ExternalLink size={14} />在访达中打开</button>
      {onCopyPath && <button onClick={onCopyPath}><Clipboard size={14} />复制路径</button>}
      {onRename && <button onClick={onRename}><Pencil size={14} />重命名</button>}
      {onDelete && <button className="danger" onClick={onDelete}><Trash2 size={14} />{deleteLabel}</button>}
    </div>,
    document.body,
  )
}
