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
  kind: EditableFile['kind']
  editable: boolean
  content: string
  node: FileTreeNode
}
