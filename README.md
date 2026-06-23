# Jsondown Editor V0.1

Jsondown 是一个采用 React、TypeScript、Vite 与 Milkdown/Crepe 构建的本地 Markdown 富文本编辑器原型。当前版本是阶段 A：使用 Mock 文件系统验证三栏交互、文件浏览、富文本编辑与自动保存状态。

## 启动

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 当前实现（阶段 1–4）

- 备忘录式三栏布局，左右分隔条可拖动调宽
- 主文件夹入口、Mock 添加、删除入口、原生拖动排序
- 当前文件夹路径、可展开文件树、Mock「在访达中打开」
- 从文件树递归提取的扁平文件列表，中栏不显示文件夹
- 文件搜索与按修改时间、名称、路径排序
- 文件右键菜单：Mock 访达打开、复制 Mock 路径
- `.md` / `.markdown` 使用 Crepe 富文本编辑
- 其他支持类型以只读代码或图片方式查看
- 800ms debounce Mock 自动保存与完整保存状态模型
- 基础白纸、暖纸、灰白纸张切换（阶段 5 将继续精修）

## 尚未实现

- 阶段 5：完整三套草稿纸主题与 Crepe 视觉精修
- 阶段 6：JSON code block 复制、格式化、校验与选区生成 JSON
- 阶段 7：HTML code block 安全 inline preview
- 阶段 B：Tauri 文件对话框、真实读写、访达打开、文件监听与外部冲突处理

## 阶段 B 接入建议

用 Tauri dialog 替换 Mock 添加文件夹；由 Rust 递归扫描并返回 `FileTreeNode`；读取和保存操作保持现有 store 接口，通过 Tauri command 实现；使用文件监听把外部改动映射到 `external-changed` 状态；系统打开操作交给 Tauri opener。
