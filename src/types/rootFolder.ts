import type { FileTreeNode } from './fileTree'

export type RootFolder = {
  id: string
  name: string
  path: string
  order: number
  pinned?: boolean
  hidden?: boolean
  lastOpenedAt?: string
  tree?: FileTreeNode[]
}
