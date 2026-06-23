import type { FileTreeNode } from '../types/fileTree'

export function countFiles(nodes: FileTreeNode[]): number {
  return nodes.reduce(
    (count, node) =>
      count + (node.kind === 'directory' ? countFiles(node.children ?? []) : 1),
    0,
  )
}
