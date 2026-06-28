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
import { useEffect, useLayoutEffect, useRef } from 'react'
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
const standaloneBrLinePattern = /^\s*<br\s*\/?>\s*$/i
const fenceLinePattern = /^\s*(```|~~~)/
const emptySpanPattern = /<span\s+style=(["'])(?:(?!\1).)*\1>\s*<\/span>/gi

const hasEmptySpan = (markdown: string) =>
  /<span\s+style=(["'])(?:(?!\1).)*\1>\s*<\/span>/i.test(markdown)

const normalizeMarkdownFirstOutput = (markdown: string) => {
  const lines = markdown.replace(emptySpanPattern, '').split('\n')
  const normalizedLines: string[] = []
  let inFence = false
  let blankRun = 0

  for (const line of lines) {
    if (fenceLinePattern.test(line)) {
      inFence = !inFence
      normalizedLines.push(line)
      blankRun = 0
      continue
    }

    const nextLine = !inFence && standaloneBrLinePattern.test(line) ? '' : line

    if (!inFence && nextLine.trim() === '') {
      blankRun += 1
      if (blankRun <= 2) normalizedLines.push('')
      continue
    }

    blankRun = 0
    normalizedLines.push(nextLine)
  }

  return normalizedLines.join('\n')
}

const logMarkdownPreview = (markdown: string) => {
  if (!import.meta.env.DEV) return

  console.debug('[markdown:updated-preview]', {
    hasBr: /<br\s*\/?>/i.test(markdown),
    hasSpanStyle: /<span\s+style=/i.test(markdown),
    hasEmptySpan: hasEmptySpan(markdown),
    hasEscapedOrderedList: /^\s*\d+\\\./m.test(markdown),
    hasEscapedBulletList: /^\s*\\[*+-]\s+/m.test(markdown),
    hasEscapedUnderscore: /\\_/.test(markdown),
    preview: markdown.slice(0, 500),
  })
}

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
  initialSelectionCoords?: {
    clientX: number
    clientY: number
    textBefore?: string
    textAfter?: string
    textOffset?: number
  } | null
  readOnly?: boolean
  onChange: (markdown: string) => void
  onReady?: (api: EditorCommandApi | null) => void
  onVisualReady?: () => void
  onInitialSelectionApplied?: () => void
}

const editableBlockSelector = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'blockquote',
  'pre',
  'td',
  'th',
].join(',')

const findSplitOffset = (text: string, before?: string, after?: string) => {
  if (before && after) {
    let searchFrom = 0

    while (searchFrom <= text.length) {
      const beforeIndex = text.indexOf(before, searchFrom)
      if (beforeIndex < 0) break

      const split = beforeIndex + before.length
      if (text.slice(split, split + after.length) === after) return split
      searchFrom = beforeIndex + 1
    }
  }

  if (after) {
    const index = text.indexOf(after)
    if (index >= 0) return index
  }

  if (before) {
    const index = text.indexOf(before)
    if (index >= 0) return index + before.length
  }

  return undefined
}

const findTextNodeAtOffset = (root: HTMLElement, offset: number) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let current = walker.nextNode()

  while (current) {
    const length = current.textContent?.length ?? 0

    if (remaining <= length) {
      return {
        node: current,
        offset: Math.max(0, Math.min(remaining, length)),
      }
    }

    remaining -= length
    current = walker.nextNode()
  }

  return null
}

const findSelectionPosFromTextAnchor = (
  view: EditorView,
  anchor?: MilkdownEditorProps['initialSelectionCoords'],
) => {
  if (!anchor?.textBefore && !anchor?.textAfter) return undefined

  const blocks = Array.from(view.dom.querySelectorAll<HTMLElement>(editableBlockSelector))

  for (const block of blocks) {
    const text = block.textContent ?? ''
    const splitOffset = findSplitOffset(text, anchor.textBefore, anchor.textAfter)

    if (typeof splitOffset !== 'number') continue

    const domPoint = findTextNodeAtOffset(block, splitOffset)
    if (!domPoint) continue

    try {
      return view.posAtDOM(domPoint.node, domPoint.offset)
    } catch {
      // Keep searching. Some ProseMirror decoration nodes do not map cleanly.
    }
  }

  return undefined
}

export function MilkdownEditor({
  value,
  autoFocusStart,
  initialSelectionCoords,
  readOnly = false,
  onChange,
  onReady,
  onVisualReady,
  onInitialSelectionApplied,
}: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const onVisualReadyRef = useRef(onVisualReady)
  const onInitialSelectionAppliedRef = useRef(onInitialSelectionApplied)
  const initialValueRef = useRef(value)
  const initialSelectionCoordsRef = useRef(initialSelectionCoords)
  const readOnlyRef = useRef(readOnly)
  const editorViewRef = useRef<EditorView | null>(null)

  onChangeRef.current = onChange
  onReadyRef.current = onReady
  onVisualReadyRef.current = onVisualReady
  onInitialSelectionAppliedRef.current = onInitialSelectionApplied
  initialSelectionCoordsRef.current = initialSelectionCoords
  readOnlyRef.current = readOnly

  useEffect(() => {
    if (!rootRef.current) return

    let disposed = false

    const forceCaretRepaint = () => {
      const root = rootRef.current
      if (!root) return

      root.classList.remove('is-caret-repaint')
      void root.offsetHeight
      root.classList.add('is-caret-repaint')
    }

    const scheduleCaretRepaint = () => {
      window.requestAnimationFrame(() => {
        if (disposed) return
        forceCaretRepaint()
      })

      return false
    }

    const scheduleCaretRepaintTwice = (after?: () => void) => {
      window.requestAnimationFrame(() => {
        if (disposed) return
        forceCaretRepaint()

        window.requestAnimationFrame(() => {
          if (disposed) return
          forceCaretRepaint()
          after?.()
        })
      })
    }

    const dispatchSelection = (view: EditorView, selection: Selection) => {
      view.dispatch(view.state.tr.setSelection(selection))
      scheduleCaretRepaint()
    }

    const clearInitialSelectionCoords = () => {
      initialSelectionCoordsRef.current = null
      onInitialSelectionAppliedRef.current?.()
    }

    const focusAtInitialSelectionCoords = () =>
      crepe.editor.action((ctx) => {
        const coords = initialSelectionCoordsRef.current
        const view = ctx.get(editorViewCtx)

        if (!coords) return false

        const anchoredPos = findSelectionPosFromTextAnchor(view, coords)
        const resolved = view.posAtCoords({
          left: coords.clientX,
          top: coords.clientY,
        })

        view.focus()

        const pos = typeof anchoredPos === 'number' ? anchoredPos : resolved?.pos

        if (typeof pos === 'number') {
          dispatchSelection(view, TextSelection.create(view.state.doc, pos))
          clearInitialSelectionCoords()
          return true
        }

        clearInitialSelectionCoords()
        return false
      })
    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: initialValueRef.current,
      features: {
        [CrepeFeature.AI]: false,
        [CrepeFeature.CodeMirror]: false,
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
        handleDOMEvents: {
          ...options.handleDOMEvents,
          focus: () => scheduleCaretRepaint(),
          mousedown: () => scheduleCaretRepaint(),
          mouseup: () => scheduleCaretRepaint(),
          pointerup: () => scheduleCaretRepaint(),
          keyup: () => scheduleCaretRepaint(),
          compositionend: () => scheduleCaretRepaint(),
        },
      }))

      ctx.update(remarkStringifyOptionsCtx, (options) => ({
        ...options,
        handlers: {
          ...options.handlers,
          [HIGHLIGHT_NODE]: (
            node: MarkdownNode,
            _: unknown,
            state: {
              containerPhrasing: (node: MarkdownNode, info: unknown) => string
            },
            info: unknown
          ) => {
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

            if (!value) return ''
            if (!value.trim()) return value

            return `<span style="${style}">${value}</span>`
          },
          break: () => '\n',
          hardBreak: () => '\n',
        },
      }))
    })

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, previousMarkdown) => {
        if (readOnlyRef.current || disposed || markdown === previousMarkdown) return

        const normalizedMarkdown = normalizeMarkdownFirstOutput(markdown)

        logMarkdownPreview(normalizedMarkdown)
        onChangeRef.current(normalizedMarkdown)
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
      scheduleCaretRepaint()

      try {
        if (!view.state.selection.eq(selection)) {
          dispatchSelection(view, selection)
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
          case 'undo':
            result = commands.call(undoCommand.key)
            break

          case 'redo':
            result = commands.call(redoCommand.key)
            break

          case 'paragraph':
            result = commands.call(turnIntoTextCommand.key)
            break

          case 'bold':
            result = commands.call(toggleStrongCommand.key)
            break

          case 'italic': {
            const emphasisMark = view.state.schema.marks.emphasis

            result = emphasisMark
              ? toggleMark(emphasisMark)(view.state, view.dispatch, view)
              : commands.call(toggleEmphasisCommand.key)

            break
          }

          case 'strikethrough':
            result = commands.call(toggleStrikethroughCommand.key)
            break

          case 'inline-code':
            result = commands.call(toggleInlineCodeCommand.key)
            break

          case 'bullet-list':
            result = commands.call(wrapInBulletListCommand.key)
            break

          case 'ordered-list':
            result = commands.call(wrapInOrderedListCommand.key)
            break

          case 'task-list':
            result = commands.call(wrapInBlockTypeCommand.key, {
              nodeType: listItemSchema.type(ctx),
              attrs: { checked: false },
            })
            break

          case 'link':
            result = commands.call(toggleLinkCommand.key, { href: payload || 'https://' })
            break

          case 'image':
            result = commands.call(insertImageCommand.key, { src: payload || '', alt: '图片' })
            break

          case 'table':
            result = commands.call(insertTableCommand.key, { row: 3, col: 3 })
            break

          case 'code-block':
            result = commands.call(createCodeBlockCommand.key)
            break

          case 'blockquote':
            result = commands.call(wrapInBlockquoteCommand.key)
            break

          case 'hr':
            result = commands.call(insertHrCommand.key)
            break
        }

        view.focus()
        scheduleCaretRepaint()
        return result
      })

    const applyColor = (textColor: string, backgroundColor: string) =>
      crepe.editor.action((ctx) => {
        const view = restoreEditorSelection(ctx)

        if (view.state.selection.empty) return false

        const highlightMark = view.state.schema.marks.jsondownHighlight

        if (!highlightMark) {
          if (import.meta.env.DEV) {
            console.warn('[Jsondown] jsondownHighlight mark is not registered')
          }

          return false
        }

        const { from, to } = view.state.selection

        const transaction = view.state.tr
          .removeMark(from, to, highlightMark)
          .addMark(from, to, highlightMark.create({ backgroundColor, textColor }))
          .removeStoredMark(highlightMark)
          .scrollIntoView()

        view.dispatch(transaction)
        scheduleCaretRepaint()
        rememberedSelection = view.state.selection
        view.focus()
        scheduleCaretRepaint()

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

      const markVisualReady = () => {
        if (disposed) return
        onVisualReadyRef.current?.()
      }

      scheduleCaretRepaintTwice(markVisualReady)

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
            scheduleCaretRepaint()

            return result
          }),
        applyColor,
      })

      if (!readOnlyRef.current && autoFocusStart) {
        crepe.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          const start = Math.min(1, view.state.doc.content.size)

          view.focus()
          dispatchSelection(view, TextSelection.create(view.state.doc, start))

          return true
        })
      } else if (!readOnlyRef.current && initialSelectionCoordsRef.current) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!disposed) focusAtInitialSelectionCoords()
          })
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

  useLayoutEffect(() => {
    readOnlyRef.current = readOnly

    const view = editorViewRef.current

    view?.setProps({ editable: () => !readOnlyRef.current })

    if (!readOnly && initialSelectionCoordsRef.current) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const view = editorViewRef.current
          const coords = initialSelectionCoordsRef.current

          if (!view || !coords) return

          const resolved = view.posAtCoords({
            left: coords.clientX,
            top: coords.clientY,
          })
          const anchoredPos = findSelectionPosFromTextAnchor(view, coords)

          view.focus()

          const pos = typeof anchoredPos === 'number' ? anchoredPos : resolved?.pos

          if (typeof pos === 'number') {
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
            window.requestAnimationFrame(() => {
              const root = rootRef.current
              if (!root) return

              root.classList.remove('is-caret-repaint')
              void root.offsetHeight
              root.classList.add('is-caret-repaint')
            })
          }

          initialSelectionCoordsRef.current = null
          onInitialSelectionAppliedRef.current?.()
        })
      })
    }
  }, [readOnly])

  return <div ref={rootRef} className={`milkdown-host ${readOnly ? 'is-readonly' : ''}`} />
}
