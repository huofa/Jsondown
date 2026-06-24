import {
  Clipboard,
  ExternalLink,
  FilePlus2,
  FolderInput,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type ContextMenuProps = {
  x: number
  y: number
  onClose: () => void
  onOpenInFinder?: () => void
  onCopyPath?: () => void
  onRename?: () => void
  onNewFolder?: () => void
  onNewFile?: () => void
  onImportFolder?: () => void
  onRefresh?: () => void
  onDelete?: () => void
  renameLabel?: string
  deleteLabel?: string
}

export function ContextMenu({
  x,
  y,
  onClose,
  onOpenInFinder,
  onCopyPath,
  onRename,
  onNewFolder,
  onNewFile,
  onImportFolder,
  onRefresh,
  onDelete,
  renameLabel = '重命名',
  deleteLabel = '删除入口',
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const padding = 8
    const rect = element.getBoundingClientRect()
    const nextX = Math.max(padding, Math.min(x, window.innerWidth - rect.width - padding))
    const nextY = Math.max(padding, Math.min(y, window.innerHeight - rect.height - padding))
    setPosition({ x: nextX, y: nextY })
  }, [x, y, onOpenInFinder, onCopyPath, onRename, onNewFolder, onNewFile, onImportFolder, onRefresh, onDelete])

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
    <div ref={ref} className="context-menu" style={{ left: position.x, top: position.y }}>
      {onOpenInFinder && <button onClick={onOpenInFinder}><ExternalLink size={14} />在访达中打开</button>}
      {onCopyPath && <button onClick={onCopyPath}><Clipboard size={14} />复制路径</button>}
      {onRename && <button onClick={onRename}><Pencil size={14} />{renameLabel}</button>}
      {onNewFolder && <button onClick={onNewFolder}><FolderPlus size={14} />新建文件夹</button>}
      {onNewFile && <button onClick={onNewFile}><FilePlus2 size={14} />新建文件</button>}
      {onImportFolder && <button onClick={onImportFolder}><FolderInput size={14} />导入文件夹</button>}
      {onRefresh && <button onClick={onRefresh}><RefreshCw size={14} />刷新全部文件</button>}
      {onDelete && <button className="danger" onClick={onDelete}><Trash2 size={14} />{deleteLabel}</button>}
    </div>,
    document.body,
  )
}
