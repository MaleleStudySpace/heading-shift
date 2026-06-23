/*
 * Heading Shift (Typora-style)
 * -------------------------------------------------------------
 * 一键整体提升 / 降低标题一级（连同其下方所有子标题）。
 *
 * 核心思路：
 *   1. 取当前光标所在标题（# 行），记其级别为 N。
 *   2. 该标题的「子树」范围 = 从这一行到「下一个级别 <= N 的标题」的前一行。
 *      也就是说：把这条标题以及它内部所有比它更深层的小标题，视作一个整体。
 *   3. 对子树范围内每一个标题行同步做 ±1 级别调整：
 *        - promote(提升)：级别 -1（# 越少级别越高）。已经是 H1 → 再提升则变成普通段落。
 *        - demote(降低)：级别 + 1。已经是 H6 → 再降低则保持 H6，避免越界。
 *   4. 跳过代码块（``` / ~~~ 包裹）内部的 # 行，避免误伤代码注释。
 *
 * 命令 / 快捷键：
 *   - Promote：Ctrl+Shift+=  (即 Ctrl+Shift++)
 *   - Demote ：Ctrl+Shift+-
 *   两条命令也会出现在 设置 → 快捷键，可自行修改。
 */

const { Plugin, MarkdownView } = require("obsidian");

/** 正则：匹配一行 ATX 标题，捕获前导 # 数量。允许 1~6 个 #，# 后不限定必须空格。 */
const HEADING_RE = /^( {0,3})(#{1,6})([ \t].*|$)/;

/**
 * 扫描全文，返回所有标题与代码块围栏的位置信息。
 * @param {string} text 全文
 * @returns {{ headings: {line:number, level:number, hashStart:number}[], fenced: {line:number, on:boolean, fenceChar:string}[] }}
 */
function scan(text) {
	const lines = text.split("\n");
	const headings = [];
	const fenced = []; // 每行是否处于代码块内（true=代码块内）
	let inFence = false;
	let fenceChar = "";

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		const line = raw.replace(/^\t+/, "    "); // tab → 4 空格，便于判断缩进
		const trimmed = line.trimStart();

		// 代码块围栏判定：``` 或 ~~~（>=3 个相同字符，允许尾部空格）
		const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
		if (fenceMatch) {
			const fc = fenceMatch[1][0];
			if (!inFence) {
				inFence = true;
				fenceChar = fc;
			} else if (fc === fenceChar) {
				inFence = false;
				fenceChar = "";
			}
			fenced.push(true); // 围栏行本身算作「代码块上下文」，内部不解析标题
			continue;
		}

		if (inFence) {
			fenced.push(true);
			continue;
		}

		const m = line.match(HEADING_RE);
		if (m) {
			headings.push({
				line: i,
				level: m[2].length,
				hashStart: m[1].length, // 行内 # 的起始列（用于精确替换）
			});
		}
		fenced.push(false);
	}

	return { headings, fenced };
}

/**
 * 找到光标所在标题。若光标不在任何标题行上，回退到「当前行上方最近的标题」。
 * @returns {{index:number}|null} 在 headings 数组中的下标，null 表示没有标题可用。
 */
function findCurrentHeading(headings, cursorLine) {
	let exact = -1;
	for (let i = 0; i < headings.length; i++) {
		if (headings[i].line === cursorLine) {
			exact = i;
			break;
		}
	}
	if (exact >= 0) return { index: exact };

	// 回退：找最后一个 line <= cursorLine 的标题
	let candidate = -1;
	for (let i = 0; i < headings.length; i++) {
		if (headings[i].line <= cursorLine) candidate = i;
		else break;
	}
	return candidate >= 0 ? { index: candidate } : null;
}

/**
 * 计算子树范围 [startIndex, endIndex]（在 headings 数组上的闭区间下标）。
 * 规则：从 startIndex 起，连续取所有「级别严格更深于根标题」的后续标题，
 *      直到遇到第一个「级别 <= 根级别」的标题为止（不含）。
 */
function subtreeRange(headings, startIndex) {
	const rootLevel = headings[startIndex].level;
	let end = startIndex;
	for (let i = startIndex + 1; i < headings.length; i++) {
		if (headings[i].level <= rootLevel) break;
		end = i;
	}
	return { start: startIndex, end };
}

/** 主流程：在编辑器上执行一次提升或降低。 */
function runShift(editor, action) {
	const text = editor.getValue();
	const cursorLine = editor.getCursor("from").line;

	const { headings, fenced } = scan(text);
	if (headings.length === 0) return;

	const cur = findCurrentHeading(headings, cursorLine);
	if (!cur) return;

	const { start, end } = subtreeRange(headings, cur.index);

	const lines = text.split("\n");
	const changes = [];
	for (let i = start; i <= end; i++) {
		const h = headings[i];
		const oldLine = lines[h.line];
		let newLine;

		if (action === "promote") {
			if (h.level <= 1) {
				const afterHash = oldLine.slice(h.hashStart + 1);
				newLine = afterHash.replace(/^ /, "");
			} else {
				const before = oldLine.slice(0, h.hashStart);
				const hashes = "#".repeat(h.level - 1);
				const after = oldLine.slice(h.hashStart + h.level);
				newLine = before + hashes + after;
			}
		} else {
			if (h.level >= 6) continue; // H6 不再降低
			const before = oldLine.slice(0, h.hashStart);
			const hashes = "#".repeat(h.level + 1);
			const after = oldLine.slice(h.hashStart + h.level);
			newLine = before + hashes + after;
		}

		if (newLine !== oldLine) {
			changes.push({
				from: { line: h.line, ch: 0 },
				to:   { line: h.line, ch: oldLine.length },
				text: newLine,
			});
		}
	}

	if (changes.length === 0) return;

	// 保存当前光标和滚动位置，替换后恢复。
	const savedCursor = editor.getCursor();
	const savedScroll = editor.getScrollInfo();
	editor.transaction({ changes });
	editor.setCursor(savedCursor);
	editor.scrollTo(savedScroll.left, savedScroll.top);
}

class HeadingShiftPlugin extends Plugin {
	onload() {
		const promoteCmd = this.addCommand({
			id: "heading-promote",
			name: "Promote heading (with sub-headings)",
			icon: "arrow-up",
			// 默认快捷键：Ctrl+Shift+=  (即 Ctrl+Shift++)
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "=" }],
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				const editor = view.editor;
				if (!editor) return false;
				if (checking) return true;
				runShift(editor, "promote");
			},
		});

		const demoteCmd = this.addCommand({
			id: "heading-demote",
			name: "Demote heading (with sub-headings)",
			icon: "arrow-down",
			// 默认快捷键：Ctrl+Shift+-
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "-" }],
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view) return false;
				const editor = view.editor;
				if (!editor) return false;
				if (checking) return true;
				runShift(editor, "demote");
			},
		});

		// 留个引用，方便调试
		this._cmds = [promoteCmd, demoteCmd];

		console.log("[Heading Shift] loaded");
	}

	onunload() {
		console.log("[Heading Shift] unloaded");
	}
}

module.exports = HeadingShiftPlugin;
