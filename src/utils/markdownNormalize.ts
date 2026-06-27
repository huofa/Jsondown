export type MarkdownNormalizeChange = {
  type: string
  count: number
  description: string
}

export type MarkdownNormalizeResult = {
  markdown: string
  changed: boolean
  changes: MarkdownNormalizeChange[]
  warnings: MarkdownNormalizeChange[]
}

type Counter = Record<string, number>

type HeadingCandidate = {
  index: number
  rawLevel: number
  text: string
  kind?: 'markdown' | 'html' | 'styled' | 'bold' | 'colon' | 'numbered'
}

type ProcessedLine = {
  text: string
  protected: boolean
  heading?: HeadingCandidate
}

const changeDescriptions: Record<string, string> = {
  lineEnding: '统一换行格式',
  trailingWhitespace: '删除行尾多余空格',
  blankWhitespace: '清理只有空格的空行',
  br: '独立 br 转为 Markdown 空行',
  emptySpan: '删除空 span',
  htmlHeading: 'HTML 标题转为 Markdown 标题',
  headingLevel: '标题层级压缩为 Jsondown 四档标题',
  headingSyntax: '清理标题多余符号',
  headingHierarchy: '按正文结构压缩标题层级',
  falseCodeFence: '普通说明文字代码块转回 Markdown 正文',
  separator: '超长分割线转为 ---',
  emptyLines: '连续空行压缩',
  spanStyle: '清理 span 中非 Jsondown 标准样式',
}

const warningDescriptions: Record<string, string> = {
  nonStandardHtmlStyle: '发现非标准 HTML 样式，已按 Jsondown 白名单处理',
  complexHtml: '发现复杂 HTML 标签，第一版暂不处理',
}

const add = (counter: Counter, key: string, amount = 1) => {
  counter[key] = (counter[key] ?? 0) + amount
}

const toChangeList = (counter: Counter, descriptions: Record<string, string>) =>
  Object.entries(counter)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, count, description: descriptions[type] ?? type }))

const stripWrappingMarks = (value: string) => {
  let text = value.trim()
  let changed = false

  for (let guard = 0; guard < 4; guard += 1) {
    const next = text
      .replace(/^#{1,6}\s*/, '')
      .replace(/\s*#{1,6}$/, '')
      .replace(/^\*{1,3}([\s\S]*?)\*{1,3}$/, '$1')
      .replace(/^_{1,3}([\s\S]*?)_{1,3}$/, '$1')
      .replace(/^~~([\s\S]*?)~~$/, '$1')
      .trim()
    if (next === text) break
    changed = true
    text = next
  }

  return { text, changed }
}

const headingLevelFromFontSize = (style: string) => {
  const match = style.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i)
  if (!match) return null
  const size = Number(match[1])
  if (size >= 24) return 1
  if (size >= 20) return 2
  if (size >= 16) return 3
  if (size >= 13) return 4
  return 6
}

function sanitizeSpanStyleInLine(line: string, changes: Counter, warnings: Counter) {
  return line.replace(
    /<span\b([^>]*)style=(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/span>/gi,
    (_match, before: string, quote: string, style: string, after: string, content: string) => {
      if (!content.trim()) {
        add(changes, 'emptySpan')
        return ''
      }

      const allowed: string[] = []
      for (const declaration of style.split(';')) {
        const [rawName, ...rawValue] = declaration.split(':')
        const name = rawName?.trim().toLowerCase()
        const value = rawValue.join(':').trim()
        if (!name || !value) continue
        if ((name === 'color' || name === 'background-color') && /^#[0-9a-f]{3,8}$/i.test(value)) {
          allowed.push(`${name}:${value}`)
        } else {
          add(warnings, 'nonStandardHtmlStyle')
        }
      }

      if (allowed.length === 0) {
        add(changes, 'spanStyle')
        return content
      }

      if (allowed.join(';') !== style.replace(/\s+/g, '')) add(changes, 'spanStyle')
      return `<span${before}${after} style=${quote}${allowed.join(';')}${quote}>${content}</span>`
    },
  )
}

function detectHeading(line: string, index: number, changes: Counter): HeadingCandidate | undefined {
  const trimmed = line.trim()

  const html = trimmed.match(/^<h([1-6])\b[^>]*>(.*?)<\/h\1>$/i)
  if (html) {
    const rawLevel = Math.min(Number(html[1]), 6)
    const { text, changed } = stripWrappingMarks(html[2])
    add(changes, 'htmlHeading')
    if (changed) add(changes, 'headingSyntax')
    return text ? { index, rawLevel, text, kind: 'html' } : undefined
  }

  const atx = trimmed.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
  if (atx) {
    const { text, changed } = stripWrappingMarks(atx[2])
    if (changed || atx[1].length > 4) add(changes, atx[1].length > 4 ? 'headingLevel' : 'headingSyntax')
    return text ? { index, rawLevel: atx[1].length, text, kind: 'markdown' } : undefined
  }

  const boldOnly = trimmed.match(/^(\*{2,3}|_{2,3})(.+?)\1$/)
  if (boldOnly && boldOnly[2].trim().length <= 56) {
    const { text, changed } = stripWrappingMarks(boldOnly[2])
    add(changes, 'headingSyntax')
    if (changed) add(changes, 'headingSyntax')
    return text ? { index, rawLevel: 6, text, kind: 'bold' } : undefined
  }

  const colonTitle = trimmed.match(/^(.{2,36})[:：]$/)
  if (colonTitle && !/^[-*+]\s/.test(trimmed) && !/^\d+[.)、．]\s+/.test(trimmed)) {
    return { index, rawLevel: 6, text: colonTitle[1].trim(), kind: 'colon' }
  }

  const numberedTitle = trimmed.match(/^(\d{1,2})[.)、．]\s+(.{1,86})$/)
  if (numberedTitle) {
    const body = numberedTitle[2].trim()
    const looksLikeSection =
      body.length <= 28 ||
      /[:：]/.test(body) ||
      /^(核心|目标|判断|结论|方案|推荐|问题|原因|原则|步骤|总结|AI|我|你|Jsondown|V\d)/i.test(body)
    if (looksLikeSection) {
      const { text, changed } = stripWrappingMarks(`${numberedTitle[1]}. ${body}`)
      if (changed) add(changes, 'headingSyntax')
      return text ? { index, rawLevel: 6, text, kind: 'numbered' } : undefined
    }
  }

  return undefined
}

function normalizeEditableLine(line: string, index: number, changes: Counter, warnings: Counter): ProcessedLine {
  let next = line
  const trimmedRight = next.replace(/[ \t]+$/g, '')
  if (trimmedRight !== next) {
    add(changes, 'trailingWhitespace')
    next = trimmedRight
  }

  if (/^[ \t]+$/.test(next)) {
    add(changes, 'blankWhitespace')
    return { text: '', protected: false }
  }

  if (/^\s*<br\s*\/?>\s*$/i.test(next)) {
    add(changes, 'br')
    return { text: '', protected: false }
  }

  const fullFontSizeSpan = next.trim().match(/^<span\b[^>]*style=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/span>$/i)
  if (fullFontSizeSpan) {
    const rawLevel = headingLevelFromFontSize(fullFontSizeSpan[2])
    if (rawLevel !== null) {
      const { text, changed } = stripWrappingMarks(fullFontSizeSpan[3])
      add(changes, 'spanStyle')
      add(changes, 'headingSyntax')
      if (changed) add(changes, 'headingSyntax')
      return {
        text,
        protected: false,
        heading: text ? { index, rawLevel, text, kind: 'styled' } : undefined,
      }
    }
  }

  next = sanitizeSpanStyleInLine(next, changes, warnings)
  next = next.replace(/<span\b[^>]*>\s*<\/span>/gi, () => {
    add(changes, 'emptySpan')
    return ''
  })

  if (/^\s{0,3}([-*_])(?:\s*\1){3,}\s*$/.test(next)) {
    add(changes, 'separator')
    return { text: '---', protected: false }
  }

  if (/<(script|iframe|style|object|embed|section|div|button|input)\b/i.test(next)) {
    add(warnings, 'complexHtml')
  }

  return { text: next, protected: false, heading: detectHeading(next, index, changes) }
}

function applyHeadingHierarchy(lines: ProcessedLine[], changes: Counter) {
  const headings = lines
    .map((line, index) => line.heading ? { ...line.heading, index } : null)
    .filter((value): value is HeadingCandidate => Boolean(value))
    .filter((heading) => {
      if (heading.kind !== 'numbered') return true

      const previous = findNearbyContentLine(lines, heading.index, -1)
      const next = findNearbyContentLine(lines, heading.index, 1)
      const previousIsOrdered = Boolean(previous?.text.trim().match(/^\d{1,3}[.)、．]\s+/))
      const nextIsOrdered = Boolean(next?.text.trim().match(/^\d{1,3}[.)、．]\s+/))

      if ((previousIsOrdered || nextIsOrdered) && !/[:：]/.test(heading.text)) return false
      return true
    })

  if (headings.length === 0) return

  const structuralRanks = inferConservativeHeadingRanks(headings)

  for (const heading of headings) {
    const rank = structuralRanks.get(heading.index) ?? 0
    const nextLevel = Math.max(1, 4 - rank)
    const nextText = `${'#'.repeat(nextLevel)} ${heading.text}`
    if (lines[heading.index].text !== nextText) add(changes, 'headingHierarchy')
    lines[heading.index] = { ...lines[heading.index], text: nextText }
  }
}

function inferConservativeHeadingRanks(headings: HeadingCandidate[]) {
  const ranks = new Map<number, number>()
  const directChildren = new Map<number, HeadingCandidate[]>()

  for (const heading of headings) {
    ranks.set(heading.index, 0)
    directChildren.set(heading.index, [])
  }

  for (let index = 0; index < headings.length; index += 1) {
    const parent = headings[index]
    const children: HeadingCandidate[] = []
    let childRawLevel: number | null = null

    for (let cursor = index + 1; cursor < headings.length; cursor += 1) {
      const candidate = headings[cursor]
      if (candidate.rawLevel <= parent.rawLevel) break
      if (childRawLevel === null) childRawLevel = candidate.rawLevel
      if (candidate.rawLevel === childRawLevel) children.push(candidate)
    }

    directChildren.set(parent.index, children)
  }

  for (let pass = 0; pass < 4; pass += 1) {
    for (let index = headings.length - 1; index >= 0; index -= 1) {
      const heading = headings[index]
      const children = directChildren.get(heading.index) ?? []
      const childRanks = children.map((child) => ranks.get(child.index) ?? 0)
      const childGroupCount = children.length
      const rankedChildGroupCount = childRanks.filter((rank) => rank > 0).length

      let nextRank = 0
      if (childGroupCount >= 2) nextRank = 1
      if (rankedChildGroupCount >= 2) nextRank = 2
      if (rankedChildGroupCount >= 2 && childRanks.some((rank) => rank >= 2)) nextRank = 3

      ranks.set(heading.index, Math.max(ranks.get(heading.index) ?? 0, nextRank))
    }
  }

  return ranks
}

function findNearbyContentLine(lines: ProcessedLine[], startIndex: number, direction: -1 | 1) {
  for (let index = startIndex + direction; index >= 0 && index < lines.length; index += direction) {
    const line = lines[index]
    if (line.protected) continue
    if (!line.text.trim()) continue
    return line
  }
  return null
}

function compressEmptyLines(lines: ProcessedLine[], changes: Counter) {
  const result: ProcessedLine[] = []
  let emptyRun = 0
  let removed = 0

  for (const line of lines) {
    if (!line.text.trim()) {
      emptyRun += 1
      if (emptyRun <= 1 && result.length > 0) result.push({ ...line, text: '' })
      else removed += 1
      continue
    }
    emptyRun = 0
    result.push(line)
  }

  while (result.length && !result[0].text.trim()) {
    result.shift()
    removed += 1
  }
  while (result.length && !result[result.length - 1].text.trim()) {
    result.pop()
    removed += 1
  }

  if (removed > 0) add(changes, 'emptyLines', removed)
  return result
}

const nonCodeFenceLanguages = new Set(['', 'text', 'txt', 'plain', 'plaintext', 'md', 'markdown'])

function getFenceInfo(line: string) {
  const match = line.match(/^\s*(```|~~~)\s*([A-Za-z0-9_-]+)?/)
  if (!match) return null
  return {
    marker: match[1],
    language: (match[2] ?? '').trim().toLowerCase(),
  }
}

function isProbablyJson(value: string) {
  const trimmed = value.trim()
  if (!trimmed || !/^[{[]/.test(trimmed)) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

function isRealCodeFence(openingLine: string, contentLines: string[]) {
  const info = getFenceInfo(openingLine)
  if (!info) return false

  const language = info.language
  const content = contentLines.join('\n')

  if (language === 'json' || isProbablyJson(content)) return true
  if (!nonCodeFenceLanguages.has(language)) return true

  const nonEmptyLines = contentLines.map((line) => line.trim()).filter(Boolean)
  if (nonEmptyLines.length === 0) return false

  const codeSignals = [
    /^\s*(import|export|const|let|var|function|class|return|if|for|while|try|catch|switch)\b/m,
    /^\s*(def|class|from|import|return|if|for|while|try|except|with)\b/m,
    /^\s*(fn|pub|use|impl|let|match|enum|struct|trait)\b/m,
    /^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/im,
    /=>|==={0,1}|!==?|&&|\|\||[{};]/,
    /^\s*[$>]\s+\w+/m,
  ]

  if (codeSignals.some((pattern) => pattern.test(content))) return true

  const symbolHeavyLineCount = nonEmptyLines.filter((line) => {
    const symbolCount = (line.match(/[{}()[\];=<>/\\|]/g) ?? []).length
    return symbolCount >= Math.max(2, Math.ceil(line.length * 0.12))
  }).length

  return symbolHeavyLineCount >= Math.max(2, Math.ceil(nonEmptyLines.length * 0.45))
}

export function normalizeMarkdownForJsondown(input: string): MarkdownNormalizeResult {
  const changes: Counter = {}
  const warnings: Counter = {}
  const normalizedInput = input.replace(/\r\n?/g, '\n')
  if (normalizedInput !== input) add(changes, 'lineEnding')

  const lines = normalizedInput.split('\n')
  const processed: ProcessedLine[] = []
  let inFrontMatter = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()

    if (index === 0 && trimmed === '---') {
      inFrontMatter = true
      processed.push({ text: line, protected: true })
      continue
    }

    if (inFrontMatter) {
      processed.push({ text: line, protected: true })
      if (index > 0 && trimmed === '---') inFrontMatter = false
      continue
    }

    if (getFenceInfo(line)) {
      const fenceInfo = getFenceInfo(line)
      const blockLines = [line]
      const contentLines: string[] = []
      let closingIndex = -1

      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor]
        if (candidate.trim().startsWith(fenceInfo?.marker ?? '```')) {
          blockLines.push(candidate)
          closingIndex = cursor
          break
        }
        blockLines.push(candidate)
        contentLines.push(candidate)
      }

      if (closingIndex === -1 || isRealCodeFence(line, contentLines)) {
        blockLines.forEach((blockLine) => processed.push({ text: blockLine, protected: true }))
        if (closingIndex !== -1) index = closingIndex
        else index = lines.length
        continue
      }

      add(changes, 'falseCodeFence')
      contentLines.forEach((contentLine) => {
        processed.push(normalizeEditableLine(contentLine, processed.length, changes, warnings))
      })
      index = closingIndex
      continue
    }

    processed.push(normalizeEditableLine(line, processed.length, changes, warnings))
  }

  applyHeadingHierarchy(processed, changes)
  const compressed = compressEmptyLines(processed, changes)
  const markdown = compressed.map((line) => line.text).join('\n')

  return {
    markdown,
    changed: markdown !== input,
    changes: toChangeList(changes, changeDescriptions),
    warnings: toChangeList(warnings, warningDescriptions),
  }
}
