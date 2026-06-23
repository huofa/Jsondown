import { ChevronDown, ChevronRight, File, FileCode2, FileImage, Folder, FolderOpen, MoreHorizontal } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
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
import { ContextMenu } from './ContextMenu'
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
  const openFile = useEditorStore((state) => state.openFile)
  const closeFile = useEditorStore((state) => state.closeFile)
  const folders = useRootFolderStore((state) => state.folders)
  const {
    activeFolderId,
    createMockFile,
    createMockSubfolder,
    removeTreeNode,
    renameTreeFolder,
    refreshRootFolder,
    selectFolder,
  } = useRootFolderStore()
  const loadRecentlyDeleted = useRecentlyDeletedStore((state) => state.loadRecentlyDeleted)
  const moveToRecentlyDeleted = useRecentlyDeletedStore((state) => state.moveToRecentlyDeleted)
  const [menu, setMenu] = useState<{ x: number; y: number; node: FileTreeNode } | null>(null)

  const openFolderMenu = (event: MouseEvent, node: FileTreeNode) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY, node })
  }

  return (
    <div className="folder-tree" role={depth === 0 ? 'tree' : 'group'}>
      {nodes.map((node) => {
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
                    selectFolder(node.id)
                    toggleExpanded(node.id)
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
              selectFolder(parentFolderId ?? rootFolderId ?? 'all')
              openFile(node.id)
            }}
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
            const name = window.prompt('重命名文件夹', menu.node.name)
            if (name) {
              void renameTreeFolder(menu.node.id, name)
                .then(() => showToast('已重命名文件夹'))
            }
            setMenu(null)
          }}
          onNewFolder={() => {
            const name = window.prompt('新建文件夹名称', '新建文件夹')
            void createMockSubfolder(menu.node.id, name ?? undefined)
              .then((id) => { if (id) showToast(`已在“${menu.node.name}”下新建文件夹`) })
            setMenu(null)
          }}
          onNewFile={() => {
            const name = window.prompt('新建文件名称（不写后缀默认 .md）', '新建笔记.md')
            void createMockFile(menu.node.id, name ?? undefined).then((id) => {
              if (id) {
                openFile(id)
                showToast(`已在“${menu.node.name}”下新建文件`)
              }
            })
            setMenu(null)
          }}
          onDelete={() => {
            void (async () => {
              const root = folders.find((folder) => folder.id === rootFolderId)
              if (!root || !rootFolderId) return
              const parentId = findParentFolderId(root.tree ?? [], menu.node.id)
              if (isTauriRuntime()) {
                await movePathToRecentlyDeleted(menu.node.path, root.path)
                await refreshRootFolder(root.id)
                await loadRecentlyDeleted(folders.map((folder) => folder.path))
              } else {
                moveToRecentlyDeleted({
                  id: menu.node.id,
                  name: menu.node.name,
                  originalPath: menu.node.path,
                  originalRootFolderId: rootFolderId,
                  originalParentId: parentId,
                  deletedAt: new Date().toISOString(),
                  extension: '',
                  kind: 'directory',
                  editable: false,
                  content: '',
                  node: menu.node,
                })
                removeTreeNode(menu.node.id)
              }
              closeFile()
              showToast('已将文件夹移到最近删除')
            })()
            setMenu(null)
          }}
          deleteLabel="移到最近删除"
        />
      )}
    </div>
  )
}
