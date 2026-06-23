import { Check, ChevronDown, Search } from 'lucide-react'
import { useMemo, useState, type MouseEvent } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useFileListStore } from '../stores/fileListStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import type { EditableFile, SortMode } from '../types/file'
import { flattenFiles } from '../utils/flattenFiles'
import { ContextMenu } from './ContextMenu'
import { FileCard } from './FileCard'
import { showToast } from './Toast'

const sortLabels: Record<SortMode, string> = {
  updatedAt: '最近修改',
  name: '文件名',
  path: '路径',
}

export function FlatFileListPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const renameFile = useRootFolderStore((state) => state.renameFile)
  const selectFolder = useRootFolderStore((state) => state.selectFolder)
  const { query, sortMode, setQuery, setSortMode } = useFileListStore()
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const contents = useEditorStore((state) => state.contents)
  const openFile = useEditorStore((state) => state.openFile)
  const [sortOpen, setSortOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; file: EditableFile } | null>(null)

  const activeFolder = folders.find((folder) => folder.id === activeFolderId)
  const title = activeFolderId === 'all' ? '全部文件' : (activeFolder?.name ?? '未选择资料夹')
  const files = useMemo(() => {
    const sourceFolders = activeFolderId === 'all'
      ? folders
      : folders.filter((folder) => folder.id === activeFolderId)
    const needle = query.trim().toLocaleLowerCase()
    const result = sourceFolders.flatMap((folder) =>
      flattenFiles(folder.tree ?? [], folder.path, folder.id))
      .filter((file) => {
        const content = contents[file.id] ?? ''
        return !needle
          || file.name.toLocaleLowerCase().includes(needle)
          || file.relativePath.toLocaleLowerCase().includes(needle)
          || content.toLocaleLowerCase().includes(needle)
      })

    return result.sort((a, b) => {
      if (sortMode === 'updatedAt') return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
      if (sortMode === 'path') return a.path.localeCompare(b.path, 'zh-CN')
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }, [activeFolderId, contents, folders, query, sortMode])

  const openMenu = (event: MouseEvent, file: EditableFile) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, file })
  }

  return (
    <div className="file-list-shell">
      <header className="file-list-header">
        <div>
          <span className="eyebrow">{activeFolderId === 'all' ? '所有资料夹' : '当前资料夹'}</span>
          <h2>{title}</h2>
        </div>
        <span className="file-count">{files.length}</span>
      </header>

      <div className="file-list-tools">
        <label className="search-field">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文件名或内容"
          />
        </label>
        <div className="sort-control">
          <button onClick={() => setSortOpen((open) => !open)}>
            {sortLabels[sortMode]}<ChevronDown size={12} />
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
          <FileCard
            key={file.id}
            file={file}
            content={contents[file.id] ?? ''}
            selected={activeFileId === file.id}
            onOpen={() => {
              if (activeFolderId !== 'all' && file.rootFolderId) selectFolder(file.rootFolderId)
              openFile(file.id)
            }}
            onContextMenu={(event) => openMenu(event, file)}
          />
        ))}
        {files.length === 0 && <div className="list-empty">没有匹配的可查看文件</div>}
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
          onRename={() => {
            const name = window.prompt('重命名文件', menu.file.name)
            if (name) {
              renameFile(menu.file.id, name)
              showToast('阶段 A：已在内存中重命名')
            }
            setMenu(null)
          }}
        />
      )}
    </div>
  )
}
