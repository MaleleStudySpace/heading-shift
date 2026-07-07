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
 *   4. 跳过代码块内部的 # 行，避免误伤代码注释。
 *      围栏检测遵循 CommonMark：允许 0-3 空格缩进，闭合围栏无信息字符串（语言标签）。
 *   5. 仅当光标精确位于标题行上才生效。
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
 * 扫描全文，返回所有标题的位置信息。
 * 代码块围栏检测遵循 CommonMark 规范：
 * - 围栏行允许前导 0~3 个空格
 * - 闭合围栏必须没有信息字符串（语言标签）
 * - 闭合围栏的 ``` `` ``` 数量 >= 起始围栏
 * @param {string} text 全文
 * @returns {{ headings: {line:number, level:number, hashStart:number}[] }}
 */
function scan(text) {
	const lines = text.split("\n");
	const headings = [];
	let inFence = false;
	let fenceChar = "";
	let fenceLen = 0;

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];

		// 围栏检测：``` 或 ~~~，前导最多 3 空格（CommonMark）
		// 注意：不能用 trimStart()，tab 和多余空格不匹配，避免误判
		const fenceMatch = raw.match(/^[ ]{0,3}(`{3,}|~{3,})(.*)/);
		if (fenceMatch) {
			const fc = fenceMatch[1];
			const fl = fc.length;
			const fcChar = fc[0];
			const infoStr = fenceMatch[2];

			if (!inFence) {
				// 起始围栏
				inFence = true;
				fenceChar = fcChar;
				fenceLen = fl;
			} else if (fcChar === fenceChar && fl >= fenceLen && infoStr.trim() === "") {
				// 闭合围栏：相同字符、长度 >= 起始、无信息字符串（语言标签）
				inFence = false;
				fenceChar = "";
				fenceLen = 0;
			}
			// 围栏行本身跳过标题检测
			continue;
		}

		if (inFence) {
			continue;
		}

		const m = raw.match(HEADING_RE);
		if (m) {
			headings.push({
				line: i,
				level: m[2].length,
				hashStart: m[1].length,
			});
		}
	}

	return { headings };
}

/**
 * 找到光标所在标题。
 * 仅当光标精确地位于某标题行上时返回该标题，否则不操作。
 */
function findCurrentHeading(headings, cursorLine) {
	for (let i = 0; i < headings.length; i++) {
		if (headings[i].line === cursorLine) {
			return { index: i };
		}
	}
	return null;
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
	// 取光标实际位置（head = 选区末端，即光标闪烁的位置）
	const cursorLine = editor.getCursor("head").line;

	const { headings } = scan(text);
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
				// H1 提升 → 去掉 # 和后面的一个空格，退为普通段落
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

	// 保留滚动位置（不设置光标位置，让 CM 自然映射光标到新位置）
	const savedScroll = editor.getScrollInfo();
	editor.transaction({ changes });
	editor.scrollTo(savedScroll.left, savedScroll.top);
}

class HeadingShiftPlugin extends Plugin {
	onload() {
		const promoteCmd = this.addCommand({
			id: "heading-promote",
			name: "提升标题一级（含所有子标题）",
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
			name: "降低标题一级（含所有子标题）",
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
