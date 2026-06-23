import type { EditableFile } from '../types/file'
import type { FileTreeNode } from '../types/fileTree'
import type { RootFolder } from '../types/rootFolder'
import { getFileKind, isEditableFile, isViewableFile, normalizeExtension } from './fileFilters'
import { mockFileMeta } from './mockFileSystem'

export type FolderSelection = {
  id: string
  name: string
  rootFolderId: string
  nodes: FileTreeNode[]
}

function directFiles(nodes: FileTreeNode[], rootPath: string, rootFolderId: string): EditableFile[] {
  return nodes.flatMap((node) => {
    if (node.kind !== 'file' || !isViewableFile(node.name)) return []
    const extension = normalizeExtension(node.name)
    const meta = mockFileMeta[node.path]
    return [{
      id: node.id,
      rootFolderId,
      name: node.name,
      path: node.path,
      relativePath: node.path.replace(`${rootPath}/`, ''),
      extension,
      kind: getFileKind(extension),
      editable: isEditableFile(node.name),
      createdAt: meta?.createdAt,
      updatedAt: meta?.updatedAt,
      size: meta?.size,
    }]
  })
}

export function getDirectFilesForSelection(
  folders: RootFolder[],
  selectedFolderId: string | null,
): EditableFile[] {
  const root = folders.find((folder) => folder.id === selectedFolderId)
  if (root) return directFiles(root.tree ?? [], root.path, root.id)

  for (const folder of folders) {
    const queue = [...(folder.tree ?? [])]
    while (queue.length) {
      const node = queue.shift()!
      if (node.kind === 'directory') {
        if (node.id === selectedFolderId) {
          return directFiles(node.children ?? [], folder.path, folder.id)
        }
        queue.push(...(node.children ?? []))
      }
    }
  }
  return []
}

export function getFolderSelection(
  folders: RootFolder[],
  selectedFolderId: string | null,
): FolderSelection | null {
  const root = folders.find((folder) => folder.id === selectedFolderId)
  if (root) return { id: root.id, name: root.name, rootFolderId: root.id, nodes: root.tree ?? [] }

  for (const folder of folders) {
    const queue = [...(folder.tree ?? [])]
    while (queue.length) {
      const node = queue.shift()!
      if (node.kind !== 'directory') continue
      if (node.id === selectedFolderId) {
        return {
          id: node.id,
          name: node.name,
          rootFolderId: folder.id,
          nodes: node.children ?? [],
        }
      }
      queue.push(...(node.children ?? []))
    }
  }
  return null
}

export function findParentFolderId(nodes: FileTreeNode[], fileId: string, parentId?: string): string | undefined {
  for (const node of nodes) {
    if (node.id === fileId) return parentId
    if (node.kind === 'directory') {
      const result = findParentFolderId(node.children ?? [], fileId, node.id)
      if (result) return result
    }
  }
  return undefined
}
