import { create } from 'zustand'
import type { FileTreeNode } from '../types/fileTree'
import type { RootFolder } from '../types/rootFolder'
import { getFileKind, isEditableFile, normalizeExtension } from '../utils/fileFilters'
import { createMockFolder, mockFileContents, mockFileMeta, mockRootFolders } from '../utils/mockFileSystem'

type RootFolderState = {
  folders: RootFolder[]
  activeFolderId: string | null
  addMockFolder: (name?: string) => void
  importMockFile: (folderId: string) => string | null
  createMockDocument: (folderId?: string | null) => string | null
  createMockFile: (folderId: string | null | undefined, name?: string) => string | null
  createMockSubfolder: (folderId: string | null | undefined, name?: string) => string | null
  removeFolder: (id: string) => void
  renameFolder: (id: string, name: string) => void
  renameTreeFolder: (id: string, name: string) => void
  renameFile: (id: string, name: string) => void
  removeFile: (id: string) => void
  removeTreeNode: (id: string) => void
  restoreFile: (rootFolderId: string, parentId: string | undefined, node: NonNullable<RootFolder['tree']>[number]) => void
  selectFolder: (id: string) => void
  reorderFolders: (sourceId: string, targetId: string) => void
}

const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`

const extensionFor = (name: string) => normalizeExtension(name || '未命名.md') || 'md'

const fileNameFor = (name?: string) => {
  const trimmed = name?.trim() || '新建笔记'
  return trimmed.includes('.') ? trimmed : `${trimmed}.md`
}

const updateChildPaths = (node: FileTreeNode): FileTreeNode => ({
  ...node,
  children: node.children?.map((child) => updateChildPaths({
    ...child,
    path: `${node.path}/${child.name}`,
  })),
})

const insertNode = (
  nodes: FileTreeNode[],
  targetId: string,
  nodeFactory: (parentPath: string) => FileTreeNode,
): { nodes: FileTreeNode[]; createdId: string | null } => {
  let createdId: string | null = null
  const nextNodes = nodes.map((item) => {
    if (item.id === targetId && item.kind === 'directory') {
      const node = nodeFactory(item.path)
      createdId = node.id
      return { ...item, children: [node, ...(item.children ?? [])] }
    }
    if (!item.children) return item
    const result = insertNode(item.children, targetId, nodeFactory)
    if (result.createdId) createdId = result.createdId
    return { ...item, children: result.nodes }
  })
  return { nodes: nextNodes, createdId }
}

const removeNodeById = (nodes: FileTreeNode[], id: string): FileTreeNode[] =>
  nodes
    .filter((node) => node.id !== id)
    .map((node) => node.children ? { ...node, children: removeNodeById(node.children, id) } : node)

export const useRootFolderStore = create<RootFolderState>((set) => ({
  folders: mockRootFolders,
  activeFolderId: mockRootFolders[0]?.id ?? null,
  addMockFolder: (name) =>
    set((state) => {
      const folder = createMockFolder(state.folders.length + 1, name?.trim() || undefined)
      const note = folder.tree?.[0]
      if (note) mockFileContents[note.id] = '# 未命名笔记\n\n从这里开始写。'
      return { folders: [...state.folders, folder], activeFolderId: folder.id }
    }),
  importMockFile: (folderId) => {
    let createdId: string | null = null
    set((state) => ({
      folders: state.folders.map((folder) => {
        if (folder.id !== folderId) return folder
        createdId = `file-import-${Date.now()}`
        const name = '导入的笔记.md'
        mockFileContents[createdId] = '# 导入的笔记\n\n这是阶段 A 模拟导入的本地文件。'
        return {
          ...folder,
          tree: [...(folder.tree ?? []), {
            id: createdId,
            name,
            path: `${folder.path}/${name}`,
            kind: 'file' as const,
            extension: 'md',
          }],
        }
      }),
    }))
    return createdId
  },
  createMockDocument: (folderId) => {
    let createdId: string | null = null
    set((state) => {
      const targetId = folderId && folderId !== 'all' ? folderId : state.folders[0]?.id
      return {
        folders: state.folders.map((folder) => {
          if (folder.id !== targetId) return folder
          createdId = `file-note-${Date.now()}`
          const name = '新建笔记.md'
          mockFileContents[createdId] = '# 新建笔记\n\n'
          return {
            ...folder,
            tree: [{
              id: createdId,
              name,
              path: `${folder.path}/${name}`,
              kind: 'file' as const,
              extension: 'md',
            }, ...(folder.tree ?? [])],
          }
        }),
      }
    })
    return createdId
  },
  createMockFile: (folderId, rawName) => {
    let createdId: string | null = null
    const name = fileNameFor(rawName)
    const extension = extensionFor(name)
    set((state) => ({
      folders: state.folders.map((folder) => {
        const makeNode = (parentPath: string): FileTreeNode => {
          const id = uniqueId('file-new')
          const path = `${parentPath}/${name}`
          createdId = id
          mockFileMeta[path] = {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            size: 0,
          }
          mockFileContents[id] = isEditableFile(name)
            ? `# ${name.replace(/\.(md|markdown)$/i, '')}\n\n`
            : getFileKind(extension) === 'json'
              ? '{\n  "createdBy": "Jsondown mock"\n}'
              : ''
          return { id, name, path, kind: 'file', extension }
        }

        if (!folderId || folderId === 'all' || folder.id === folderId) {
          const node = makeNode(folder.path)
          return { ...folder, tree: [node, ...(folder.tree ?? [])] }
        }

        const result = insertNode(folder.tree ?? [], folderId, makeNode)
        return result.createdId ? { ...folder, tree: result.nodes } : folder
      }),
      activeFolderId: folderId && folderId !== 'all' ? folderId : state.activeFolderId,
    }))
    return createdId
  },
  createMockSubfolder: (folderId, rawName) => {
    let createdId: string | null = null
    const name = rawName?.trim() || '新建文件夹'
    set((state) => ({
      folders: state.folders.map((folder) => {
        const makeNode = (parentPath: string): FileTreeNode => {
          const id = uniqueId('dir-new')
          createdId = id
          return {
            id,
            name,
            path: `${parentPath}/${name}`,
            kind: 'directory',
            children: [],
          }
        }

        if (!folderId || folderId === 'all' || folder.id === folderId) {
          const node = makeNode(folder.path)
          return { ...folder, tree: [node, ...(folder.tree ?? [])] }
        }

        const result = insertNode(folder.tree ?? [], folderId, makeNode)
        return result.createdId ? { ...folder, tree: result.nodes } : folder
      }),
      activeFolderId: createdId ?? state.activeFolderId,
    }))
    return createdId
  },
  removeFolder: (id) =>
    set((state) => {
      const folders = state.folders.filter((folder) => folder.id !== id)
      return {
        folders,
        activeFolderId:
          state.activeFolderId === id ? (folders[0]?.id ?? null) : state.activeFolderId,
      }
    }),
  renameFolder: (id, name) =>
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.id === id ? { ...folder, name: name.trim() || folder.name } : folder),
    })),
  renameTreeFolder: (id, name) =>
    set((state) => {
      const renameNodes = (nodes: FileTreeNode[]): FileTreeNode[] =>
        nodes.map((node) => {
          if (node.id === id && node.kind === 'directory') {
            const parent = node.path.slice(0, node.path.lastIndexOf('/'))
            return updateChildPaths({ ...node, name, path: `${parent}/${name}` })
          }
          return node.children ? { ...node, children: renameNodes(node.children) } : node
        })
      return {
        folders: state.folders.map((folder) => ({
          ...folder,
          tree: renameNodes(folder.tree ?? []),
        })),
      }
    }),
  renameFile: (id, name) =>
    set((state) => {
      const renameNodes = (nodes: NonNullable<RootFolder['tree']>): NonNullable<RootFolder['tree']> =>
        nodes.map((node) => {
          if (node.id === id) {
            const parent = node.path.slice(0, node.path.lastIndexOf('/'))
            return { ...node, name, path: `${parent}/${name}` }
          }
          return node.children ? { ...node, children: renameNodes(node.children) } : node
        })
      return {
        folders: state.folders.map((folder) => ({
          ...folder,
          tree: renameNodes(folder.tree ?? []),
        })),
      }
    }),
  removeFile: (id) =>
    set((state) => {
      return {
        folders: state.folders.map((folder) => ({
          ...folder,
          tree: removeNodeById(folder.tree ?? [], id),
        })),
      }
    }),
  removeTreeNode: (id) =>
    set((state) => ({
      folders: state.folders.map((folder) => ({
        ...folder,
        tree: removeNodeById(folder.tree ?? [], id),
      })),
      activeFolderId: state.activeFolderId === id ? 'all' : state.activeFolderId,
    })),
  restoreFile: (rootFolderId, parentId, node) =>
    set((state) => {
      const addToParent = (
        nodes: NonNullable<RootFolder['tree']>,
      ): { nodes: NonNullable<RootFolder['tree']>; restored: boolean } => {
        let restored = false
        const result = nodes.map((item) => {
          if (item.id === parentId && item.kind === 'directory') {
            restored = true
            return { ...item, children: [node, ...(item.children ?? [])] }
          }
          if (!item.children) return item
          const childResult = addToParent(item.children)
          restored ||= childResult.restored
          return { ...item, children: childResult.nodes }
        })
        return { nodes: result, restored }
      }

      return {
        folders: state.folders.map((folder) => {
          if (folder.id !== rootFolderId) return folder
          if (!parentId) return { ...folder, tree: [node, ...(folder.tree ?? [])] }
          const result = addToParent(folder.tree ?? [])
          return { ...folder, tree: result.restored ? result.nodes : [node, ...(folder.tree ?? [])] }
        }),
      }
    }),
  selectFolder: (id) => set({ activeFolderId: id }),
  reorderFolders: (sourceId, targetId) =>
    set((state) => {
      const folders = [...state.folders].sort((a, b) => a.order - b.order)
      const from = folders.findIndex((folder) => folder.id === sourceId)
      const to = folders.findIndex((folder) => folder.id === targetId)
      if (from < 0 || to < 0 || from === to) return state
      const [moved] = folders.splice(from, 1)
      folders.splice(to, 0, moved)
      return { folders: folders.map((folder, order) => ({ ...folder, order })) }
    }),
}))
