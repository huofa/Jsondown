import type { EditableFileKind } from '../types/file'

export const EDITABLE_EXTENSIONS = new Set([
  'md',
  'markdown',
  'json',
  'html',
  'htm',
  'yaml',
  'yml',
  'txt',
  'text',
])

export const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown'])
export const CODE_TEXT_EXTENSIONS = new Set(['json', 'html', 'htm', 'yaml', 'yml', 'txt', 'text'])

export const VIEWABLE_EXTENSIONS = new Set([
  ...EDITABLE_EXTENSIONS,
  'txt',
  'json',
  'html',
  'htm',
  'css',
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'rs',
  'toml',
  'yaml',
  'yml',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'svg',
])

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'])
const CODE_EXTENSIONS = new Set(['css', 'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'toml', 'yaml', 'yml'])

export function normalizeExtension(name: string) {
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
}

export function isViewableFile(name: string) {
  return VIEWABLE_EXTENSIONS.has(normalizeExtension(name))
}

export function isEditableFile(name: string) {
  return EDITABLE_EXTENSIONS.has(normalizeExtension(name))
}

export function getFileKind(extension: string): EditableFileKind {
  if (MARKDOWN_EXTENSIONS.has(extension)) return 'markdown'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (extension === 'json') return 'json'
  if (extension === 'html' || extension === 'htm') return 'html'
  if (CODE_EXTENSIONS.has(extension)) return 'code'
  return 'text'
}
