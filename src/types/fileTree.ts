export type FileTreeNode = {
  id: string
  name: string
  path: string
  kind: 'file' | 'directory'
  extension?: string
  children?: FileTreeNode[]
  updatedAt?: string
  createdAt?: string
  size?: number
}
