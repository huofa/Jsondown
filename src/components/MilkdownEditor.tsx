import { Crepe, CrepeFeature } from '@milkdown/crepe'
import { commandsCtx, editorViewCtx, editorViewOptionsCtx, remarkStringifyOptionsCtx } from '@milkdown/kit/core'
import { redoCommand, undoCommand } from '@milkdown/kit/plugin/history'
import { toggleMark } from '@milkdown/prose/commands'
import { TextSelection, type Selection } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { $markSchema, $remark } from '@milkdown/utils'
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

const HIGHLIGHT_NODE = 'jsondownHighlight'

type MarkdownNode = {
  type: string
  value?: string
  children?: MarkdownNode[]
  backgroundColor?: string
  textColor?: string
  [key: string]: unknown
}

const normalizeStyleColor = (value: string) => value.trim()

const getSpanHighlightStyle = (value?: string) => {
  if (!value || !/^<span\b/i.test(value)) return null
  const styleMatch = value.match(/\sstyle=(["'])(.*?)\1/i)
  const style = styleMatch?.[2]
  if (!style) return null
  const backgroundMatch = style.match(/background-color\s*:\s*([^;]+)/i)
  if (!backgroundMatch?.[1]) return null
  const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i)
  return {
    backgroundColor: normalizeStyleColor(backgroundMatch[1]),
    textColor: colorMatch?.[1] ? normalizeStyleColor(colorMatch[1]) : undefined,
  }
}

const isSpanClose = (value?: string) => Boolean(value && /^<\/span\s*>$/i.test(value.trim()))

const transformHighlightSpans = (node: MarkdownNode) => {
  if (!node.children) return

  node.children.forEach(transformHighlightSpans)
  const nextChildren: MarkdownNode[] = []
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]
    const highlightStyle = child.type === 'html' ? getSpanHighlightStyle(child.value) : null
    if (!highlightStyle) {
      nextChildren.push(child)
      continue
    }

    const highlightedChildren: MarkdownNode[] = []
    let closeIndex = -1
    for (let inner = index + 1; inner < node.children.length; inner += 1) {
      const candidate = node.children[inner]
      if (candidate.type === 'html' && isSpanClose(candidate.value)) {
        closeIndex = inner
        break
      }
      highlightedChildren.push(candidate)
    }

    if (closeIndex === -1 || highlightedChildren.length === 0) {
      nextChildren.push(child)
      continue
    }

    nextChildren.push({
      type: HIGHLIGHT_NODE,
      backgroundColor: highlightStyle.backgroundColor,
      textColor: highlightStyle.textColor,
      children: highlightedChildren,
    })
    index = closeIndex
  }
  node.children = nextChildren
}

const jsondownHighlightRemark = $remark('jsondown-highlight-span', () => () => (tree) => {
  transformHighlightSpans(tree as unknown as MarkdownNode)
  return tree
})

const jsondownHighlightSchema = $markSchema('jsondownHighlight', () => ({
  attrs: {
    backgroundColor: { default: '#F6E4A6' },
    textColor: { default: null },
  },
  inclusive: true,
  parseDOM: [
    {
      tag: 'span[style]',
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false
        const backgroundColor = dom.style.backgroundColor
        const textColor = dom.style.color || null
        return backgroundColor ? { backgroundColor, textColor } : false
      },
    },
  ],
  toDOM: (mark) => [
    'span',
    {
      'data-jsondown-highlight': 'true',
      style: [
        mark.attrs.textColor ? `color: ${mark.attrs.textColor}` : '',
        `background-color: ${mark.attrs.backgroundColor}`,
        'border-radius: 0.22em',
        'box-decoration-break: clone',
        '-webkit-box-decoration-break: clone',
        'padding: 0.04em 0.16em',
      ].filter(Boolean).join('; '),
    },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === HIGHLIGHT_NODE,
    runner: (state, node, markType) => {
      state.openMark(markType, {
        backgroundColor: node.backgroundColor,
        textColor: node.textColor,
      })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'jsondownHighlight',
    runner: (state, mark) => {
      state.withMark(mark, HIGHLIGHT_NODE, undefined, {
        backgroundColor: mark.attrs.backgroundColor,
        textColor: mark.attrs.textColor,
      })
    },
  },
}))

type MilkdownEditorProps = {
  value: string
  autoFocusStart?: boolean
  readOnly?: boolean
  onChange: (markdown: string) => void
  onReady?: (api: EditorCommandApi | null) => void
}

export function MilkdownEditor({ value, autoFocusStart, readOnly = false, onChange, onReady }: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const initialValueRef = useRef(value)
  const readOnlyRef = useRef(readOnly)
  const editorViewRef = useRef<EditorView | null>(null)
  onChangeRef.current = onChange
  onReadyRef.current = onReady
  readOnlyRef.current = readOnly

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
    crepe.editor.use([...jsondownHighlightRemark, ...jsondownHighlightSchema])

    crepe.editor.config((ctx) => {
      ctx.update(editorViewOptionsCtx, (options) => ({
        ...options,
        editable: () => !readOnlyRef.current,
        handleScrollToSelection: () => true,
      }))
      ctx.update(remarkStringifyOptionsCtx, (options) => ({
        ...options,
        handlers: {
          ...options.handlers,
          [HIGHLIGHT_NODE]: (node: MarkdownNode, _: unknown, state: { containerPhrasing: (node: MarkdownNode, info: unknown) => string }, info: unknown) => {
            const backgroundColor = typeof node.backgroundColor === 'string'
              ? node.backgroundColor
              : '#F6E4A6'
            const textColor = typeof node.textColor === 'string'
              ? node.textColor
              : undefined
            const style = [
              textColor ? `color:${textColor}` : '',
              `background-color:${backgroundColor}`,
            ].filter(Boolean).join(';')
            const value = state.containerPhrasing(node, info)
            return `<span style="${style}">${value}</span>`
          },
        },
      }))
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
        if (!readOnlyRef.current && !disposed && markdown !== previousMarkdown) onChangeRef.current(markdown)
      })
    })

    let rememberedSelection: Selection | null = null
    const rememberSelection = () =>
      crepe.editor.action((ctx) => {
        const selection = ctx.get(editorViewCtx).state.selection
        if (!selection.empty) {
          rememberedSelection = selection
          return true
        }
        return Boolean(rememberedSelection && !rememberedSelection.empty)
      })

    const restoreEditorSelection = (ctx: Parameters<Parameters<typeof crepe.editor.action>[0]>[0]) => {
      const view = ctx.get(editorViewCtx)
      const selection = rememberedSelection ?? view.state.selection
      view.focus()
      try {
        if (!view.state.selection.eq(selection)) {
          view.dispatch(view.state.tr.setSelection(selection))
        }
      } catch {
        rememberedSelection = null
      }
      return view
    }

    const run = (command: EditorCommand, payload?: string) =>
      crepe.editor.action((ctx) => {
        const view = restoreEditorSelection(ctx)
        const commands = ctx.get(commandsCtx)
        let result = false
        switch (command) {
          case 'undo': result = commands.call(undoCommand.key); break
          case 'redo': result = commands.call(redoCommand.key); break
          case 'paragraph': result = commands.call(turnIntoTextCommand.key); break
          case 'bold': result = commands.call(toggleStrongCommand.key); break
          case 'italic': {
            const emphasisMark = view.state.schema.marks.emphasis
            result = emphasisMark
              ? toggleMark(emphasisMark)(view.state, view.dispatch, view)
              : commands.call(toggleEmphasisCommand.key)
            break
          }
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
        view.focus()
        return result
      })

    const applyColor = (textColor: string, backgroundColor: string) =>
      crepe.editor.action((ctx) => {
        const view = restoreEditorSelection(ctx)
        if (view.state.selection.empty) return false

        const highlightMark = view.state.schema.marks.jsondownHighlight
        if (!highlightMark) {
          if (import.meta.env.DEV) console.warn('[Jsondown] jsondownHighlight mark is not registered')
          return false
        }

        const { from, to } = view.state.selection
        const transaction = view.state.tr
          .removeMark(from, to, highlightMark)
          .addMark(from, to, highlightMark.create({ backgroundColor, textColor }))
          .scrollIntoView()
        view.dispatch(transaction)
        rememberedSelection = view.state.selection
        view.focus()
        return true
      })

    const createPromise = crepe.create()
    void createPromise.then(() => {
      if (disposed) return
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        editorViewRef.current = view
        view.setProps({ editable: () => !readOnlyRef.current })
        return true
      })
      onReadyRef.current?.({
        rememberSelection,
        run,
          heading: (level) =>
            crepe.editor.action((ctx) => {
              restoreEditorSelection(ctx)
              const result = level === 0
                ? ctx.get(commandsCtx).call(turnIntoTextCommand.key)
                : ctx.get(commandsCtx).call(wrapInHeadingCommand.key, level)
              ctx.get(editorViewCtx).focus()
              return result
            }),
          applyColor,
      })
      if (!readOnlyRef.current && autoFocusStart) {
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          const start = Math.min(1, view.state.doc.content.size)
          view.focus()
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, start)))
          return true
        })
      }
    })

    return () => {
      disposed = true
      editorViewRef.current = null
      onReadyRef.current?.(null)
      void createPromise.then(() => crepe.destroy())
    }
  }, [])

  useEffect(() => {
    readOnlyRef.current = readOnly
    const view = editorViewRef.current
    view?.setProps({ editable: () => !readOnlyRef.current })
    if (!readOnly) {
      window.requestAnimationFrame(() => {
        editorViewRef.current?.focus()
      })
    }
  }, [readOnly])

  return <div ref={rootRef} className={`milkdown-host ${readOnly ? 'is-readonly' : ''}`} />
}
