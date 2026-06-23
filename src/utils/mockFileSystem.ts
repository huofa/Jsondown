import type { RootFolder } from '../types/rootFolder'

const makePreviewSvg = (label: string, color: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760">
      <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#f7eee1"/></linearGradient></defs>
      <rect width="1200" height="760" rx="36" fill="url(#g)"/>
      <circle cx="940" cy="170" r="190" fill="#fff" opacity=".35"/>
      <circle cx="210" cy="640" r="280" fill="#fff" opacity=".2"/>
      <text x="90" y="160" font-family="Arial" font-size="42" fill="#3c352e">${label}</text>
      <text x="90" y="220" font-family="Arial" font-size="22" fill="#655d55">Jsondown visual note</text>
    </svg>
  `)}`

export const mockRootFolders: RootFolder[] = [
  {
    id: 'root-notes',
    name: 'Jsondown Notes',
    path: '/Users/demo/Documents/Jsondown Notes',
    order: 0,
    pinned: true,
    lastOpenedAt: '2026-06-23T08:40:00.000Z',
    tree: [
      {
        id: 'dir-inbox',
        name: 'Inbox',
        path: '/Users/demo/Documents/Jsondown Notes/Inbox',
        kind: 'directory',
        children: [
          { id: 'file-welcome', name: '欢迎使用 Jsondown.md', path: '/Users/demo/Documents/Jsondown Notes/Inbox/欢迎使用 Jsondown.md', kind: 'file', extension: 'md' },
          { id: 'file-ideas', name: '灵感清单.markdown', path: '/Users/demo/Documents/Jsondown Notes/Inbox/灵感清单.markdown', kind: 'file', extension: 'markdown' },
        ],
      },
      {
        id: 'dir-projects',
        name: 'Projects',
        path: '/Users/demo/Documents/Jsondown Notes/Projects',
        kind: 'directory',
        children: [
          {
            id: 'dir-jsondown',
            name: 'Jsondown',
            path: '/Users/demo/Documents/Jsondown Notes/Projects/Jsondown',
            kind: 'directory',
            children: [
              { id: 'file-roadmap', name: 'V0.1 路线图.md', path: '/Users/demo/Documents/Jsondown Notes/Projects/Jsondown/V0.1 路线图.md', kind: 'file', extension: 'md' },
              { id: 'file-config', name: 'settings.json', path: '/Users/demo/Documents/Jsondown Notes/Projects/Jsondown/settings.json', kind: 'file', extension: 'json' },
              { id: 'file-component', name: 'EditorPane.tsx', path: '/Users/demo/Documents/Jsondown Notes/Projects/Jsondown/EditorPane.tsx', kind: 'file', extension: 'tsx' },
            ],
          },
          { id: 'file-brief', name: '产品简报.txt', path: '/Users/demo/Documents/Jsondown Notes/Projects/产品简报.txt', kind: 'file', extension: 'txt' },
        ],
      },
      {
        id: 'dir-assets',
        name: 'Assets',
        path: '/Users/demo/Documents/Jsondown Notes/Assets',
        kind: 'directory',
        children: [
          { id: 'file-cover', name: 'cover.svg', path: '/Users/demo/Documents/Jsondown Notes/Assets/cover.svg', kind: 'file', extension: 'svg' },
          { id: 'file-hidden', name: 'archive.zip', path: '/Users/demo/Documents/Jsondown Notes/Assets/archive.zip', kind: 'file', extension: 'zip' },
        ],
      },
      { id: 'file-readme', name: 'README.md', path: '/Users/demo/Documents/Jsondown Notes/README.md', kind: 'file', extension: 'md' },
    ],
  },
  {
    id: 'root-work',
    name: '工作手记',
    path: '/Users/demo/Work/工作手记',
    order: 1,
    lastOpenedAt: '2026-06-22T15:20:00.000Z',
    tree: [
      {
        id: 'dir-weekly',
        name: '周报',
        path: '/Users/demo/Work/工作手记/周报',
        kind: 'directory',
        children: [
          { id: 'file-week25', name: '2026-W25.md', path: '/Users/demo/Work/工作手记/周报/2026-W25.md', kind: 'file', extension: 'md' },
          { id: 'file-week24', name: '2026-W24.md', path: '/Users/demo/Work/工作手记/周报/2026-W24.md', kind: 'file', extension: 'md' },
        ],
      },
      { id: 'file-api', name: 'api-example.html', path: '/Users/demo/Work/工作手记/api-example.html', kind: 'file', extension: 'html' },
      { id: 'file-script', name: 'cleanup.py', path: '/Users/demo/Work/工作手记/cleanup.py', kind: 'file', extension: 'py' },
    ],
  },
]

export const mockFileMeta: Record<string, { updatedAt: string; size: number }> = {
  '/Users/demo/Documents/Jsondown Notes/Inbox/欢迎使用 Jsondown.md': { updatedAt: '2026-06-23T08:36:00.000Z', size: 2470 },
  '/Users/demo/Documents/Jsondown Notes/Inbox/灵感清单.markdown': { updatedAt: '2026-06-22T12:05:00.000Z', size: 918 },
  '/Users/demo/Documents/Jsondown Notes/Projects/Jsondown/V0.1 路线图.md': { updatedAt: '2026-06-23T07:10:00.000Z', size: 3360 },
  '/Users/demo/Documents/Jsondown Notes/Projects/Jsondown/settings.json': { updatedAt: '2026-06-21T09:24:00.000Z', size: 426 },
  '/Users/demo/Documents/Jsondown Notes/Projects/Jsondown/EditorPane.tsx': { updatedAt: '2026-06-20T15:30:00.000Z', size: 1803 },
  '/Users/demo/Documents/Jsondown Notes/Projects/产品简报.txt': { updatedAt: '2026-06-18T04:42:00.000Z', size: 774 },
  '/Users/demo/Documents/Jsondown Notes/Assets/cover.svg': { updatedAt: '2026-06-17T06:15:00.000Z', size: 4032 },
  '/Users/demo/Documents/Jsondown Notes/README.md': { updatedAt: '2026-06-16T11:02:00.000Z', size: 1460 },
  '/Users/demo/Work/工作手记/周报/2026-W25.md': { updatedAt: '2026-06-22T10:20:00.000Z', size: 2050 },
  '/Users/demo/Work/工作手记/周报/2026-W24.md': { updatedAt: '2026-06-15T10:20:00.000Z', size: 1912 },
  '/Users/demo/Work/工作手记/api-example.html': { updatedAt: '2026-06-12T08:10:00.000Z', size: 840 },
  '/Users/demo/Work/工作手记/cleanup.py': { updatedAt: '2026-06-11T13:55:00.000Z', size: 605 },
}

export const mockFileContents: Record<string, string> = {
  'file-welcome': `# 欢迎使用 Jsondown

Jsondown 是一张安静的本地 Markdown 草稿纸。左边整理文件夹，中间找到文件，右边只管写作。

## V0.1 正在验证什么？

- [x] 三栏备忘录式布局
- [x] 递归扫描后的扁平文件列表
- [x] 使用 Crepe 编辑标准 Markdown
- [ ] 接入 Tauri 本地文件系统

> 点击正文即可开始编辑。停笔 800ms 后，右上角会显示模拟保存状态。

### 一段代码

\`\`\`json
{
  "name": "Jsondown",
  "stage": "prototype",
  "localFirst": true
}
\`\`\`

你可以使用 **粗体**、*斜体*、任务列表、链接、表格和代码块。`,
  'file-ideas': `# 灵感清单

- 把编辑器做得像一张纸，而不是一个 IDE
- 文件夹是入口，不是“项目”
- 中栏只承担快速找到文件这件事
- 保存应该安静、可靠、可感知`,
  'file-roadmap': `# Jsondown V0.1 路线图

## 阶段 A：前端验证

1. 三栏布局与可拖动宽度
2. Mock 文件树与扁平列表
3. Crepe 富文本 Markdown
4. 自动保存状态

## 阶段 B：桌面能力

接入 Tauri、Rust 文件系统、系统对话框与文件监听。`,
  'file-config': `{
  "theme": "paper-white",
  "autoSaveDelay": 800,
  "editableExtensions": [".md", ".markdown"],
  "sync": false
}`,
  'file-component': `import { MilkdownEditor } from './MilkdownEditor'

type EditorPaneProps = {
  fileId: string
  readonly?: boolean
}

export function EditorPane({ fileId, readonly = false }: EditorPaneProps) {
  return <MilkdownEditor key={fileId} readonly={readonly} />
}`,
  'file-brief': `产品原则

1. 本地优先。
2. Markdown 是最终格式。
3. 写作体验优先于工程感。
4. 不引入 AI、云同步或数据库。`,
  'file-cover': makePreviewSvg('Jsondown · quiet writing space', '#d7c5a5'),
  'file-readme': `# Notes

这里收纳 Jsondown 的产品笔记、设计草稿和实现记录。

从左侧文件树理解结构，从中间列表快速检索，在右侧沉浸编辑。`,
  'file-week25': `# 2026 · W25

## 本周完成

- 整理 V0.1 需求口径
- 明确阶段 A / B 边界
- 开始前端原型

## 下周

- 验证 Crepe 编辑体验
- 讨论 Tauri 文件监听策略`,
  'file-week24': `# 2026 · W24

完成产品方向收敛：三栏、纯本地、Markdown 富文本。`,
  'file-api': `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>Preview</title></head>
  <body>
    <main>
      <h1>Jsondown HTML Preview</h1>
      <p>阶段 7 将支持安全的 inline preview。</p>
    </main>
  </body>
</html>`,
  'file-script': `from pathlib import Path

def markdown_files(root: Path):
    return [path for path in root.rglob("*") if path.suffix in {".md", ".markdown"}]

print(markdown_files(Path.home() / "Documents"))`,
}

export function createMockFolder(index: number): RootFolder {
  const id = `root-mock-${Date.now()}`
  const path = `/Users/demo/Documents/新建资料夹 ${index}`
  return {
    id,
    name: `新建资料夹 ${index}`,
    path,
    order: index + 10,
    tree: [
      {
        id: `${id}-note`,
        name: '未命名笔记.md',
        path: `${path}/未命名笔记.md`,
        kind: 'file',
        extension: 'md',
      },
    ],
  }
}
