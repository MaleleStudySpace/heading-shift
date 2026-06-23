# Heading Shift

> [English](#english) | [中文](#中文)

---

## English

Promote or demote heading levels **together with all sub-headings** at once, similar to Typora's behavior when shifting an entire section's hierarchy.

### Features

- **Promote**: Remove one `#` from the heading (H1 → plain text)
- **Demote**: Add one `#` to the heading (H6 stays H6)
- Operates on the entire sub-tree (all child headings under the target)
- Skips headings inside code fences (``` / ~~~)
- Preserves cursor position and scroll viewport

### Example

Before (cursor on `## Section A`):

```markdown
# Document
## Section A
### Sub A1
some text
## Section B
```

After promote → `## Section A` and its child `### Sub A1` both shift up:

```markdown
# Document
# Section A
## Sub A1
some text
## Section B
```

Note: Sibling `## Section B` is unaffected. The sub-tree scope ends at the next heading with level ≤ the root.

### Default Shortcuts

| Action | Shortcut | Command Name |
| --- | --- | --- |
| Promote (with sub-headings) | `Ctrl+Shift+=` | `Promote heading (with sub-headings)` |
| Demote (with sub-headings) | `Ctrl+Shift+-` | `Demote heading (with sub-headings)` |

- Customizable in **Settings → Hotkeys** (search `heading`)
- Also available via **Command Palette** (`Ctrl+P`)

### Installation

**From Community Plugins:**

1. Open Obsidian → Settings → Community Plugins → Browse
2. Search for "Heading Shift"
3. Install and enable

**Manual:**

1. Download [`main.js`](https://github.com/MaleleStudyHome/heading-shift/releases/latest/download/main.js) and [`manifest.json`](https://github.com/MaleleStudyHome/heading-shift/releases/latest/download/manifest.json)
2. Create folder: `<your vault>/.obsidian/plugins/heading-shift/`
3. Place the files there
4. Enable in Settings → Community Plugins

### How It Works

1. **Find heading**: Uses the heading at cursor line; falls back to the nearest heading above.
2. **Define sub-tree**: From the target heading to the next heading with level ≤ root level.
3. **Shift**: Each heading in the sub-tree gets ±1 level. Uses per-line replacements to preserve scroll position.

### License

MIT

---

## 中文

一键**整体提升 / 降低标题一级**（连同其下方所有子标题一起），复刻 Typora 里把一个章节整段挪层级的行为。

### 功能

- **提升一级**：`#` 减少（H1 再提升 → 变普通段落）
- **降低一级**：`#` 增加（H6 再降低 → 保持 H6，不越界）
- 对整个子树生效（该标题下方所有更深层子标题一起动）
- 自动跳过代码块（` ``` ` / `~~~`）内部的 `#` 行
- 保持光标位置和视口滚动不变

### 示例

提升前（光标在 `## 二级 A` 上）：

```markdown
# 文档
## 二级 A
### 三级 A1
some text
## 二级 B
```

提升后 → `## 二级 A` 及其子标题 `### 三级 A1` 同步提升：

```markdown
# 文档
# 二级 A
## 三级 A1
some text
## 二级 B
```

注意：同级兄弟 `## 二级 B` 不受影响，子树范围到「下一个同级或更高级标题」为止。

### 默认快捷键

| 操作 | 快捷键 | 命令名 |
| --- | --- | --- |
| 提升一级（含子标题） | `Ctrl+Shift+=` | `Promote heading (with sub-headings)` |
| 降低一级（含子标题） | `Ctrl+Shift+-` | `Demote heading (with sub-headings)` |

- 可在 **设置 → 快捷键** 搜 `heading` 自行改键
- 也可用 **命令面板**（`Ctrl+P`）触发

### 安装

**从社区插件市场：**

1. Obsidian → 设置 → 第三方插件 → 浏览
2. 搜索 "Heading Shift"
3. 安装并启用

**手动安装：**

1. 下载 [`main.js`](https://github.com/MaleleStudyHome/heading-shift/releases/latest/download/main.js) 和 [`manifest.json`](https://github.com/MaleleStudyHome/heading-shift/releases/latest/download/manifest.json)
2. 创建文件夹：`<你的 vault>/.obsidian/plugins/heading-shift/`
3. 把文件放入
4. 在 设置 → 第三方插件 中启用

### 工作原理

1. **定位标题**：取光标所在 `#` 行；若不在标题行上，回退到上方最近的标题
2. **划分子树**：从该标题到「下一个级别 ≤ 根级别的标题」之前
3. **同步位移**：子树内每个标题 ±1 级，逐行替换保持视口不变

### 许可

MIT
