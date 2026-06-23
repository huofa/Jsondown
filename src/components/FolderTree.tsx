import { ChevronDown, ChevronRight, File, FileCode2, FileImage, Folder, FolderOpen } from 'lucide-react'
import type { FileTreeNode } from '../types/fileTree'
import { useFileTreeStore } from '../stores/fileTreeStore'
import { useEditorStore } from '../stores/editorStore'
import { isViewableFile } from '../utils/fileFilters'

type FolderTreeProps = {
  nodes: FileTreeNode[]
  depth?: number
}

function TreeFileIcon({ extension }: { extension?: string }) {
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension ?? '')) return <FileImage size={14} />
  if (!['md', 'markdown', 'txt'].includes(extension ?? '')) return <FileCode2 size={14} />
  return <File size={14} />
}

export function FolderTree({ nodes, depth = 0 }: FolderTreeProps) {
  const expandedIds = useFileTreeStore((state) => state.expandedIds)
  const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded)
  const activeFileId = useEditorStore((state) => state.activeFileId)
  const openFile = useEditorStore((state) => state.openFile)

  return (
    <div className="folder-tree" role={depth === 0 ? 'tree' : 'group'}>
      {nodes.map((node) => {
        const expanded = expandedIds.has(node.id)
        if (node.kind === 'directory') {
          return (
            <div key={node.id}>
              <button
                className="tree-row"
                style={{ paddingLeft: 10 + depth * 14 }}
                onClick={() => toggleExpanded(node.id)}
                aria-expanded={expanded}
              >
                {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
                <span>{node.name}</span>
              </button>
              {expanded && <FolderTree nodes={node.children ?? []} depth={depth + 1} />}
            </div>
          )
        }

        if (!isViewableFile(node.name)) return null
        return (
          <button
            key={node.id}
            className={`tree-row tree-file ${activeFileId === node.id ? 'is-active' : ''}`}
            style={{ paddingLeft: 27 + depth * 14 }}
            onClick={() => openFile(node.id)}
            title={node.path}
          >
            <TreeFileIcon extension={node.extension} />
            <span>{node.name}</span>
          </button>
        )
      })}
    </div>
  )
}
