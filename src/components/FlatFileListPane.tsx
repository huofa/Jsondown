import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type MouseEvent, type UIEvent } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useFileListStore } from '../stores/fileListStore'
import {
  FIRST_PREVIEW_COUNT,
  PAGE_SIZE,
  PRELOAD_NEXT_PAGE_COUNT,
  useFilePreviewStore,
} from '../stores/filePreviewStore'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import {
  isTauriRuntime,
  moveToRecentlyDeleted as movePathToRecentlyDeleted,
  revealInFinder,
} from '../services/tauriFileService'
import type { EditableFile, SortMode } from '../types/file'
import { findParentFolderId, getDirectFilesForSelection, getFolderSelection } from '../utils/folderSelection'
import { flattenFiles } from '../utils/flattenFiles'
import { ContextMenu } from './ContextMenu'
import { FileCard } from './FileCard'
import { RecentlyDeletedPane } from './RecentlyDeletedPane'
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
  const removeFile = useRootFolderStore((state) => state.removeFile)
  const refreshRootFolder = useRootFolderStore((state) => state.refreshRootFolder)
  const selectFolder = useRootFolderStore((state) => state.selectFolder)
  const { query, sortMode, setQuery, setSortMode } = useFileListStore()
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const openFile = useEditorStore((state) => state.openFile)
  const removeContent = useEditorStore((state) => state.removeContent)
  const closeFile = useEditorStore((state) => state.closeFile)
  const previews = useFilePreviewStore((state) => state.previews)
  const ensurePreviews = useFilePreviewStore((state) => state.ensurePreviews)
  const getPreviewKey = useFilePreviewStore((state) => state.getPreviewKey)
  const removePreview = useFilePreviewStore((state) => state.removePreview)
  const loadRecentlyDeleted = useRecentlyDeletedStore((state) => state.loadRecentlyDeleted)
  const moveToRecentlyDeleted = useRecentlyDeletedStore((state) => state.moveToRecentlyDeleted)
  const deletedCount = useRecentlyDeletedStore((state) => state.recentlyDeletedFiles.length)
  const [sortOpen, setSortOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; file: EditableFile } | null>(null)

  const selectedFolder = getFolderSelection(folders, activeFolderId)
  const isAllFiles = activeFolderId === 'all'
  const isRecentlyDeleted = activeFolderId === 'recently-deleted'
  const title = isAllFiles ? '全部文件' : isRecentlyDeleted ? '最近删除' : (selectedFolder?.name ?? '未选择资料夹')

  const files = useMemo(() => {
    if (isRecentlyDeleted) return []
    const source = isAllFiles
      ? folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id))
      : getDirectFilesForSelection(folders, activeFolderId)
    const needle = query.trim().toLocaleLowerCase()
    return source
      .filter((file) => {
        const preview = previews[getPreviewKey(file)]?.preview
        const previewText = `${preview?.title ?? ''} ${preview?.summary ?? ''}`.toLocaleLowerCase()
        return !needle
          || file.name.toLocaleLowerCase().includes(needle)
          || file.relativePath.toLocaleLowerCase().includes(needle)
          || previewText.includes(needle)
      })
      .sort((a, b) => {
        if (sortMode === 'updatedAt') return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
        if (sortMode === 'path') return a.path.localeCompare(b.path, 'zh-CN')
        return a.name.localeCompare(b.name, 'zh-CN')
      })
  }, [activeFolderId, folders, getPreviewKey, isAllFiles, isRecentlyDeleted, previews, query, sortMode])

  useEffect(() => {
    if (isRecentlyDeleted) return
    ensurePreviews(files, 0, FIRST_PREVIEW_COUNT)
  }, [ensurePreviews, files, isRecentlyDeleted])

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const pageHeight = Math.max(target.clientHeight, 1)
    const screen = Math.floor(target.scrollTop / pageHeight)
    if (screen < 1) return
    const start = FIRST_PREVIEW_COUNT + ((screen - 1) * PAGE_SIZE)
    ensurePreviews(files, start, PRELOAD_NEXT_PAGE_COUNT)
  }

  const openMenu = (event: MouseEvent, file: EditableFile) => {
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, file })
  }

  return (
    <div className="file-list-shell">
      <header className="file-list-header">
        <div>
          <span className="eyebrow">{isAllFiles ? '所有资料夹' : isRecentlyDeleted ? '删除缓冲区' : '当前资料夹'}</span>
          <h2>{title}</h2>
        </div>
        <span className="file-count">
          {isRecentlyDeleted ? deletedCount : files.length}
        </span>
      </header>

      {!isRecentlyDeleted && (
        <div className="file-list-tools">
          <label className="search-field">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isAllFiles ? '搜索文件名或已加载摘要' : `搜索“${title}”或已加载摘要`}
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
      )}

      {isRecentlyDeleted ? (
        <RecentlyDeletedPane />
      ) : (
        <div className="file-list" role="listbox" onScroll={handleListScroll}>
          {files.map((file) => (
            (() => {
              const preview = previews[getPreviewKey(file)]
              return (
                <FileCard
                  key={file.id}
                  file={file}
                  preview={preview?.preview}
                  previewStatus={preview?.status}
                  selected={activeFileId === file.id}
                  showParentFolder={isAllFiles}
                  onOpen={() => {
                    if (!isAllFiles && file.rootFolderId) selectFolder(activeFolderId ?? file.rootFolderId)
                    openFile(file.id)
                  }}
                  onContextMenu={(event) => openMenu(event, file)}
                />
              )
            })()
          ))}
          {files.length === 0 && <div className="list-empty">此资料夹没有直属的可打开文件</div>}
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpenInFinder={() => {
            void revealInFinder(menu.file.path)
              .then(() => showToast('已在访达中显示'))
              .catch(() => showToast(`阶段 A Mock：在访达中显示 ${menu.file.name}`))
              .finally(() => setMenu(null))
          }}
          onCopyPath={() => {
            void navigator.clipboard.writeText(menu.file.path)
            showToast('已复制 Mock 路径')
            setMenu(null)
          }}
          onRename={() => {
            const name = window.prompt('重命名文件', menu.file.name)
            if (name) {
              void renameFile(menu.file.id, name).then(() => showToast('已重命名文件'))
            }
            setMenu(null)
          }}
          onDelete={() => {
            void (async () => {
              const root = folders.find((folder) => folder.id === menu.file.rootFolderId)
              if (!root || !menu.file.rootFolderId) return
              const parentId = findParentFolderId(root.tree ?? [], menu.file.id)
              if (isTauriRuntime()) {
                await movePathToRecentlyDeleted(menu.file.path, root.path)
                await refreshRootFolder(root.id)
                await loadRecentlyDeleted(folders.map((folder) => folder.path))
              } else {
                moveToRecentlyDeleted({
                  id: menu.file.id,
                  name: menu.file.name,
                  originalPath: menu.file.path,
                  originalRootFolderId: menu.file.rootFolderId,
                  originalParentId: parentId,
                  deletedAt: new Date().toISOString(),
                  extension: menu.file.extension,
                  kind: 'file',
                  editable: menu.file.editable,
                  node: {
                    id: menu.file.id,
                    name: menu.file.name,
                    path: menu.file.path,
                    kind: 'file',
                    extension: menu.file.extension,
                  },
                })
                removeFile(menu.file.id)
              }
              removePreview(menu.file.path)
              removeContent(menu.file.id)
              if (activeFileId === menu.file.id) closeFile()
              showToast('已移到最近删除')
            })()
            setMenu(null)
          }}
          deleteLabel="移到最近删除"
        />
      )}
    </div>
  )
}
