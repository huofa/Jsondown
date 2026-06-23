import { Check, ChevronDown, FileCode2, FileImage, FileText, Search } from 'lucide-react'
import { useMemo, useState, type MouseEvent } from 'react'
import { useRootFolderStore } from '../stores/rootFolderStore'
import { useFileListStore } from '../stores/fileListStore'
import { useEditorStore } from '../stores/editorStore'
import type { EditableFile, SortMode } from '../types/file'
import { flattenFiles } from '../utils/flattenFiles'
import { ContextMenu } from './ContextMenu'
import { showToast } from './Toast'

const sortLabels: Record<SortMode, string> = {
  updatedAt: '最近修改',
  name: '文件名',
  path: '路径',
}

const relativeTime = (iso?: string) => {
  if (!iso) return '未知'
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return days < 8 ? `${days} 天前` : new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

function FileIcon({ file }: { file: EditableFile }) {
  if (file.kind === 'image') return <FileImage size={19} />
  if (file.kind === 'markdown' || file.kind === 'text') return <FileText size={19} />
  return <FileCode2 size={19} />
}

export function FlatFileListPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const { query, sortMode, setQuery, setSortMode } = useFileListStore()
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const openFile = useEditorStore((state) => state.openFile)
  const [sortOpen, setSortOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; file: EditableFile } | null>(null)

  const activeFolder = folders.find((folder) => folder.id === activeFolderId)
  const files = useMemo(() => {
    if (!activeFolder) return []
    const result = flattenFiles(activeFolder.tree ?? [], activeFolder.path)
      .filter((file) => {
        const needle = query.trim().toLocaleLowerCase()
        return !needle || file.name.toLocaleLowerCase().includes(needle) || file.relativePath.toLocaleLowerCase().includes(needle)
      })

    return result.sort((a, b) => {
      if (sortMode === 'updatedAt') return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
      if (sortMode === 'path') return a.relativePath.localeCompare(b.relativePath, 'zh-CN')
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }, [activeFolder, query, sortMode])

  const openMenu = (event: MouseEvent, file: EditableFile) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, file })
  }

  return (
    <div className="file-list-shell">
      <header className="file-list-header">
        <div>
          <span className="eyebrow">全部文件</span>
          <h2>{activeFolder?.name ?? '未选择资料夹'}</h2>
        </div>
        <span className="file-count">{files.length}</span>
      </header>

      <div className="file-list-tools">
        <label className="search-field">
          <Search size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件" />
        </label>
        <div className="sort-control">
          <button onClick={() => setSortOpen((open) => !open)}>
            {sortLabels[sortMode]}<ChevronDown size={13} />
          </button>
          {sortOpen && (
            <div className="sort-menu">
              {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                <button key={mode} onClick={() => { setSortMode(mode); setSortOpen(false) }}>
                  <span>{sortLabels[mode]}</span>{sortMode === mode && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="file-list" role="listbox">
        {files.map((file) => (
          <button
            key={file.id}
            className={`file-card ${activeFileId === file.id ? 'is-active' : ''}`}
            onClick={() => openFile(file.id)}
            onContextMenu={(event) => openMenu(event, file)}
            role="option"
            aria-selected={activeFileId === file.id}
          >
            <span className={`file-icon kind-${file.kind}`}><FileIcon file={file} /></span>
            <span className="file-card-main">
              <strong>{file.name}</strong>
              <span className="file-meta">
                <em>{file.extension.toUpperCase()}</em>
                <span>{relativeTime(file.updatedAt)}</span>
              </span>
            </span>
            <span className={`access-badge ${file.editable ? 'editable' : ''}`}>
              {file.editable ? '可编辑' : '只读'}
            </span>
          </button>
        ))}
        {activeFolder && files.length === 0 && <div className="list-empty">没有匹配的可查看文件</div>}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpenInFinder={() => {
            showToast(`阶段 A Mock：在访达中显示 ${menu.file.name}`)
            setMenu(null)
          }}
          onCopyPath={() => {
            void navigator.clipboard.writeText(menu.file.path)
            showToast('已复制 Mock 路径')
            setMenu(null)
          }}
        />
      )}
    </div>
  )
}
