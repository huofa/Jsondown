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

const CODE_BLOCK_LANGUAGES = ['text', 'json', 'yaml', 'html'] as const

const normalizeCodeBlockLanguage = (value?: string | null) => {
  const language = (value || '').trim().toLowerCase()

  if (!language) return 'text'
  if (language === 'txt') return 'text'
  if (language === 'plain') return 'text'
  if (language === 'plaintext') return 'text'
  if (language === 'yml') return 'yaml'
  if (language === 'js') return 'javascript'
  if (language === 'ts') return 'typescript'
  if (language === 'md') return 'markdown'

  if (CODE_BLOCK_LANGUAGES.includes(language as typeof CODE_BLOCK_LANGUAGES[number])) {
    return language
  }

  return language
}

const getCodeBlockLanguage = (block: HTMLElement) => {
  const fromPre = block.getAttribute('data-language')
  if (fromPre) return normalizeCodeBlockLanguage(fromPre)

  const code = block.querySelector('code')
  const fromCode = code?.getAttribute('data-language')
  if (fromCode) return normalizeCodeBlockLanguage(fromCode)

  const className = `${block.className || ''} ${code?.className || ''}`
  const classMatch = className.match(/language-([a-z0-9_-]+)/i)
  if (classMatch?.[1]) return normalizeCodeBlockLanguage(classMatch[1])

  return 'text'
}

const getCodeBlockText = (block: HTMLElement) => {
  const clone = block.cloneNode(true) as HTMLElement
  clone.querySelectorAll([
    '.jd-code-copy-button',
    '.tools',
    '.tools-button-group',
    '.language-button',
    '.language-picker',
    '.cm-gutters',
    '.cm-lineNumbers',
  ].join(',')).forEach((node) => node.remove())
  return clone.textContent || ''
}

const copyIconSvg = `
  <svg class="jd-code-copy-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="9" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2.25"/>
    <path d="M5 15V7a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"/>
  </svg>
`

const copiedIconSvg = `
  <svg class="jd-code-copy-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`

const setCodeCopyButtonState = (button: HTMLButtonElement, copied: boolean) => {
  button.dataset.copied = copied ? 'true' : 'false'
  button.setAttribute('aria-label', copied ? '已复制代码块内容' : '复制代码块内容')
  button.innerHTML = copied
    ? `${copiedIconSvg}<span class="jd-code-copy-label">已复制</span>`
    : copyIconSvg
}

const patchSingleCodeBlock = (block: HTMLElement) => {
  const language = getCodeBlockLanguage(block)

  block.setAttribute('data-language', language.toUpperCase())
  block.setAttribute('data-jsondown-code-block', 'true')

  const exists = block.querySelector(':scope > .jd-code-copy-button')
  if (exists) return

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'jd-code-copy-button'
  button.setAttribute('contenteditable', 'false')
  button.setAttribute('tabindex', '-1')
  setCodeCopyButtonState(button, false)

  block.appendChild(button)
}

const patchCodeBlocks = (root: HTMLElement) => {
  const codeBlocks = root.querySelectorAll<HTMLElement>('.milkdown-code-block, .ProseMirror pre, pre')
  codeBlocks.forEach(patchSingleCodeBlock)
}

const patchAddedCodeBlockNode = (node: Node) => {
  if (!(node instanceof HTMLElement)) return

  if (node instanceof HTMLPreElement || node.classList.contains('milkdown-code-block')) {
    patchSingleCodeBlock(node)
    return
  }

  node.querySelectorAll<HTMLElement>('.milkdown-code-block, pre').forEach(patchSingleCodeBlock)
}

const bindCodeBlockCopyAndPatch = (root: HTMLElement) => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach(patchAddedCodeBlockNode)
    })
  })

  observer.observe(root, { childList: true, subtree: true })

  const handleMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    const button = target?.closest?.('.jd-code-copy-button') as HTMLButtonElement | null
    if (!button) return

    event.preventDefault()
    event.stopPropagation()
  }

  const handlePointerOver = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null
    const block = target?.closest?.('.milkdown-code-block, pre') as HTMLElement | null
    if (!block) return

    patchSingleCodeBlock(block)
  }

  const handleClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    const button = target?.closest?.('.jd-code-copy-button') as HTMLButtonElement | null
    if (!button) return

    event.preventDefault()
    event.stopPropagation()

    const block = button.closest('.milkdown-code-block, pre') as HTMLElement | null
    if (!block) return

    const text = getCodeBlockText(block)

    try {
      await navigator.clipboard.writeText(text)
      setCodeCopyButtonState(button, true)
      window.setTimeout(() => {
        setCodeCopyButtonState(button, false)
      }, 900)
    } catch {
      button.dataset.copied = 'true'
      button.innerHTML = '<span class="jd-code-copy-label">失败</span>'
      window.setTimeout(() => {
        setCodeCopyButtonState(button, false)
      }, 900)
    }
  }

  root.addEventListener('pointerover', handlePointerOver)
  root.addEventListener('mousedown', handleMouseDown, true)
  root.addEventListener('click', handleClick, true)

  return () => {
    observer.disconnect()
    root.removeEventListener('pointerover', handlePointerOver)
    root.removeEventListener('mousedown', handleMouseDown, true)
    root.removeEventListener('click', handleClick, true)
  }
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
  readOnly?: boolean
  onChange: (markdown: string) => void
  onReady?: (api: EditorCommandApi | null) => void
  onVisualReady?: () => void
}

export function MilkdownEditor({
  value,
  autoFocusStart,
  readOnly = false,
  onChange,
  onReady,
  onVisualReady,
}: MilkdownEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const onVisualReadyRef = useRef(onVisualReady)
  const initialValueRef = useRef(value)
  const readOnlyRef = useRef(readOnly)
  const editorViewRef = useRef<EditorView | null>(null)

  onChangeRef.current = onChange
  onReadyRef.current = onReady
  onVisualReadyRef.current = onVisualReady
  readOnlyRef.current = readOnly

  useEffect(() => {
    if (!rootRef.current) return

    let disposed = false
    let disconnectCodeBlockCopy: (() => void) | null = null

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

      const root = rootRef.current

      const markVisualReady = () => {
        if (disposed) return
        const currentRoot = rootRef.current
        if (currentRoot) patchCodeBlocks(currentRoot)
        onVisualReadyRef.current?.()
      }

      if (root) {
        disconnectCodeBlockCopy = bindCodeBlockCopyAndPatch(root)

        window.requestAnimationFrame(() => {
          if (disposed) return
          patchCodeBlocks(root)
          window.requestAnimationFrame(() => {
            if (disposed) return
            patchCodeBlocks(root)
            window.setTimeout(markVisualReady, 80)
          })
        })
      } else {
        markVisualReady()
      }

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

      disconnectCodeBlockCopy?.()
      disconnectCodeBlockCopy = null

      editorViewRef.current = null
      onReadyRef.current?.(null)

      void createPromise.then(() => crepe.destroy())
    }
  }, [])

  useLayoutEffect(() => {
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
