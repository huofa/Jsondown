import { Folder, Pin } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { FilePreviewPayload } from '../services/tauriFileService'
import type { FilePreviewStatus } from '../stores/filePreviewStore'
import type { EditableFile } from '../types/file'

const relativeTime = (iso?: string) => {
  if (!iso) return '刚刚'
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return days < 8
    ? `${days} 天前`
    : new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

const fullTime = (iso?: string) =>
  iso ? new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso)) : '未知'

type FileCardProps = {
  file: EditableFile
  preview?: FilePreviewPayload
  previewStatus?: FilePreviewStatus
  selected: boolean
  showParentFolder?: boolean
  onOpen: () => void
  onContextMenu: (event: MouseEvent) => void
}

export function FileCard({
  file,
  preview,
  previewStatus = 'idle',
  selected,
  showParentFolder,
  onOpen,
  onContextMenu,
}: FileCardProps) {
  const title = file.name.replace(/\.(md|markdown)$/i, '')
  const summary = file.kind === 'image'
    ? '图片文件'
    : previewStatus === 'loading'
      ? '加载中…'
      : previewStatus === 'error'
        ? '暂无预览'
        : preview?.summary || '暂无预览'
  return (
    <button
      className={`file-card ${selected ? 'is-active' : ''}`}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      role="option"
      aria-selected={selected}
    >
      <span className="file-card-title">
        {title}
        {file.pinned && <span className="file-pinned-mark" title="置顶文件"><Pin size={10} /></span>}
      </span>
      <span className="file-card-summary">{summary}</span>
      <span className="file-card-footer">
        <time title={`创建：${fullTime(file.createdAt)}\n修改：${fullTime(file.updatedAt)}`}>
          改 {relativeTime(file.updatedAt ?? file.createdAt)}
        </time>
        <span className="file-type">{file.extension.toUpperCase()}</span>
        <span className={file.editable ? 'editable' : ''}>{file.editable ? '可编辑' : '只读'}</span>
      </span>
      {showParentFolder && file.parentFolderName && (
        <span className="file-parent-folder" title={file.parentFolderPath}>
          <Folder size={10} />
          {file.parentFolderName}
        </span>
      )}
    </button>
  )
}
