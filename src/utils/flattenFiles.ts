import type { EditableFile } from '../types/file'
import type { FileTreeNode } from '../types/fileTree'
import { getFileKind, isEditableFile, isViewableFile, normalizeExtension } from './fileFilters'
import { mockFileMeta } from './mockFileSystem'

export function flattenFiles(nodes: FileTreeNode[], rootPath: string): EditableFile[] {
  const files: EditableFile[] = []

  const walk = (items: FileTreeNode[]) => {
    items.forEach((node) => {
      if (node.kind === 'directory') {
        walk(node.children ?? [])
        return
      }
      if (!isViewableFile(node.name)) return

      const extension = normalizeExtension(node.name)
      const meta = mockFileMeta[node.path]
      files.push({
        id: node.id,
        name: node.name,
        path: node.path,
        relativePath: node.path.replace(`${rootPath}/`, ''),
        extension,
        kind: getFileKind(extension),
        editable: isEditableFile(node.name),
        updatedAt: meta?.updatedAt,
        size: meta?.size,
      })
    })
  }

  walk(nodes)
  return files
}
