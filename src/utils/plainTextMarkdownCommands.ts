import type { EditorCommand } from '../types/editorCommand'

export type TextSelectionRange = {
  start: number
  end: number
}

export type TextCommandResult = {
  value: string
  selection: TextSelectionRange
}

const getLineRange = (value: string, start: number, end: number) => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextBreak = value.indexOf('\n', end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  return { lineStart, lineEnd }
}

const replaceRange = (
  value: string,
  start: number,
  end: number,
  replacement: string,
  cursorOffset = replacement.length,
): TextCommandResult => ({
  value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
  selection: {
    start: start + cursorOffset,
    end: start + cursorOffset,
  },
})

const selectedOrPlaceholder = (value: string, selection: TextSelectionRange, placeholder: string) => {
  const selected = value.slice(selection.start, selection.end)
  return selected || placeholder
}

const wrapSelection = (
  value: string,
  selection: TextSelectionRange,
  before: string,
  after = before,
  placeholder = '文字',
) => {
  const selected = selectedOrPlaceholder(value, selection, placeholder)
  return replaceRange(
    value,
    selection.start,
    selection.end,
    `${before}${selected}${after}`,
    before.length + selected.length + after.length,
  )
}

const insertBlock = (value: string, selection: TextSelectionRange, block: string) => {
  const before = value.slice(0, selection.start)
  const after = value.slice(selection.end)
  const prefix = before && !before.endsWith('\n') ? '\n' : ''
  const suffix = after && !after.startsWith('\n') ? '\n' : ''
  const text = `${prefix}${block}${suffix}`
  return replaceRange(value, selection.start, selection.end, text)
}

const prefixSelectedLines = (
  value: string,
  selection: TextSelectionRange,
  getPrefix: (index: number) => string,
) => {
  const { lineStart, lineEnd } = getLineRange(value, selection.start, selection.end)
  const block = value.slice(lineStart, lineEnd)
  const lines = block.split('\n')
  const nextBlock = lines
    .map((line, index) => (line.trim() ? `${getPrefix(index)}${line.replace(/^\s*(?:[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, '')}` : line))
    .join('\n')
  return replaceRange(value, lineStart, lineEnd, nextBlock, nextBlock.length)
}

export const applyPlainTextHeading = (
  value: string,
  selection: TextSelectionRange,
  level: number,
): TextCommandResult => {
  const { lineStart, lineEnd } = getLineRange(value, selection.start, selection.end)
  const block = value.slice(lineStart, lineEnd)
  const prefix = level > 0 ? `${'#'.repeat(level)} ` : ''
  const nextBlock = block
    .split('\n')
    .map((line) => {
      const stripped = line.replace(/^\s*#{1,6}\s+/, '')
      return stripped.trim() ? `${prefix}${stripped}` : stripped
    })
    .join('\n')
  return replaceRange(value, lineStart, lineEnd, nextBlock, nextBlock.length)
}

export const applyPlainTextColor = (
  value: string,
  selection: TextSelectionRange,
  textColor: string,
  backgroundColor: string,
): TextCommandResult => {
  const selected = selectedOrPlaceholder(value, selection, '文字')
  return replaceRange(
    value,
    selection.start,
    selection.end,
    `<span style="color:${textColor};background-color:${backgroundColor}">${selected}</span>`,
  )
}

export const applyPlainTextCommand = (
  value: string,
  selection: TextSelectionRange,
  command: EditorCommand,
  payload?: string,
): TextCommandResult => {
  switch (command) {
    case 'bold':
      return wrapSelection(value, selection, '**')
    case 'italic':
      return wrapSelection(value, selection, '*')
    case 'strikethrough':
      return wrapSelection(value, selection, '~~')
    case 'inline-code':
      return wrapSelection(value, selection, '`', '`', 'code')
    case 'bullet-list':
      return prefixSelectedLines(value, selection, () => '- ')
    case 'ordered-list':
      return prefixSelectedLines(value, selection, (index) => `${index + 1}. `)
    case 'task-list':
      return prefixSelectedLines(value, selection, () => '- [ ] ')
    case 'blockquote':
      return prefixSelectedLines(value, selection, () => '> ')
    case 'hr':
      return insertBlock(value, selection, '***')
    case 'metadata':
      return insertBlock(value, selection, `---\n${value.slice(selection.start, selection.end)}\n---`.replace(/\n\n---$/, '\n---'))
    case 'code-block': {
      const selected = value.slice(selection.start, selection.end)
      return insertBlock(value, selection, `\`\`\`\n${selected}\n\`\`\``)
    }
    case 'table':
      return insertBlock(value, selection, '| A | B |\n|---|---|\n|  |  |')
    case 'link': {
      const selected = selectedOrPlaceholder(value, selection, '链接文字')
      const href = (payload || '').trim() || 'https://'
      return replaceRange(value, selection.start, selection.end, `[${selected}](${href})`)
    }
    case 'image': {
      const src = (payload || '').trim() || 'https://'
      return replaceRange(value, selection.start, selection.end, `![图片](${src})`)
    }
    case 'paragraph':
      return applyPlainTextHeading(value, selection, 0)
    case 'undo':
    case 'redo':
      return { value, selection }
    default:
      return { value, selection }
  }
}
