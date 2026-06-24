import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core'
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history'
import {
  insertHrCommand,
  insertImageCommand,
  listItemSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
  wrapInBlockTypeCommand,
  createCodeBlockCommand,
} from '@milkdown/kit/preset/commonmark'
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm'
import { useEffect, useRef } from 'react'
import type { EditorCommand, EditorCommandApi } from '../types/editorCommand'

type MilkdownEditorProps = {
  value: string
  onChange: (markdown: string) => void
  onReady?: (api: EditorCommandApi | null) => void
}

export function MilkdownEditor({ value, onChange, onReady }: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const initialValueRef = useRef(value)
  onChangeRef.current = onChange
  onReadyRef.current = onReady

  useEffect(() => {
    if (!rootRef.current) return
    let disposed = false
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialValueRef.current,
      features: {
        [CrepeFeature.AI]: false,
        [CrepeFeature.Latex]: false,
        [CrepeFeature.TopBar]: false,
        [CrepeFeature.Toolbar]: false,
        [CrepeFeature.LinkTooltip]: false,
        [CrepeFeature.BlockEdit]: false,
        [CrepeFeature.Placeholder]: false,
      },
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
        if (!disposed && markdown !== previousMarkdown) onChangeRef.current(markdown)
      })
    })

    const run = (command: EditorCommand, payload?: string) =>
      crepe.editor.action((ctx) => {
        const commands = ctx.get(commandsCtx)
        let result = false
        switch (command) {
          case 'undo': result = commands.call(undoCommand.key); break
          case 'redo': result = commands.call(redoCommand.key); break
          case 'paragraph': result = commands.call(turnIntoTextCommand.key); break
          case 'bold': result = commands.call(toggleStrongCommand.key); break
          case 'italic': result = commands.call(toggleEmphasisCommand.key); break
          case 'strikethrough': result = commands.call(toggleStrikethroughCommand.key); break
          case 'inline-code': result = commands.call(toggleInlineCodeCommand.key); break
          case 'bullet-list': result = commands.call(wrapInBulletListCommand.key); break
          case 'ordered-list': result = commands.call(wrapInOrderedListCommand.key); break
          case 'task-list':
            result = commands.call(wrapInBlockTypeCommand.key, {
              nodeType: listItemSchema.type(ctx),
              attrs: { checked: false },
            })
            break
          case 'link': result = commands.call(toggleLinkCommand.key, { href: payload || 'https://' }); break
          case 'image': result = commands.call(insertImageCommand.key, { src: payload || '', alt: '图片' }); break
          case 'table': result = commands.call(insertTableCommand.key, { row: 3, col: 3 }); break
          case 'code-block': result = commands.call(createCodeBlockCommand.key); break
          case 'blockquote': result = commands.call(wrapInBlockquoteCommand.key); break
          case 'hr': result = commands.call(insertHrCommand.key); break
        }
        ctx.get(editorViewCtx).focus()
        return result
      })

    const applyColor = (textColor: string, backgroundColor: string) =>
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        view.focus()
        document.execCommand('foreColor', false, textColor)
        document.execCommand('hiliteColor', false, backgroundColor)
        return true
      })

    const createPromise = crepe.create()
    void createPromise.then(() => {
      if (disposed) return
      onReadyRef.current?.({
        run,
          heading: (level) =>
            crepe.editor.action((ctx) => {
              const result = level === 0
                ? ctx.get(commandsCtx).call(turnIntoTextCommand.key)
                : ctx.get(commandsCtx).call(wrapInHeadingCommand.key, level)
              ctx.get(editorViewCtx).focus()
              return result
            }),
          applyColor,
      })
    })

    return () => {
      disposed = true
      onReadyRef.current?.(null)
      void createPromise.then(() => crepe.destroy())
    }
  }, [])

  return <div ref={rootRef} className="milkdown-host" />
}
