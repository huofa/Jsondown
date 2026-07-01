import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent, type UIEvent } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { useFileListStore } from '../stores/fileListStore'
import {
  FIRST_PREVIEW_COUNT,
  LAST_PREVIEW_COUNT,
  PAGE_SIZE,
  PRELOAD_NEXT_PAGE_COUNT,
  PRELOAD_PREVIOUS_PAGE_COUNT,
  useFilePreviewStore,
} from '../stores/filePreviewStore'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useOpenedFileCacheStore } from '../stores/openedFileCacheStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import {
  isTauriRuntime,
  moveToRecentlyDeleted as movePathToRecentlyDeleted,
  revealInFinder,
  searchWorkspace,
  type FilePreviewPayload,
  type WorkspaceSearchResult,
} from '../services/tauriFileService'
import type { EditableFile, SortMode } from '../types/file'
import { findParentFolderId, getDirectFilesForSelection, getFolderSelection } from '../utils/folderSelection'
import { flattenFiles } from '../utils/flattenFiles'
import { startWindowDrag } from '../utils/windowDrag'
import { CODE_TEXT_EXTENSIONS, MARKDOWN_EXTENSIONS } from '../utils/fileFilters'
import { ContextMenu } from './ContextMenu'
import { FileCard } from './FileCard'
import { RecentlyDeletedPane } from './RecentlyDeletedPane'
import { RenameDialog } from './RenameDialog'
import { showToast } from './Toast'

const sortLabels: Record<SortMode, string> = {
  'updatedAt-desc': '修改时间 ↓',
  'updatedAt-asc': '修改时间 ↑',
  'createdAt-desc': '创建时间 ↓',
  'createdAt-asc': '创建时间 ↑',
  'name-asc': '文件名 A-Z',
  'name-desc': '文件名 Z-A',
  path: '路径',
}

const SEARCHABLE_TEXT_EXTENSIONS = new Set([
  'md',
  'markdown',
  'txt',
  'text',
  'json',
  'yaml',
  'yml',
  'html',
  'htm',
  'css',
  'js',
  'jsx',
  'ts',
  'tsx',
])

type SearchAnchorDetail = {
  fileId: string
  query: string
  matchText: string
  firstMatchLine: number
  firstMatchColumn: number
  firstMatchByte: number
}

const sortFiles = (files: EditableFile[], sortMode: SortMode) =>
  [...files].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (sortMode === 'updatedAt-desc') return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    if (sortMode === 'updatedAt-asc') return (a.updatedAt ?? '').localeCompare(b.updatedAt ?? '')
    if (sortMode === 'createdAt-desc') return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    if (sortMode === 'createdAt-asc') return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    if (sortMode === 'path') return a.path.localeCompare(b.path, 'zh-CN')
    if (sortMode === 'name-desc') return b.name.localeCompare(a.name, 'zh-CN')
    return a.name.localeCompare(b.name, 'zh-CN')
  })

export function FlatFileListPane() {
  const folders = useRootFolderStore((state) => state.folders)
  const activeFolderId = useRootFolderStore((state) => state.activeFolderId)
  const renameFile = useRootFolderStore((state) => state.renameFile)
  const duplicateFile = useRootFolderStore((state) => state.duplicateFile)
  const togglePinnedFile = useRootFolderStore((state) => state.togglePinnedFile)
  const removeFile = useRootFolderStore((state) => state.removeFile)
  const refreshRootFolder = useRootFolderStore((state) => state.refreshRootFolder)
  const selectFolder = useRootFolderStore((state) => state.selectFolder)
  const { query, sortMode, setQuery, setSortMode } = useFileListStore()
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const requestOpenFile = useEditorStore((state) => state.requestOpenFile)
  const pendingEmptyFile = useEditorStore((state) => state.pendingEmptyFile)
  const runAfterPendingCleanup = useEditorStore((state) => state.runAfterPendingCleanup)
  const removeContent = useEditorStore((state) => state.removeContent)
  const closeFile = useEditorStore((state) => state.closeFile)
  const previews = useFilePreviewStore((state) => state.previews)
  const ensurePreviews = useFilePreviewStore((state) => state.ensurePreviews)
  const getPreviewKey = useFilePreviewStore((state) => state.getPreviewKey)
  const removePreview = useFilePreviewStore((state) => state.removePreview)
  const preloadReadonlyFile = useOpenedFileCacheStore((state) => state.openReadonlyFile)
  const loadRecentlyDeleted = useRecentlyDeletedStore((state) => state.loadRecentlyDeleted)
  const moveToRecentlyDeleted = useRecentlyDeletedStore((state) => state.moveToRecentlyDeleted)
  const deletedCount = useRecentlyDeletedStore((state) => state.recentlyDeletedFiles.length)
  const [sortOpen, setSortOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number; file: EditableFile } | null>(null)
  const [renameTarget, setRenameTarget] = useState<EditableFile | null>(null)
  const [searchResults, setSearchResults] = useState<WorkspaceSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const fileCardRefs = useRef(new Map<string, HTMLDivElement>())
  const candidatePreloadTimerRef = useRef<number | undefined>(undefined)

  const selectedFolder = getFolderSelection(folders, activeFolderId)
  const isAllFiles = activeFolderId === 'all'
  const isRecentlyDeleted = activeFolderId === 'recently-deleted'
  const title = isAllFiles ? '全部文件' : isRecentlyDeleted ? '最近删除' : (selectedFolder?.name ?? '未选择资料夹')
  const allFiles = useMemo(
    () => folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id)),
    [folders],
  )
  const selectedRoot = folders.find((folder) => folder.id === activeFolderId)
  const selectedPath = isAllFiles
    ? null
    : selectedRoot?.path ?? (selectedFolder?.id && selectedFolder.id !== 'recently-deleted' ? selectedFolder.id : null)
  const defaultSourceFiles = useMemo(() => {
    if (isRecentlyDeleted) return []
    return isAllFiles
      ? allFiles
      : getDirectFilesForSelection(folders, activeFolderId)
  }, [activeFolderId, allFiles, folders, isAllFiles, isRecentlyDeleted])
  const searchScopeFiles = useMemo(() => {
    if (isRecentlyDeleted) return []
    const source = isAllFiles
      ? allFiles
      : allFiles.filter((file) => selectedPath && (
        file.path === selectedPath || file.path.startsWith(`${selectedPath}/`)
      ))
    return source.filter((file) => SEARCHABLE_TEXT_EXTENSIONS.has(file.extension.toLowerCase()))
  }, [allFiles, isAllFiles, isRecentlyDeleted, selectedPath])

  const files = useMemo(() => {
    if (isRecentlyDeleted) return []
    const needle = query.trim().toLocaleLowerCase()
    if (needle) {
      const byPath = new Map(allFiles.map((file) => [file.path, file]))
      const resultByPath = new Map(searchResults.map((result) => [result.path, result]))
      const matched = searchResults
        .map((result) => byPath.get(result.path))
        .filter(Boolean) as EditableFile[]
      return sortFiles(matched, sortMode)
        .sort((a, b) => {
          const aRank = resultByPath.get(a.path)?.matchType === 'exact' ? 0 : 1
          const bRank = resultByPath.get(b.path)?.matchType === 'exact' ? 0 : 1
          return aRank - bRank
        })
    }
    return sortFiles(defaultSourceFiles
      .filter((file) => {
        const preview = previews[getPreviewKey(file)]?.preview
        const previewText = `${preview?.title ?? ''} ${preview?.summary ?? ''}`.toLocaleLowerCase()
        return !needle
          || file.name.toLocaleLowerCase().includes(needle)
          || file.relativePath.toLocaleLowerCase().includes(needle)
          || previewText.includes(needle)
      })
    , sortMode)
  }, [allFiles, defaultSourceFiles, getPreviewKey, isRecentlyDeleted, previews, query, searchResults, sortMode])
  const searchPreviewByPath = useMemo(() => {
    const map = new Map<string, FilePreviewPayload>()
    searchResults.forEach((result) => {
      map.set(result.path, {
        path: result.path,
        title: result.name,
        summary: result.snippet || `第 ${result.firstMatchLine} 行命中`,
        updatedAt: result.updatedAt,
      })
    })
    return map
  }, [searchResults])

  const isCandidatePreloadFile = (file: EditableFile) => {
    if (!file.editable || file.kind === 'image') return false
    const extension = file.extension.toLowerCase()
    return MARKDOWN_EXTENSIONS.has(extension) || CODE_TEXT_EXTENSIONS.has(extension)
  }

  const preloadCandidateChunks = (candidates: EditableFile[]) => {
    candidates
      .filter(isCandidatePreloadFile)
      .slice(0, 5)
      .forEach((file) => {
        void preloadReadonlyFile(file).catch((error) => {
          if (import.meta.env.DEV) console.warn('[candidate-preload:failed]', { path: file.path, error })
        })
      })
  }

  useEffect(() => {
    const value = query.trim()
    if (!value || isRecentlyDeleted) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let disposed = false
    setSearchLoading(true)
    setSearchResults([])
    const timer = window.setTimeout(() => {
      void searchWorkspace(searchScopeFiles.map((file) => file.path), value)
        .then((results) => {
          if (!disposed) setSearchResults(results)
        })
        .catch((error) => {
          if (import.meta.env.DEV) console.warn('[workspace-search:failed]', error)
          if (!disposed) setSearchResults([])
        })
        .finally(() => {
          if (!disposed) setSearchLoading(false)
        })
    }, 180)

    return () => {
      disposed = true
      window.clearTimeout(timer)
    }
  }, [isRecentlyDeleted, query, searchScopeFiles])

  useEffect(() => {
    if (isRecentlyDeleted || query.trim()) return
    ensurePreviews(files, 0, FIRST_PREVIEW_COUNT)
    ensurePreviews(files, Math.max(0, files.length - LAST_PREVIEW_COUNT), LAST_PREVIEW_COUNT)
  }, [ensurePreviews, files, isRecentlyDeleted, query])

  useEffect(() => {
    window.clearTimeout(candidatePreloadTimerRef.current)
    if (isRecentlyDeleted || query.trim()) return
    candidatePreloadTimerRef.current = window.setTimeout(() => {
      preloadCandidateChunks(files.slice(0, 3))
    }, 1000)
    return () => window.clearTimeout(candidatePreloadTimerRef.current)
  }, [files, isRecentlyDeleted, query])

  useEffect(() => {
    setQuery('')
    setSortOpen(false)
    setMenu(null)
    if (listRef.current) listRef.current.scrollTop = 0
  }, [activeFolderId, setQuery])

  useEffect(() => {
    if (!sortOpen) return
    const closeSort = (event: globalThis.MouseEvent) => {
      if (!sortRef.current?.contains(event.target as Node)) setSortOpen(false)
    }
    const closeOnBlur = () => setSortOpen(false)
    window.addEventListener('mousedown', closeSort)
    window.addEventListener('blur', closeOnBlur)
    return () => {
      window.removeEventListener('mousedown', closeSort)
      window.removeEventListener('blur', closeOnBlur)
    }
  }, [sortOpen])

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const pageHeight = Math.max(target.clientHeight, 1)
    const screen = Math.floor(target.scrollTop / pageHeight)
    const currentPageStart = screen * PAGE_SIZE
    ensurePreviews(files, currentPageStart - PAGE_SIZE, PRELOAD_PREVIOUS_PAGE_COUNT)
    ensurePreviews(files, currentPageStart + PAGE_SIZE, PRELOAD_NEXT_PAGE_COUNT)

    window.clearTimeout(candidatePreloadTimerRef.current)
    if (!query.trim() && !isRecentlyDeleted) {
      candidatePreloadTimerRef.current = window.setTimeout(() => {
        const center = Math.max(0, Math.min(files.length - 1, currentPageStart + Math.floor(PAGE_SIZE / 2)))
        preloadCandidateChunks(files.slice(Math.max(0, center - 2), center + 3))
      }, 500)
    }
  }

  const openMenu = (event: MouseEvent, file: EditableFile) => {
    event.preventDefault()
    event.stopPropagation()
    window.getSelection()?.removeAllRanges()
    setMenu({ x: event.clientX, y: event.clientY, file })
  }

  const activeFileIndex = files.findIndex((file) => file.id === activeFileId)

  useEffect(() => {
    if (!activeFileId) return
    const list = listRef.current
    const target = fileCardRefs.current.get(activeFileId)
    if (!list || !target) return
    window.requestAnimationFrame(() => {
      const listRect = list.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      const isFullyVisible = targetRect.top >= listRect.top && targetRect.bottom <= listRect.bottom
      if (isFullyVisible) return
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }, [activeFileId, activeFileIndex, activeFolderId, query, sortMode])

  return (
    <div className="file-list-shell">
      <header className="file-list-header" data-tauri-drag-region onPointerDownCapture={startWindowDrag}>
        <div className="file-list-title-zone" data-tauri-drag-region>
          <span className="eyebrow" data-tauri-drag-region>{isAllFiles ? '所有资料夹' : isRecentlyDeleted ? '删除缓冲区' : '当前资料夹'}</span>
          <h2 data-tauri-drag-region>{title}</h2>
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
              placeholder={isAllFiles ? '搜索全部文件内容' : `搜索“${title}”下的文件内容`}
            />
          </label>
          <div className="sort-control" ref={sortRef}>
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
        <div ref={listRef} className="file-list" role="listbox" onScroll={handleListScroll}>
          {files.map((file) => (
            (() => {
              const preview = previews[getPreviewKey(file)]
              return (
                <div
                  key={file.id}
                  ref={(element) => {
                    if (element) fileCardRefs.current.set(file.id, element)
                    else fileCardRefs.current.delete(file.id)
                  }}
                >
                  <FileCard
                    file={file}
                    preview={query.trim() ? searchPreviewByPath.get(file.path) : preview?.preview}
                    previewStatus={query.trim() ? (searchLoading ? 'loading' : 'idle') : preview?.status}
                    selected={activeFileId === file.id}
                    showParentFolder={isAllFiles}
                    onOpen={() => {
                      if (activeFileId === file.id && document.body.classList.contains('jsondown-editor-mode-editing')) {
                        window.dispatchEvent(new CustomEvent('jsondown:exit-editing'))
                        return
                      }
                      const openTarget = () => {
                        if (!isAllFiles && file.rootFolderId) selectFolder(activeFolderId ?? file.rootFolderId)
                        void requestOpenFile(file.id, allFiles).then((opened) => {
                          const value = query.trim()
                          const result = searchResults.find((item) => item.path === file.path)
                          if (!opened || !value || !result) return
                          const detail: SearchAnchorDetail = {
                            fileId: file.id,
                            query: value,
                            matchText: value,
                            firstMatchLine: result.firstMatchLine,
                            firstMatchColumn: result.firstMatchColumn,
                            firstMatchByte: result.firstMatchByte,
                          }
                          window.dispatchEvent(new CustomEvent('jsondown:workspace-search-open', { detail }))
                        })
                      }
                      if (pendingEmptyFile?.id === file.id) {
                        openTarget()
                        return
                      }
                      void runAfterPendingCleanup(() => {
                        openTarget()
                      })
                    }}
                    onContextMenu={(event) => openMenu(event, file)}
                  />
                </div>
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
          onDuplicate={() => {
            void duplicateFile(menu.file.id)
              .then(async (nextId) => {
                const root = folders.find((folder) => folder.id === menu.file.rootFolderId)
                if (root && isTauriRuntime()) await refreshRootFolder(root.id)
                showToast(nextId ? '已在同一文件夹复制文件' : '复制失败')
              })
              .catch(() => showToast('复制文件失败'))
            setMenu(null)
          }}
          onTogglePin={() => {
            togglePinnedFile(menu.file.id)
            showToast(menu.file.pinned ? '已取消置顶' : '已置顶文件')
            setMenu(null)
          }}
          pinLabel={menu.file.pinned ? '取消置顶' : '置顶文件'}
          onRename={() => {
            setRenameTarget(menu.file)
            setMenu(null)
          }}
          onDelete={() => {
            void (async () => {
              const root = folders.find((folder) => folder.id === menu.file.rootFolderId)
              if (!root || !menu.file.rootFolderId) return
              const parentId = findParentFolderId(root.tree ?? [], menu.file.id)
              if (isTauriRuntime()) {
                const deleted = await movePathToRecentlyDeleted(menu.file.path, root.path)
                moveToRecentlyDeleted({
                  ...deleted,
                  originalRootFolderId: menu.file.rootFolderId,
                  originalParentId: parentId,
                  editable: menu.file.editable,
                  node: {
                    id: menu.file.id,
                    name: menu.file.name,
                    path: menu.file.path,
                    kind: 'file',
                    extension: menu.file.extension,
                  },
                })
                await refreshRootFolder(root.id)
                await loadRecentlyDeleted(useRootFolderStore.getState().folders.map((folder) => folder.path))
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
      <RenameDialog
        open={Boolean(renameTarget)}
        title="重命名文件"
        kind="file"
        initialName={renameTarget?.name ?? ''}
        onClose={() => setRenameTarget(null)}
        onRename={async (name) => {
          if (!renameTarget) return
          const nextId = await renameFile(renameTarget.path, name)
          if (nextId && activeFileId === renameTarget.id) {
            removeContent(renameTarget.id)
            void requestOpenFile(nextId, allFiles)
          }
          showToast('已重命名文件')
        }}
      />
    </div>
  )
}
