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
  updatedAt?: string
}

export type FilePreviewPayload = {
  path: string
  title: string
  summary: string
  createdAt?: string
  updatedAt?: string
}

export type FileChunkResult = {
  path: string
  startByte: number
  endByte: number
  text: string
  eof: boolean
  createdAt?: string
  updatedAt?: string
  sizeBytes: number
}

export type FileWatchPayload = {
  eventType: 'file-created' | 'file-updated' | 'file-deleted' | 'file-renamed'
  paths: string[]
}

export const isTauriRuntime = () =>
  typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

const recentlySaved = new Map<string, number>()
const writeQueues = new Map<string, Promise<unknown>>()

export function markRecentlySaved(path: string) {
  recentlySaved.set(path, Date.now())
}

export function isRecentlySelfSaved(path: string, windowMs = 2000) {
  const savedAt = recentlySaved.get(path)
  return Boolean(savedAt && Date.now() - savedAt <= windowMs)
}

const fallbackConfig: AppConfig = {
  rootFolders: mockRootFolders,
  selectedRootFolderId: mockRootFolders[0]?.id,
  pinnedFilePaths: [],
  layoutDensity: 'comfortable',
  customEditorLayout: undefined,
  editorTheme: 'paper-white',
  sidebarCollapsed: false,
}

export async function selectRootFolder(): Promise<RootFolder | null> {
  if (!isTauriRuntime()) return createMockFolder(Date.now(), '导入的资料夹')
  return invoke<RootFolder | null>('select_root_folder')
}

export async function selectParentFolder(): Promise<string | null> {
  if (!isTauriRuntime()) return '~/Desktop'
  return invoke<string | null>('select_parent_folder')
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  return invoke<void>('open_external_url', { url })
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

export function stripMarkdownPreview(content: string) {
  const lines = content
    .replace(/```[\s\S]*?```/g, '\n')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<span\b[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<img\b[^>]*>/gi, ' [图片] ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .split(/\n+/)
    .map((line) => line
      .replace(/^#{1,6}\s+/g, '')
      .replace(/^[-*+]\s+\[[ xX]\]\s+/g, '')
      .replace(/^[-*+]\s+/g, '')
      .replace(/^>\s?/g, '')
      .replace(/[*_~`|]/g, '')
      .trim())
    .filter(Boolean)
  return lines
}

export async function readFilePreview(
  path: string,
  maxBytes = 4096,
  maxLines = 2,
  fileId?: string,
): Promise<FilePreviewPayload> {
  if (!isTauriRuntime()) {
    const name = path.split('/').pop() ?? 'Untitled'
    const ext = name.split('.').pop()?.toLowerCase()
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext ?? '')) {
      return { path, title: name, summary: '图片文件' }
    }
    const content = mockFileContents[fileId ?? path] ?? ''
    const lines = stripMarkdownPreview(content.slice(0, maxBytes))
    return {
      path,
      title: lines[0] || name.replace(/\.(md|markdown)$/i, ''),
      summary: lines.slice(1, 1 + maxLines).join(' · ') || lines[0] || '暂无预览',
    }
  }
  return invoke<FilePreviewPayload>('read_file_preview', { path, maxBytes, maxLines })
}

export async function readFileChunk(
  path: string,
  startByte = 0,
  maxBytes = 64 * 1024,
  fileId?: string,
): Promise<FileChunkResult> {
  if (!isTauriRuntime()) {
    const content = mockFileContents[fileId ?? path] ?? ''
    const start = Math.max(0, Math.min(startByte, content.length))
    const end = Math.max(start, Math.min(start + maxBytes, content.length))
    return {
      path,
      startByte: start,
      endByte: end,
      text: content.slice(start, end),
      eof: end >= content.length,
      sizeBytes: content.length,
    }
  }
  return invoke<FileChunkResult>('read_file_chunk', { path, startByte, maxBytes })
}

export async function writeTextFile(path: string, content: string): Promise<SaveResult> {
  const previous = writeQueues.get(path) ?? Promise.resolve()
  let releaseQueue!: () => void
  const queued = new Promise<void>((resolve) => { releaseQueue = resolve })
  const chain = previous.catch(() => undefined).then(() => queued)
  writeQueues.set(path, chain)

  await previous.catch(() => undefined)
  markRecentlySaved(path)
  try {
    if (!isTauriRuntime()) return { ok: true, savedAt: new Date().toISOString() }
    const result = await invoke<SaveResult>('write_text_file', { path, content })
    markRecentlySaved(path)
    return result
  } finally {
    releaseQueue()
    if (writeQueues.get(path) === chain) writeQueues.delete(path)
  }
}

export async function backupTextFile(path: string): Promise<string | null> {
  if (!isTauriRuntime()) return null
  return invoke<string>('backup_text_file', { path })
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
    pinnedFilePaths: config.pinnedFilePaths ?? [],
  }
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  if (!isTauriRuntime()) return
  const existing = await loadAppConfig().catch(() => fallbackConfig)
  return invoke<void>('save_app_config', { config: { ...existing, ...config } })
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

export async function createUniqueMarkdownFile(parentPath: string): Promise<FileTreeNode> {
  if (!isTauriRuntime()) {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const now = new Date()
    const name = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日${weekdays[now.getDay()]}.md`
    const path = `${parentPath}/${name}`
    return { id: path, name, path, kind: 'file', extension: 'md' }
  }
  return invoke<FileTreeNode>('create_unique_markdown_file', { parentPath })
}

export async function deleteEmptyFileIfExists(path: string): Promise<boolean> {
  if (!isTauriRuntime()) return true
  return invoke<boolean>('delete_empty_file_if_exists', { path })
}

export async function renamePath(oldPath: string, newName: string): Promise<string> {
  if (!isTauriRuntime()) {
    const parent = oldPath.slice(0, oldPath.lastIndexOf('/'))
    return `${parent}/${newName}`
  }
  return invoke<string>('rename_path', { oldPath, newName })
}

export async function duplicateFile(path: string): Promise<FileTreeNode> {
  if (!isTauriRuntime()) {
    const parent = path.slice(0, path.lastIndexOf('/'))
    const name = path.slice(path.lastIndexOf('/') + 1)
    const dot = name.lastIndexOf('.')
    const stem = dot > 0 ? name.slice(0, dot) : name
    const ext = dot > 0 ? name.slice(dot + 1) : undefined
    const nextName = ext ? `${stem} 副本.${ext}` : `${stem} 副本`
    const nextPath = `${parent}/${nextName}`
    return { id: nextPath, name: nextName, path: nextPath, kind: 'file', extension: ext }
  }
  return invoke<FileTreeNode>('duplicate_file', { path })
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
