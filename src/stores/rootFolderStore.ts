import { create } from 'zustand'
import type { FileTreeNode } from '../types/fileTree'
import type { RootFolder } from '../types/rootFolder'
import {
  createChildFolder,
  createFile,
  isTauriRuntime,
  loadAppConfig,
  readDirectoryTree,
  renamePath,
  saveAppConfig,
  selectRootFolder,
} from '../services/tauriFileService'
import { getFileKind, isEditableFile, normalizeExtension } from '../utils/fileFilters'
import { createMockFolder, mockFileContents, mockFileMeta, mockRootFolders } from '../utils/mockFileSystem'

type RootFolderState = {
  folders: RootFolder[]
  activeFolderId: string | null
  initialized: boolean
  initialize: () => Promise<void>
  addRootFolderFromDialog: () => Promise<RootFolder | null>
  addRootFolder: (folder: RootFolder) => Promise<void>
  refreshRootFolder: (rootFolderId: string) => Promise<void>
  refreshAllRootFolders: () => Promise<void>
  addMockFolder: (name?: string) => void
  importMockFile: (folderId: string) => string | null
  createMockDocument: (folderId?: string | null) => Promise<string | null>
  createMockFile: (folderId: string | null | undefined, name?: string) => Promise<string | null>
  createMockSubfolder: (folderId: string | null | undefined, name?: string) => Promise<string | null>
  removeFolder: (id: string) => void
  renameFolder: (id: string, name: string) => void
  renameTreeFolder: (id: string, name: string) => Promise<void>
  renameFile: (id: string, name: string) => Promise<void>
  removeFile: (id: string) => void
  removeTreeNode: (id: string) => void
  restoreFile: (rootFolderId: string, parentId: string | undefined, node: FileTreeNode) => void
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

const findNodeById = (nodes: FileTreeNode[], id: string): FileTreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const found = findNodeById(node.children, id)
      if (found) return found
    }
  }
  return null
}

const findRootForSelection = (folders: RootFolder[], id?: string | null) => {
  if (!id || id === 'all' || id === 'recently-deleted') return folders[0]
  const direct = folders.find((folder) => folder.id === id)
  if (direct) return direct
  return folders.find((folder) => Boolean(findNodeById(folder.tree ?? [], id)))
}

const findPathForSelection = (folders: RootFolder[], id?: string | null) => {
  if (!id || id === 'all' || id === 'recently-deleted') return folders[0]?.path
  const root = folders.find((folder) => folder.id === id)
  if (root) return root.path
  for (const folder of folders) {
    const node = findNodeById(folder.tree ?? [], id)
    if (node?.kind === 'directory') return node.path
  }
  return folders[0]?.path
}

const saveFolders = (folders: RootFolder[], activeFolderId: string | null) => {
  void saveAppConfig({
    rootFolders: folders.map((folder, order) => ({ ...folder, order, tree: undefined })),
    selectedRootFolderId: activeFolderId ?? undefined,
  })
}

const refreshFolder = async (folder: RootFolder): Promise<RootFolder> => ({
  ...folder,
  tree: await readDirectoryTree(folder.path),
})

export const useRootFolderStore = create<RootFolderState>((set, get) => ({
  folders: isTauriRuntime() ? [] : mockRootFolders,
  activeFolderId: isTauriRuntime() ? null : mockRootFolders[0]?.id ?? null,
  initialized: false,
  initialize: async () => {
    const config = await loadAppConfig()
    const hydrated = await Promise.all((config.rootFolders ?? []).map(refreshFolder))
    set({
      folders: hydrated,
      activeFolderId: config.selectedRootFolderId ?? hydrated[0]?.id ?? 'all',
      initialized: true,
    })
  },
  addRootFolderFromDialog: async () => {
    const folder = await selectRootFolder()
    if (!folder) return null
    await get().addRootFolder(folder)
    return folder
  },
  addRootFolder: async (folder) => {
    const withOrder = { ...folder, order: get().folders.length }
    const hydrated = await refreshFolder(withOrder)
    const folders = [...get().folders.filter((item) => item.path !== hydrated.path), hydrated]
      .map((item, order) => ({ ...item, order }))
    set({ folders, activeFolderId: hydrated.id })
    saveFolders(folders, hydrated.id)
  },
  refreshRootFolder: async (rootFolderId) => {
    const folders = await Promise.all(get().folders.map(async (folder) =>
      folder.id === rootFolderId ? refreshFolder(folder) : folder,
    ))
    set({ folders })
  },
  refreshAllRootFolders: async () => {
    const folders = await Promise.all(get().folders.map(refreshFolder))
    set({ folders })
  },
  addMockFolder: (name) =>
    set((state) => {
      const folder = createMockFolder(state.folders.length + 1, name?.trim() || undefined)
      const note = folder.tree?.[0]
      if (note) mockFileContents[note.id] = '# 未命名笔记\n\n从这里开始写。'
      const folders = [...state.folders, folder]
      saveFolders(folders, folder.id)
      return { folders, activeFolderId: folder.id }
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
  createMockDocument: async (folderId) => get().createMockFile(folderId, '新建笔记.md'),
  createMockFile: async (folderId, rawName) => {
    const folders = get().folders
    const root = findRootForSelection(folders, folderId)
    const parentPath = findPathForSelection(folders, folderId)
    if (!root || !parentPath) return null

    if (isTauriRuntime()) {
      const node = await createFile(parentPath, rawName ?? '新建笔记.md')
      await get().refreshRootFolder(root.id)
      set({ activeFolderId: folderId && folderId !== 'all' ? folderId : root.id })
      return node.id
    }

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
  createMockSubfolder: async (folderId, rawName) => {
    const folders = get().folders
    const root = findRootForSelection(folders, folderId)
    const parentPath = findPathForSelection(folders, folderId)
    if (!root || !parentPath) return null
    const name = rawName?.trim() || '新建文件夹'

    if (isTauriRuntime()) {
      const node = await createChildFolder(parentPath, name)
      await get().refreshRootFolder(root.id)
      set({ activeFolderId: node.id })
      return node.id
    }

    let createdId: string | null = null
    set((state) => ({
      folders: state.folders.map((folder) => {
        const makeNode = (parentPath: string): FileTreeNode => {
          const id = uniqueId('dir-new')
          createdId = id
          return { id, name, path: `${parentPath}/${name}`, kind: 'directory', children: [] }
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
      const activeFolderId = state.activeFolderId === id ? (folders[0]?.id ?? 'all') : state.activeFolderId
      saveFolders(folders, activeFolderId)
      return { folders, activeFolderId }
    }),
  renameFolder: (id, name) =>
    set((state) => {
      const folders = state.folders.map((folder) =>
        folder.id === id ? { ...folder, name: name.trim() || folder.name } : folder)
      saveFolders(folders, state.activeFolderId)
      return { folders }
    }),
  renameTreeFolder: async (id, name) => {
    const root = findRootForSelection(get().folders, id)
    const node = root ? findNodeById(root.tree ?? [], id) : null
    if (!root || !node) return
    if (isTauriRuntime()) {
      await renamePath(node.path, name)
      await get().refreshRootFolder(root.id)
      return
    }
    set((state) => {
      const renameNodes = (nodes: FileTreeNode[]): FileTreeNode[] =>
        nodes.map((node) => {
          if (node.id === id && node.kind === 'directory') {
            const parent = node.path.slice(0, node.path.lastIndexOf('/'))
            return updateChildPaths({ ...node, name, path: `${parent}/${name}` })
          }
          return node.children ? { ...node, children: renameNodes(node.children) } : node
        })
      return { folders: state.folders.map((folder) => ({ ...folder, tree: renameNodes(folder.tree ?? []) })) }
    })
  },
  renameFile: async (id, name) => {
    const root = findRootForSelection(get().folders, id)
    const node = root ? findNodeById(root.tree ?? [], id) : null
    if (!root || !node) return
    if (isTauriRuntime()) {
      await renamePath(node.path, name)
      await get().refreshRootFolder(root.id)
      return
    }
    set((state) => {
      const renameNodes = (nodes: FileTreeNode[]): FileTreeNode[] =>
        nodes.map((node) => {
          if (node.id === id) {
            const parent = node.path.slice(0, node.path.lastIndexOf('/'))
            return { ...node, name, path: `${parent}/${name}` }
          }
          return node.children ? { ...node, children: renameNodes(node.children) } : node
        })
      return { folders: state.folders.map((folder) => ({ ...folder, tree: renameNodes(folder.tree ?? []) })) }
    })
  },
  removeFile: (id) =>
    set((state) => ({
      folders: state.folders.map((folder) => ({ ...folder, tree: removeNodeById(folder.tree ?? [], id) })),
    })),
  removeTreeNode: (id) =>
    set((state) => ({
      folders: state.folders.map((folder) => ({ ...folder, tree: removeNodeById(folder.tree ?? [], id) })),
      activeFolderId: state.activeFolderId === id ? 'all' : state.activeFolderId,
    })),
  restoreFile: (rootFolderId, parentId, node) =>
    set((state) => {
      const addToParent = (nodes: FileTreeNode[]): { nodes: FileTreeNode[]; restored: boolean } => {
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
      const ordered = folders.map((folder, order) => ({ ...folder, order }))
      saveFolders(ordered, state.activeFolderId)
      return { folders: ordered }
    }),
}))

