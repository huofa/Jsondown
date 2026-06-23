import type { FileTreeNode } from './fileTree'

export type DeletedFile = {
  id: string
  name: string
  kind: 'file' | 'directory'
  originalPath: string
  trashPath?: string
  originalRootFolderId?: string
  originalParentId?: string
  deletedAt: string
  extension?: string
  editable?: boolean
  content?: string
  node?: FileTreeNode
}
