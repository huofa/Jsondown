import type { EditableFile } from './file'
import type { FileTreeNode } from './fileTree'

export type DeletedFile = {
  id: string
  name: string
  originalPath: string
  originalRootFolderId: string
  originalParentId?: string
  deletedAt: string
  extension: string
  kind: EditableFile['kind'] | 'directory'
  editable: boolean
  content: string
  node: FileTreeNode
}
