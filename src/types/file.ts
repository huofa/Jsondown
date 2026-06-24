export type EditableFileKind =
  | 'markdown'
  | 'code'
  | 'image'
  | 'text'
  | 'html'
  | 'json'

export type EditableFile = {
  id: string
  rootFolderId?: string
  name: string
  path: string
  relativePath: string
  extension: string
  kind: EditableFileKind
  editable: boolean
  parentFolderName?: string
  parentFolderPath?: string
  createdAt?: string
  updatedAt?: string
  size?: number
}

export type SortMode =
  | 'updatedAt-desc'
  | 'updatedAt-asc'
  | 'createdAt-desc'
  | 'createdAt-asc'
  | 'name-asc'
  | 'name-desc'
  | 'path'
