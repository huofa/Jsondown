import { ChevronDown, ChevronRight, File, FileCode2, FileImage, Folder, FolderOpen, MoreHorizontal } from 'lucide-react'
import { useMemo, useState, type MouseEvent } from 'react'
import type { FileTreeNode } from '../types/fileTree'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { useEditorStore } from '../stores/editorStore'
import { useRecentlyDeletedStore } from '../stores/recentlyDeletedStore'
import { useRootFolderStore } from '../stores/rootFolderStore'
import {
  isTauriRuntime,
  moveToRecentlyDeleted as movePathToRecentlyDeleted,
  revealInFinder,
} from '../services/tauriFileService'
import { isViewableFile } from '../utils/fileFilters'
import { countViewableFiles, findParentFolderId } from '../utils/folderSelection'
import { flattenFiles } from '../utils/flattenFiles'
import { ContextMenu } from './ContextMenu'
import { RenameDialog } from './RenameDialog'
import { showToast } from './Toast'

type FolderTreeProps = {
  nodes: FileTreeNode[]
  depth?: number
  rootFolderId?: string
  parentFolderId?: string
}

function TreeFileIcon({ extension }: { extension?: string }) {
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension ?? '')) return <FileImage size={14} />
  if (!['md', 'markdown', 'txt'].includes(extension ?? '')) return <FileCode2 size={14} />
  return <File size={14} />
}

export function FolderTree({ nodes, depth = 0, rootFolderId, parentFolderId }: FolderTreeProps) {
  const expandedIds = useFileTreeStore((state) => state.expandedIds)
  const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded)
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const requestOpenFile = useEditorStore((state) => state.requestOpenFile)
  const closeFile = useEditorStore((state) => state.closeFile)
  const pendingEmptyFile = useEditorStore((state) => state.pendingEmptyFile)
  const contents = useEditorStore((state) => state.contents)
  const runAfterPendingCleanup = useEditorStore((state) => state.runAfterPendingCleanup)
  const folders = useRootFolderStore((state) => state.folders)
  const {
    activeFolderId,
    createMockFile,
    createMockSubfolder,
    duplicateFile,
    removeTreeNode,
    renameFile,
    renameTreeFolder,
    refreshRootFolder,
    selectFolder,
    togglePinnedFile,
  } = useRootFolderStore()
  const loadRecentlyDeleted = useRecentlyDeletedStore((state) => state.loadRecentlyDeleted)
  const moveToRecentlyDeleted = useRecentlyDeletedStore((state) => state.moveToRecentlyDeleted)
  const [menu, setMenu] = useState<{ x: number; y: number; node: FileTreeNode } | null>(null)
  const [renameTarget, setRenameTarget] = useState<FileTreeNode | null>(null)
  const newFileLocked = Boolean(pendingEmptyFile && !(contents[pendingEmptyFile.id] ?? '').trim())
  const allFiles = useMemo(
    () => folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id)),
    [folders],
  )
  const orderedNodes = useMemo(
    () => [...nodes].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      if (a.kind === 'file' && b.kind === 'file' && a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    }),
    [nodes],
  )
  const latestAllFiles = () => useRootFolderStore
    .getState()
    .folders.flatMap((folder) => flattenFiles(folder.tree ?? [], folder.path, folder.id))

  const openFolderMenu = (event: MouseEvent, node: FileTreeNode) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, node })
  }

  return (
    <div className="folder-tree" role={depth === 0 ? 'tree' : 'group'}>
      {orderedNodes.map((node) => {
        const expanded = expandedIds.has(node.id)
        if (node.kind === 'directory') {
          const fileCount = countViewableFiles(node.children ?? [])
          return (
            <div key={node.id}>
              <div className={`tree-row-shell ${activeFolderId === node.id ? 'is-folder-active' : ''}`}>
                <button
                  className="tree-row tree-folder-row"
                  style={{ paddingLeft: 10 + depth * 14 }}
                  onClick={() => {
                    void runAfterPendingCleanup(() => {
                      selectFolder(node.id)
                      toggleExpanded(node.id)
                    })
                  }}
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                  <span>{node.name}</span>
                </button>
                <button className="row-action tree-row-action" title="文件夹菜单" onClick={(event) => openFolderMenu(event, node)}>
                  <MoreHorizontal size={13} />
                </button>
                <em className="sidebar-count tree-count">{fileCount}</em>
              </div>
              {expanded && (
                <FolderTree
                  nodes={node.children ?? []}
                  depth={depth + 1}
                  rootFolderId={rootFolderId}
                  parentFolderId={node.id}
                />
              )}
            </div>
          )
        }

        if (!isViewableFile(node.name)) return null
        return (
          <button
            key={node.id}
            className={`tree-row tree-file ${activeFileId === node.id ? 'is-active' : ''}`}
            style={{ paddingLeft: 27 + depth * 14 }}
            onClick={() => {
              const openTarget = () => {
                selectFolder(parentFolderId ?? rootFolderId ?? 'all')
                void requestOpenFile(node.id, allFiles)
              }
              if (pendingEmptyFile?.id === node.id) {
                openTarget()
                return
              }
              void runAfterPendingCleanup(() => {
                openTarget()
              })
            }}
            onContextMenu={(event) => openFolderMenu(event, node)}
            title={node.path}
          >
            <TreeFileIcon extension={node.extension} />
            <span>{node.name}</span>
          </button>
        )
      })}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onOpenInFinder={() => {
            void revealInFinder(menu.node.path)
              .then(() => showToast('已在访达中打开'))
              .catch(() => showToast(`阶段 A Mock：在访达中打开 ${menu.node.path}`))
              .finally(() => setMenu(null))
          }}
          onRename={() => {
            setRenameTarget(menu.node)
            setMenu(null)
          }}
          onDuplicate={menu.node.kind === 'file' ? () => {
            void duplicateFile(menu.node.id)
              .then(async (nextId) => {
                if (rootFolderId && isTauriRuntime()) await refreshRootFolder(rootFolderId)
                showToast(nextId ? '已在同一文件夹复制文件' : '复制失败')
              })
              .catch(() => showToast('复制文件失败'))
            setMenu(null)
          } : undefined}
          onTogglePin={menu.node.kind === 'file' ? () => {
            togglePinnedFile(menu.node.id)
            showToast(menu.node.pinned ? '已取消置顶' : '已置顶文件')
            setMenu(null)
          } : undefined}
          pinLabel={menu.node.pinned ? '取消置顶' : '置顶文件'}
          onNewFolder={menu.node.kind === 'directory' ? () => {
            const name = window.prompt('新建文件夹名称', '新建文件夹')
            void createMockSubfolder(menu.node.id, name ?? undefined)
              .then((id) => { if (id) showToast(`已在“${menu.node.name}”下新建文件夹`) })
            setMenu(null)
          } : undefined}
          onNewFile={menu.node.kind === 'directory' ? () => {
            void createMockFile(menu.node.id).then((id) => {
              if (id) {
                void requestOpenFile(id, latestAllFiles())
                showToast(`已在“${menu.node.name}”下新建文件`)
              }
            })
            setMenu(null)
          } : undefined}
          newFileDisabled={newFileLocked}
          newFileDisabledTitle="请先输入内容，或切换后自动清理当前空文件"
          onDelete={() => {
            void (async () => {
              const root = folders.find((folder) => folder.id === rootFolderId)
              if (!root || !rootFolderId) return
              const parentId = findParentFolderId(root.tree ?? [], menu.node.id)
              if (isTauriRuntime()) {
                const deleted = await movePathToRecentlyDeleted(menu.node.path, root.path)
                moveToRecentlyDeleted({
                  ...deleted,
                  originalRootFolderId: rootFolderId,
                  originalParentId: parentId,
                  extension: menu.node.extension ?? deleted.extension,
                  editable: menu.node.kind === 'file' && isViewableFile(menu.node.name),
                  node: menu.node,
                })
                await refreshRootFolder(root.id)
                await loadRecentlyDeleted(useRootFolderStore.getState().folders.map((folder) => folder.path))
              } else {
                moveToRecentlyDeleted({
                  id: menu.node.id,
                  name: menu.node.name,
                  originalPath: menu.node.path,
                  originalRootFolderId: rootFolderId,
                  originalParentId: parentId,
                  deletedAt: new Date().toISOString(),
                  extension: menu.node.extension ?? '',
                  kind: menu.node.kind,
                  editable: false,
                  content: '',
                  node: menu.node,
                })
                removeTreeNode(menu.node.id)
              }
              if (activeFileId === menu.node.id) closeFile()
              showToast(menu.node.kind === 'directory' ? '已将文件夹移到最近删除' : '已将文件移到最近删除')
            })()
            setMenu(null)
          }}
          deleteLabel="移到最近删除"
        />
      )}
      <RenameDialog
        open={Boolean(renameTarget)}
        title={renameTarget?.kind === 'directory' ? '重命名文件夹' : '重命名文件'}
        kind={renameTarget?.kind ?? 'file'}
        initialName={renameTarget?.name ?? ''}
        onClose={() => setRenameTarget(null)}
        onRename={async (name) => {
          if (!renameTarget) return
          if (renameTarget.kind === 'directory') {
            await renameTreeFolder(renameTarget.path, name)
            showToast('已重命名文件夹')
            return
          }
          const nextId = await renameFile(renameTarget.path, name)
          if (nextId && activeFileId === renameTarget.id) void requestOpenFile(nextId, allFiles)
          showToast('已重命名文件')
        }}
      />
    </div>
  )
}
