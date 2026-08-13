/* ocr.js buildTable 单测：模拟教务截图 OCR 坐标输出（Node） */
"use strict";

const assert = require("assert");
const D = require("../js/data.js");
const OCR = require("../js/ocr.js");

// 全局常量（buildTable 引用 FIVE_GRADE）
D.setScheme("renji");
global.FIVE_GRADE = D.FIVE_GRADE();

let passed = 0;
function t(name, fn) { fn(); passed++; console.log("  ✔ " + name); }

// 教务 24 可见列，列中心 = 50 + i*80，词宽 20
const COLS = ["查看", "学年", "学期", "课程代码", "课程名称", "课程性质", "学分", "成绩备注", "绩点",
  "成绩性质", "是否学位课程", "开课学院", "课程标记", "课程类别", "课程归属", "教学班", "任课教师",
  "考核方式", "学号", "姓名", "学生标记", "成绩", "是否成绩作废", "学分绩点"];
const cx = (i) => 50 + i * 80;

function mkLine(y, cells) {
  // cells: [[text, colIndex] | [text, x, x2]]
  const words = cells.map(([text, a, b]) => {
    if (typeof a === "number" && b !== undefined) return { text, x0: a, x1: b, y0: y };
    const i = a;
    return { text, x0: cx(i) - 10, x1: cx(i) + 10, y0: y };
  });
  return { y, words };
}

const header = mkLine(0, COLS.map((t, i) => [t, i]));
// 军事技能：等级制"合格"
const row1 = mkLine(60, [
  ["查看", 0], ["2025-2026", 1], ["1", 2], ["NN070001", 3], ["军事技能", 4], ["必修课", 5],
  ["2.0", 6], ["3.00", 8], ["正常考试", 9], ["否", 10], ["学生处", 11], ["主修", 12],
  ["公共基础必修课", 13], ["教学班A", 15], ["仁济学院学工办", 16], ["考试", 17], ["2519120004", 18],
  ["黄映焜", 19], ["可选日语学生", 20], ["合格", 21], ["否", 22], ["6.00", 23]
]);
// 高等数学（1）：名称列拆成两个词
const row2 = mkLine(120, [
  ["查看", 0], ["2025-2026", 1], ["1", 2], ["NN101146", 3], ["高等数学", 360, 380], ["（1）", 388, 408],
  ["必修课", 5], ["4.0", 6], ["3.50", 8], ["正常考试", 9], ["否", 10], ["主修", 12], ["专业基础必修课", 13],
  ["教学班B", 15], ["冯伟训", 16], ["考试", 17], ["2519120004", 18], ["黄映焜", 19], ["可选日语学生", 20],
  ["80", 21], ["否", 22], ["14.00", 23]
]);
// 旧课程：成绩作废=是 → 应跳过
const row3 = mkLine(180, [
  ["查看", 0], ["2025-2026", 1], ["1", 2], ["YY000002", 3], ["旧课程", 4], ["任意选修课", 5],
  ["2.0", 6], ["0.00", 8], ["正常考试", 9], ["否", 10], ["主修", 12], ["任意选修课", 13],
  ["教学班C", 15], ["张老师", 16], ["考试", 17], ["2519120004", 18], ["黄映焜", 19], ["可选日语学生", 20],
  ["30", 21], ["是", 22], ["0.00", 23]
]);

console.log("— OCR 表格重建 —");
t("定位表头并提取课程（等级制/拼接词/作废跳过）", () => {
  const { courses, warnings } = OCR.buildTable([header, row1, row2, row3]);
  assert.strictEqual(courses.length, 2, "作废课程应被跳过");
  assert.strictEqual(courses[0].name, "军事技能");
  assert.strictEqual(courses[0].score, "合格");
  assert.strictEqual(courses[0].scale, "five");
  assert.strictEqual(courses[0].type, "required");
  assert.strictEqual(courses[0].credit, 2);
  assert.strictEqual(courses[1].name, "高等数学（1）", "两词应拼回同一单元格");
  assert.strictEqual(courses[1].score, 80);
  assert.ok(warnings.some((w) => w.includes("等级制") && w.includes("合格")), "应有等级换算提示");
  assert.ok(warnings.some((w) => w.includes("成绩已作废")), "应有作废提示");
});
t("空输入抛错", () => {
  assert.throws(() => OCR.buildTable([]), /未识别到任何文字/);
});
t("无表头时按关键词兜底（仍能提取）", () => {
  const noHeader = [
    mkLine(0, [["课程名称", 4], ["学分", 6], ["成绩", 21]]), // 行文本含课程+学分 → 视为表头
    row1
  ];
  const { courses } = OCR.buildTable(noHeader);
  assert.strictEqual(courses[0].name, "军事技能");
});
t("linesFromBlocks 展平有序", () => {
  const blocks = [{
    paragraphs: [{ lines: [
      { bbox: { x0: 0, y0: 100 }, words: [{ text: "B", bbox: { x0: 10, x1: 30, y0: 100 } }] },
      { bbox: { x0: 0, y0: 50 }, words: [{ text: "A", bbox: { x0: 10, x1: 30, y0: 50 } }] }
    ] }]
  }];
  const lines = OCR.linesFromBlocks(blocks);
  assert.deepStrictEqual(lines.map((l) => l.words[0].text), ["A", "B"]);
});

console.log("\nOCR 单测全部通过：" + passed + " 项");
