/* calc.js 核心计算单测（Node 环境运行） */
"use strict";

const assert = require("assert");
const D = require("../js/data.js");
const C = require("../js/calc.js");
// 将 data.js 的常量挂到 calc 需要的全局
global.FIVE_GRADE = D.FIVE_GRADE;
global.BASE_C1 = D.BASE_C1;
global.BASE_C3 = D.BASE_C3;
global.CAP = D.CAP;
global.C1_PASS = D.C1_PASS;
global.C2_FAIL_CREDITS = D.C2_FAIL_CREDITS;
global.WEIGHTS = D.WEIGHTS;

let passed = 0;
function t(name, fn) { fn(); passed++; console.log("  ✔ " + name); }

console.log("— C2 学分加权平均 —");
t("简单加权：高数5学分90 + 英语3学分80 = 86.25", () => {
  const r = C.calcC2([{ credit: 5, score: 90 }, { credit: 3, score: 80 }]);
  assert.strictEqual(r.score, 86.25);
  assert.strictEqual(r.creditSum, 8);
});
t("五级分制换算：优=90 良=80 不及格=50", () => {
  const r = C.calcC2([{ credit: 2, score: "优" }, { credit: 2, score: "良" }, { credit: 2, score: "不及格" }]);
  assert.strictEqual(r.score, Math.round(((90 + 80 + 50) / 3) * 100) / 100); // 73.33
});
t("不及格学分统计与 C2 不合格判定（≥20 学分）", () => {
  const r = C.calcC2([{ credit: 6, score: 58 }, { credit: 15, score: 55 }, { credit: 4, score: 90 }]);
  assert.strictEqual(r.failCredits, 21);
  assert.strictEqual(r.failCount, 2);
  const year = { courses: [{ credit: 6, score: 58 }, { credit: 15, score: 55 }, { credit: 4, score: 90 }], c1: { adds: [], subs: [] }, c3: { items: [] } };
  assert.strictEqual(C.calcYear(year).c2Failed, true);
});
t("非法成绩计入 invalidCount 且不参与加权", () => {
  const r = C.calcC2([{ credit: 3, score: "" }, { credit: 3, score: 60 }]);
  assert.strictEqual(r.invalidCount, 1);
  assert.strictEqual(r.score, 60);
});
t("空课程：score=0 且 creditSum=0", () => {
  const r = C.calcC2([]);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.creditSum, 0);
});

console.log("— C1 思想品德 —");
t("基准80 + 加15 − 减5 = 90（条目存负值，subSum 为减分总量正数）", () => {
  const r = C.calcC1([{ points: 15 }], [{ points: -5 }]);
  assert.strictEqual(r.score, 90);
  assert.strictEqual(r.addSum, 15);
  assert.strictEqual(r.subSum, 5);
});
t("封顶 100：80+30 = 110 → 100", () => {
  assert.strictEqual(C.calcC1([{ points: 30 }], []).score, 100);
});
t("不合格判定：<60 分", () => {
  assert.strictEqual(C.calcC1([], [{ points: -25 }]).score, 55);
  assert.strictEqual(C.calcC1([], [{ points: -25 }]).qualified, false);
  assert.strictEqual(C.calcC1([], [{ points: -20 }]).qualified, true);
});

console.log("— C3 发展素质 —");
t("基准70 + 加分30 = 100", () => {
  const r = C.calcC3([{ points: 20 }, { points: 10 }]);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.addSum, 30);
});
t("封顶 100：70+40 = 110 → 100", () => {
  assert.strictEqual(C.calcC3([{ points: 40 }]).score, 100);
});
t("无加分 = 70", () => {
  assert.strictEqual(C.calcC3([]).score, 70);
});

console.log("— 总分与在校平均 —");
t("C = C1×10% + C2×70% + C3×20%", () => {
  const year = {
    courses: [{ credit: 5, score: 90 }, { credit: 3, score: 80 }],  // C2=86.25
    c1: { adds: [{ points: 15 }], subs: [{ points: -5 }] },           // C1=90
    c3: { items: [{ points: 10 }] }                                  // C3=80
  };
  const r = C.calcYear(year);
  const expect = 90 * 0.1 + 86.25 * 0.7 + 80 * 0.2; // 85.375
  assert.strictEqual(r.total, Math.round(expect * 100) / 100);
  assert.strictEqual(r.total, 85.38);
});
t("在校综合 = 各学年平均", () => {
  const y1 = { courses: [{ credit: 4, score: 100 }], c1: { adds: [], subs: [] }, c3: { items: [] } }; // C=92 (80*0.1+100*0.7+70*0.2)
  const y2 = { courses: [{ credit: 4, score: 80 }], c1: { adds: [], subs: [] }, c3: { items: [] } };  // C=78
  const o = C.calcOverall([y1, y2]);
  assert.strictEqual(o.avg, 85);
  assert.deepStrictEqual(o.totals, [92, 78]);
});
t("无学年时 overall 为 null", () => {
  assert.strictEqual(C.calcOverall([]), null);
});

console.log("— 班级排名 —");
t("降序排名 + 并列名次", () => {
  const r = C.rankMembers([
    { name: "甲", total: 90 },
    { name: "乙", total: 85.5 },
    { name: "丙", total: 85.5 },
    { name: "丁", total: 80 }
  ]);
  assert.deepStrictEqual(r.map(x => x.name), ["甲", "乙", "丙", "丁"]);
  assert.deepStrictEqual(r.map(x => x.rank), [1, 2, 2, 4]);
});

console.log("\n全部通过：" + passed + " 项");
