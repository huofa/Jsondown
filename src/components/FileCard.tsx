import { Folder } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { EditableFile } from '../types/file'
import { extractMarkdownSummary } from '../utils/extractMarkdownSummary'

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

type FileCardProps = {
  file: EditableFile
  content: string
  selected: boolean
  showParentFolder?: boolean
  onOpen: () => void
  onContextMenu: (event: MouseEvent) => void
}

export function FileCard({
  file,
  content,
  selected,
  showParentFolder,
  onOpen,
  onContextMenu,
}: FileCardProps) {
  const title = file.name.replace(/\.(md|markdown)$/i, '')
  const summary = file.kind === 'image'
    ? '图片文件'
    : extractMarkdownSummary(content, '暂无内容')
  return (
    <button
      className={`file-card ${selected ? 'is-active' : ''}`}
      onClick={onOpen}
      onContextMenu={onContextMenu}
      role="option"
      aria-selected={selected}
    >
      <span className="file-card-title">{title}</span>
      <span className="file-card-summary">{summary}</span>
      <span className="file-card-footer">
        <time>{relativeTime(file.updatedAt)}</time>
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
