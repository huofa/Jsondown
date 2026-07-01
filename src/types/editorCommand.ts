export type EditorCommand =
  | 'undo'
  | 'redo'
  | 'paragraph'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'inline-code'
  | 'bullet-list'
  | 'ordered-list'
  | 'task-list'
  | 'link'
  | 'image'
  | 'table'
  | 'code-block'
  | 'blockquote'
  | 'hr'
  | 'metadata'

export type EditorCommandApi = {
  rememberSelection: () => boolean
  insertText: (text: string) => boolean
  insertMarkdown?: (markdown: string) => boolean
  run: (command: EditorCommand, payload?: string) => boolean
  heading: (level: number) => boolean
  applyColor: (textColor: string, backgroundColor: string) => boolean
}
