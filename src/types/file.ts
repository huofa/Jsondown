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
  createdAt?: string
  updatedAt?: string
  size?: number
}

export type SortMode = 'updatedAt' | 'name' | 'path'
