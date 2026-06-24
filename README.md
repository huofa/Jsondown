# Jsondown V1.0

Jsondown 是一个采用 React、TypeScript、Vite、Tauri 与 Milkdown/Crepe 构建的本地 Markdown 富文本编辑器。V1.0 主线目标是从前端 Mock 原型升级为真实本地文件系统版本：真实文件夹入口、真实文件树扫描、真实文件读写、Finder 打开、文件监听和安全最近删除。

## 安装与启动

推荐使用 pnpm：

```bash
pnpm install
pnpm tauri dev
pnpm tauri build
```

当前仓库仍保留 npm lock，本机没有 pnpm 时也可以使用：

```bash
npm install
npm run tauri:dev
npm run tauri:build
```

只运行网页验证层：

```bash
npm run dev
npm run build:web
```

## 当前实现

- macOS 备忘录式三栏布局，左右分隔条可拖动调宽。
- 右栏使用 Milkdown/Crepe 作为唯一 Markdown 编辑器内核。
- `.md` / `.markdown` 可编辑，其他支持类型以只读代码或图片占位方式查看。
- Tauri 2 桌面壳已接入。
- 支持选择真实本地文件夹作为 RootFolder 入口。
- 支持读取真实目录树，并过滤 `.git`、`node_modules`、`dist`、`build`、`.DS_Store`、`target`、`.next`、`.vite`、`coverage`、`.jsondown-trash` 等目录或文件。
- 目录树扫描只读取 metadata：文件名、路径、类型、大小、真实创建时间和真实修改时间，不读取正文。
- 中栏文件卡片使用异步 preview：默认只读取文件开头 4096 bytes，并提取前两行有效内容。
- 中栏 preview 首次加载前 20 个文件，滚动一屏后提前预加载下一屏；并发限制为 3，避免一次性读取大量文件。
- 搜索只匹配文件名、相对路径和已加载 preview，不触发全文读取。
- 支持真实读取文本文件。
- 支持 Markdown 自动保存写回原文件。
- 支持真实新建文件、次级文件夹、重命名文件或次级文件夹。
- 支持在 macOS Finder 中打开或定位文件。
- 支持将 RootFolder 内部文件 / 次级文件夹移动到 `.jsondown-trash/`。
- 支持读取所有 root folders 的 `trash-index.json` 并在最近删除中展示。
- 支持恢复最近删除项目。
- 支持永久删除最近删除项目，前端会二次确认。
- 支持基础文件监听，并在外部变化后刷新文件树；当前打开文件变化时标记 `external-changed`。

## 文件安全协议

- RootFolder 主文件夹入口只是 Jsondown 的配置入口。
- 移除 RootFolder 入口只删除 app config 中的入口，不删除真实本地文件夹，不进入最近删除。
- RootFolder 内部的文件和次级文件夹属于真实内容层。
- 删除真实内容时不会直接永久删除，而是移动到该 root folder 下的 `.jsondown-trash/`。
- `.jsondown-trash/trash-index.json` 记录原路径、trash 路径、删除时间和类型。
- 恢复时优先回到原路径；如果原路径已有同名项目，会自动用“_恢复”命名避免覆盖。
- 永久删除必须二次确认。

## V1.0 Rust commands

- `select_root_folder`
- `create_root_folder`
- `read_directory_tree`
- `read_file_preview`
- `read_text_file`
- `write_text_file`
- `reveal_in_finder`
- `load_app_config`
- `save_app_config`
- `create_child_folder`
- `create_file`
- `rename_path`
- `move_to_recently_deleted`
- `list_recently_deleted`
- `restore_deleted_file`
- `permanently_delete_trash_item`
- `watch_paths`

## 仍然保留或尚未完成

- 网页版仍保留 Mock fallback，便于继续做 UI 验证。
- 新建 RootFolder 的“选择父位置”目前前端仍用路径输入占位，后续可以补一个专门的父目录选择 command。
- 图片预览在 Tauri 下可以继续升级为 `convertFileSrc` 或自定义 asset protocol。
- 文件监听是基础版，复杂 rename / 批量变更边界后续继续增强。
- JSON block、HTML inline preview、纸张主题精修、MD 快捷菜单和包体积优化不在 V1.0 范围内。

## jianceV1.0 性能检测分支说明

`jianceV1.0` 分支只用于识别卡顿来源，不新增业务功能。检测逻辑只在开发模式启用，生产构建默认关闭前端 PerfPanel。

### PerfPanel 打开方式

- 开发模式右下角会显示 `Perf` 按钮。
- 也可以使用快捷键 `⌘ + Shift + P` 打开 / 关闭。

PerfPanel 会显示：

- 当前打开文件、大小、行数、字符数。
- 最近一次点击打开总耗时。
- 最近一次 `read_text_file` 耗时。
- 最近一次 Crepe 初始化耗时。
- 最近 5 秒 transaction / docChanged / selection-only 数量。
- 最近 5 秒 serialize 次数。
- 最近一次写入耗时。
- watcher 总事件、自保存事件、外部事件。
- 浏览器支持时显示 JS heap。

### 控制台日志类别

- `[perf][file-click]`：点击文件到 loading、打开总耗时。
- `[perf][file-read]`：前端 `read_text_file` 调用耗时。
- `[perf][crepe-init]`：Crepe 从 create 到 ready 的耗时。
- `[perf][input-transaction]`：ProseMirror transaction，区分 `docChanged` 与 selection-only。
- `[perf][serialize]`：Markdown 更新 / 自动保存快照序列化触发次数和耗时。
- `[perf][file-write]`：前端保存队列和写入耗时。
- `[perf][watcher]`：watcher 事件，并区分 `self-save` 和 `external`。
- `[perf][memory]`：当前文件和 JS heap 采样。

Rust debug 模式额外输出：

- `[perf][read_text_file] path=... bytes=... duration=...ms`
- `[perf][write_text_file] path=... bytes=... duration=...ms`
- `[perf][watcher] type=... paths=...`

### 阈值 warning

- `read_text_file > 300ms`
- `Crepe init > 500ms`
- `serialize > 200ms`
- `write_text_file > 300ms`
- 5 秒内 `serialize > 3` 次
- 5 秒内 watcher event > 20 次
- selection-only 误触发保存

### macOS 手动进程检测命令

Rust RSS 获取当前是 TODO，可先用系统命令观察：

```bash
ps aux | grep -i "jsondown\\|vite\\|node\\|WebKit" | grep -v grep
top -o cpu
sample <pid> 5 -file jsondown-sample.txt
vmmap <pid> | head -80
```
