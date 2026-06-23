import { Clipboard, ExternalLink } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type ContextMenuProps = {
  x: number
  y: number
  onClose: () => void
  onOpenInFinder: () => void
  onCopyPath: () => void
}

export function ContextMenu({ x, y, onClose, onOpenInFinder, onCopyPath }: ContextMenuProps) {
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
      <button onClick={onCopyPath}><Clipboard size={14} />复制路径</button>
    </div>,
    document.body,
  )
}
