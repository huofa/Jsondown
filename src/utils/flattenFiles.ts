import type { EditableFile } from '../types/file'
import type { FileTreeNode } from '../types/fileTree'
import { getFileKind, isEditableFile, isViewableFile, normalizeExtension } from './fileFilters'
import { mockFileMeta } from './mockFileSystem'

export function flattenFiles(nodes: FileTreeNode[], rootPath: string, rootFolderId?: string): EditableFile[] {
  const files: EditableFile[] = []

  const rootFolderName = rootPath.split('/').filter(Boolean).pop() ?? rootPath
  const walk = (items: FileTreeNode[], parentFolderName: string, parentFolderPath: string) => {
    items.forEach((node) => {
      if (node.kind === 'directory') {
        walk(node.children ?? [], node.name, node.path)
        return
      }
      if (!isViewableFile(node.name)) return

      const extension = normalizeExtension(node.name)
      const meta = mockFileMeta[node.path]
      files.push({
        id: node.id,
        rootFolderId,
        name: node.name,
        path: node.path,
        relativePath: node.path.replace(`${rootPath}/`, ''),
        extension,
        kind: getFileKind(extension),
        editable: isEditableFile(node.name),
        parentFolderName,
        parentFolderPath,
        createdAt: node.createdAt ?? meta?.createdAt,
        updatedAt: node.updatedAt ?? meta?.updatedAt,
        size: node.size ?? meta?.size,
        pinned: node.pinned,
      })
    })
  }

  walk(nodes, rootFolderName, rootPath)
  return files
}
