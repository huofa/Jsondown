import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { AppConfig } from '../types/appConfig'
import type { DeletedFile } from '../types/deletedFile'
import type { FileTreeNode } from '../types/fileTree'
import type { RootFolder } from '../types/rootFolder'
import { createMockFolder, mockFileContents, mockRootFolders } from '../utils/mockFileSystem'

type SaveResult = {
  ok: boolean
  savedAt: string
}

export type FileWatchPayload = {
  eventType: 'file-created' | 'file-updated' | 'file-deleted' | 'file-renamed'
  paths: string[]
}

export const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

const fallbackConfig: AppConfig = {
  rootFolders: mockRootFolders,
  selectedRootFolderId: mockRootFolders[0]?.id,
  layoutDensity: 'comfortable',
  editorTheme: 'paper-white',
  sidebarCollapsed: false,
}

export async function selectRootFolder(): Promise<RootFolder | null> {
  if (!isTauriRuntime()) return createMockFolder(Date.now(), '导入的资料夹')
  return invoke<RootFolder | null>('select_root_folder')
}

export async function createRootFolder(parentPath: string, folderName: string): Promise<RootFolder> {
  if (!isTauriRuntime()) return createMockFolder(Date.now(), folderName)
  return invoke<RootFolder>('create_root_folder', { parentPath, folderName })
}

export async function readDirectoryTree(rootPath: string): Promise<FileTreeNode[]> {
  if (!isTauriRuntime()) {
    return mockRootFolders.find((folder) => folder.path === rootPath || folder.id === rootPath)?.tree ?? []
  }
  return invoke<FileTreeNode[]>('read_directory_tree', { rootPath })
}

export async function readTextFile(path: string, fileId?: string): Promise<string> {
  if (!isTauriRuntime()) return mockFileContents[fileId ?? path] ?? ''
  return invoke<string>('read_text_file', { path })
}

export async function writeTextFile(path: string, content: string): Promise<SaveResult> {
  if (!isTauriRuntime()) return { ok: true, savedAt: new Date().toISOString() }
  return invoke<SaveResult>('write_text_file', { path, content })
}

export async function revealInFinder(path: string): Promise<void> {
  if (!isTauriRuntime()) return
  return invoke<void>('reveal_in_finder', { path })
}

export async function loadAppConfig(): Promise<AppConfig> {
  if (!isTauriRuntime()) return fallbackConfig
  const config = await invoke<AppConfig>('load_app_config')
  return {
    ...config,
    rootFolders: config.rootFolders ?? [],
  }
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  if (!isTauriRuntime()) return
  return invoke<void>('save_app_config', { config })
}

export async function createChildFolder(parentPath: string, folderName: string): Promise<FileTreeNode> {
  if (!isTauriRuntime()) {
    const path = `${parentPath}/${folderName}`
    return { id: path, name: folderName, path, kind: 'directory', children: [] }
  }
  return invoke<FileTreeNode>('create_child_folder', { parentPath, folderName })
}

export async function createFile(parentPath: string, fileName: string): Promise<FileTreeNode> {
  if (!isTauriRuntime()) {
    const normalized = fileName.includes('.') ? fileName : `${fileName || '新建笔记'}.md`
    const path = `${parentPath}/${normalized}`
    return { id: path, name: normalized, path, kind: 'file', extension: normalized.split('.').pop() }
  }
  return invoke<FileTreeNode>('create_file', { parentPath, fileName })
}

export async function renamePath(oldPath: string, newName: string): Promise<string> {
  if (!isTauriRuntime()) {
    const parent = oldPath.slice(0, oldPath.lastIndexOf('/'))
    return `${parent}/${newName}`
  }
  return invoke<string>('rename_path', { oldPath, newName })
}

export async function moveToRecentlyDeleted(path: string, rootPath: string): Promise<DeletedFile> {
  if (!isTauriRuntime()) {
    return {
      id: `trash-${Date.now()}`,
      name: path.split('/').pop() ?? '未命名',
      kind: 'file',
      originalPath: path,
      trashPath: `${rootPath}/.jsondown-trash/${path.split('/').pop()}`,
      deletedAt: new Date().toISOString(),
    }
  }
  return invoke<DeletedFile>('move_to_recently_deleted', { path, rootPath })
}

export async function listRecentlyDeleted(rootPaths: string[]): Promise<DeletedFile[]> {
  if (!isTauriRuntime()) return []
  return invoke<DeletedFile[]>('list_recently_deleted', { rootPaths })
}

export async function restoreDeletedFile(trashId: string, rootPath: string): Promise<DeletedFile> {
  if (!isTauriRuntime()) throw new Error('Mock restore is handled by recentlyDeletedStore')
  return invoke<DeletedFile>('restore_deleted_file', { trashId, rootPath })
}

export async function permanentlyDeleteTrashItem(trashId: string, rootPath: string): Promise<void> {
  if (!isTauriRuntime()) return
  return invoke<void>('permanently_delete_trash_item', { trashId, rootPath })
}

export async function watchPaths(
  paths: string[],
  onEvent?: (payload: FileWatchPayload) => void,
): Promise<UnlistenFn | null> {
  if (!isTauriRuntime()) return null
  await invoke<void>('watch_paths', { paths })
  if (!onEvent) return null
  return listen<FileWatchPayload>('jsondown://file-watch', (event) => onEvent(event.payload))
}

