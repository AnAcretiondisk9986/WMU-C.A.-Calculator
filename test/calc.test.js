/* calc.js 核心计算单测（Node 环境运行） */
"use strict";

const assert = require("assert");
const D = require("../js/data.js");
const C = require("../js/calc.js");

// 将当前方案的常量挂到 calc 需要的全局
function applyScheme(key) {
  D.setScheme(key);
  global.FIVE_GRADE = D.FIVE_GRADE();
  global.WEIGHTS = D.WEIGHTS();
  global.BASE_C1 = D.BASE_C1();
  global.BASE_C3 = D.BASE_C3();
  global.CAP = D.CAP();
  global.C1_PASS = D.C1_PASS();
  global.C2_FAIL_CREDITS = D.C2_FAIL_CREDITS();
}

let passed = 0;
function t(name, fn) { fn(); passed++; console.log("  ✔ " + name); }

console.log("— 双方案（默认） —");
t("默认方案为温医大本部", () => {
  assert.strictEqual(D.getSchemeKey(), "benbu");
  assert.strictEqual(D.getActiveScheme().label, "温医大本部");
});

applyScheme("renji"); // 主流程按仁济（C3 基准 70）

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
t("减分过大时 C1 下限为 0（不出现负分）", () => {
  const r = C.calcC1([], [{ points: -40 }, { points: -50 }, { points: -30 }]);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.subSum, 120);
  assert.strictEqual(r.qualified, false);
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
t("空学年（无课程）total 为 null", () => {
  const year = { courses: [], c1: { adds: [], subs: [] }, c3: { items: [] } };
  const r = C.calcYear(year);
  assert.strictEqual(r.total, null);
  assert.strictEqual(r.hasCourses, false);
  assert.strictEqual(r.c1.score, 80);
});
t("在校综合跳过空学年", () => {
  const y1 = { courses: [{ credit: 4, score: 100 }], c1: { adds: [], subs: [] }, c3: { items: [] } };
  const empty = { courses: [], c1: { adds: [], subs: [] }, c3: { items: [] } };
  const o = C.calcOverall([empty, y1, empty]);
  assert.strictEqual(o.avg, 92);
  assert.deepStrictEqual(o.totals, [92]);
});

console.log("— 手动填写（C2 / 学年总分）—");
t("parseManualScore：有效数字返回数值，空/非法返回 null", () => {
  assert.strictEqual(C.parseManualScore("85"), 85);
  assert.strictEqual(C.parseManualScore(90), 90);
  assert.strictEqual(C.parseManualScore(0), 0);
  assert.strictEqual(C.parseManualScore(100), 100);
  assert.strictEqual(C.parseManualScore(""), null);
  assert.strictEqual(C.parseManualScore(null), null);
  assert.strictEqual(C.parseManualScore(undefined), null);
  assert.strictEqual(C.parseManualScore("abc"), null);
  assert.strictEqual(C.parseManualScore(-1), null);
  assert.strictEqual(C.parseManualScore(101), null);
});
t("空学年 + 手动 C2：total 按 C1×10%+C2×70%+C3×20% 计算", () => {
  const year = { courses: [], c1: { adds: [], subs: [] }, c3: { items: [] }, c2Manual: "85" };
  const r = C.calcYear(year);
  assert.strictEqual(r.c2Manual, 85);
  assert.strictEqual(r.hasCourses, true);
  assert.strictEqual(r.total, 80 * 0.1 + 85 * 0.7 + 70 * 0.2); // 81.5
  assert.strictEqual(r.total, 81.5);
});
t("有课程 + 手动 C2：手动值优先于课程计算", () => {
  const year = {
    courses: [{ credit: 5, score: 90 }, { credit: 3, score: 80 }], // 课程 C2=86.25
    c1: { adds: [], subs: [] }, c3: { items: [] }, c2Manual: "80"
  };
  const r = C.calcYear(year);
  assert.strictEqual(r.c2.score, 80);
  assert.strictEqual(r.total, 80 * 0.1 + 80 * 0.7 + 70 * 0.2);
});
t("空学年 + 手动总分：total 直接用手动值", () => {
  const year = { courses: [], c1: { adds: [], subs: [] }, c3: { items: [] }, totalManual: "88.5" };
  const r = C.calcYear(year);
  assert.strictEqual(r.totalManual, 88.5);
  assert.strictEqual(r.total, 88.5);
});
t("手动总分优先于公式计算（即使课程可算）", () => {
  const year = {
    courses: [{ credit: 4, score: 100 }], // 公式 C=92
    c1: { adds: [], subs: [] }, c3: { items: [] }, totalManual: "90"
  };
  const r = C.calcYear(year);
  assert.strictEqual(r.total, 90);
});
t("手动总分参与在校平均", () => {
  const y1 = { courses: [{ credit: 4, score: 100 }], c1: { adds: [], subs: [] }, c3: { items: [] }, totalManual: "90" }; // 手动 90
  const y2 = { courses: [{ credit: 4, score: 80 }], c1: { adds: [], subs: [] }, c3: { items: [] } };                    // 公式 78
  const o = C.calcOverall([y1, y2]);
  assert.strictEqual(o.avg, 84);
  assert.deepStrictEqual(o.totals, [90, 78]);
});
t("手动值清空/非法后回退自动计算", () => {
  const year = {
    courses: [{ credit: 4, score: 100 }], // 公式 C=92
    c1: { adds: [], subs: [] }, c3: { items: [] },
    c2Manual: "", totalManual: "abc"
  };
  const r = C.calcYear(year);
  assert.strictEqual(r.c2Manual, null);
  assert.strictEqual(r.totalManual, null);
  assert.strictEqual(r.total, 92);
});

console.log("— 教务系统导入解析 —");
const JW_SAMPLE = [
  "课程代码\t课程名称\t课程性质\t学分\t成绩\t绩点",
  "NN070001\t军事技能\t必修课\t2.0\t90\t3.00",
  "NN101146\t高等数学（1）\t必修课\t4.0\t88\t3.50",
  "NN230433\t课程设计（C语言）\t限制性选修课\t1.0\t92\t4.50",
  "ra00004B\t口腔医学生职业规划\t任意选修课\t2.0\t85\t3.50"
].join("\n");
t("解析教务系统表格：课程数/名称/学分/成绩/性质", () => {
  const { courses, warnings } = C.parseJwText(JW_SAMPLE);
  assert.strictEqual(courses.length, 4);
  assert.strictEqual(warnings.length, 0);
  assert.strictEqual(courses[0].name, "军事技能");
  assert.strictEqual(courses[0].credit, 2);
  assert.strictEqual(courses[0].score, 90);
  assert.strictEqual(courses[0].type, "required");
  assert.strictEqual(courses[1].type, "required");
  assert.strictEqual(courses[2].type, "limited");
  assert.strictEqual(courses[3].type, "optional");
  assert.strictEqual(courses[3].scale, "percent");
});
t("解析空格分隔文本", () => {
  const text = "课程名称  学分  成绩\n大学英语  3.0  良\n高等数学  4.0  86";
  const { courses } = C.parseJwText(text);
  assert.strictEqual(courses.length, 2);
  assert.strictEqual(courses[0].score, "良");
  assert.strictEqual(courses[0].scale, "five");
});
t("无成绩列时抛错（提示绩点页）", () => {
  const text = "课程名称\t学分\t绩点\n大学英语\t3.0\t3.50";
  assert.throws(() => C.parseJwText(text), /绩点|成绩/);
});
t("calcC2 排除任意选修课", () => {
  const courses = [
    { name: "a", credit: 2, score: 90, type: "required" },
    { name: "b", credit: 2, score: 80, type: "optional" },
    { name: "c", credit: 2, score: 70 }
  ];
  const all = C.calcC2(courses);
  assert.strictEqual(all.score, 80);
  assert.strictEqual(all.excludedCount, 0);
  const filtered = C.calcC2(courses, { excludeOptional: true });
  assert.strictEqual(filtered.score, 80); // (90+70)/2，任选 80 被排除
  assert.strictEqual(filtered.excludedCount, 1);
  assert.strictEqual(filtered.creditSum, 4);
});
t("calcYear 支持 c2OnlyRequired", () => {
  const year = {
    courses: [
      { name: "a", credit: 2, score: 90, type: "required" },
      { name: "b", credit: 2, score: 60, type: "optional" }
    ],
    c1: { adds: [], subs: [] }, c3: { items: [] },
    c2OnlyRequired: true
  };
  // C2 = 90，C1=80，C3=70（仁济）→ C = 8 + 63 + 14 = 85
  const r = C.calcYear(year);
  assert.strictEqual(r.c2.score, 90);
  assert.strictEqual(r.c2.excludedCount, 1);
  assert.strictEqual(r.total, 85);
});
t("真实教务列序：成绩列定位（避开成绩性质/作废列）+ 空列不错位", () => {
  // 24 列与教务系统“学生成绩查询”可见列一致；“成绩”列在第 22 位，其前有“成绩性质”“是否成绩作废”
  const rows = [
    "查看\t学年\t学期\t课程代码\t课程名称\t课程性质\t学分\t成绩备注\t绩点\t成绩性质\t是否学位课程\t开课学院\t课程标记\t课程类别\t课程归属\t教学班\t任课教师\t考核方式\t学号\t姓名\t学生标记\t成绩\t是否成绩作废\t学分绩点",
    "查看\t2025-2026\t1\tNN070001\t军事技能\t必修课\t2.0\t\t3.00\t正常考试\t否\t学生处\t主修\t公共基础必修课\t\t教学班A\t仁济学院学工办\t考试\t2519120004\t黄映焜\t可选日语学生\t合格\t否\t6.00",
    "查看\t2025-2026\t1\tNN101146\t高等数学（1）\t必修课\t4.0\t\t3.50\t正常考试\t否\t第一临床医学院\t主修\t专业基础必修课\t\t教学班B\t冯伟训\t考试\t2519120004\t黄映焜\t可选日语学生\t80\t否\t14.00",
    "查看\t2025-2026\t1\tXX000001\t大学英语\t必修课\t2.0\t\t2.00\t补考\t否\t外语学院\t主修\t公共基础必修课\t\t教学班C\t王老师\t考试\t2519120004\t黄映焜\t可选日语学生\t62\t否\t4.00",
    "查看\t2025-2026\t1\tYY000002\t旧课程\t任意选修课\t2.0\t\t0.00\t正常考试\t否\t某学院\t主修\t任意选修课\t\t教学班D\t张老师\t考试\t2519120004\t黄映焜\t可选日语学生\t30\t是\t0.00"
  ].join("\n");
  const { courses, warnings } = C.parseJwText(rows);
  assert.strictEqual(courses.length, 3); // 作废课程被跳过
  assert.strictEqual(courses[0].name, "军事技能");
  assert.strictEqual(courses[0].score, "合格"); // 等级制保留原文
  assert.strictEqual(courses[0].scale, "five");
  assert.strictEqual(courses[0].type, "required");
  assert.strictEqual(courses[1].score, 80);     // 数字成绩
  assert.strictEqual(courses[2].score, 62);     // 补考成绩仍取实际值
  assert.ok(warnings.some(w => w.includes("等级制") && w.includes("合格")), "应有等级制换算提示: " + warnings.join("|"));
  assert.ok(warnings.some(w => w.includes("成绩已作废")), "应有作废提示");
  assert.ok(warnings.some(w => w.includes("补考")), "应有补考提示");
});
t("五级制别名换算：优秀/良好/中等/合格/不合格", () => {
  const r = C.calcC2([
    { credit: 1, score: "优秀" }, { credit: 1, score: "良好" },
    { credit: 1, score: "中等" }, { credit: 1, score: "合格" }, { credit: 1, score: "不合格" }
  ]);
  assert.strictEqual(r.score, (90 + 80 + 70 + 60 + 50) / 5);
});
t("豆包提示词规范输出（Tab 分隔 4 列）可直接解析", () => {
  // 模拟豆包按提示词输出的格式：表头 4 列 + 数字/等级/字母成绩混合
  const text = [
    "课程名称\t课程性质\t学分\t成绩",
    "高等数学（1）\t必修课\t4.0\t90",
    "大学英语\t必修课\t3.0\t良",
    "英语（2）\t必修课\t3.0\tA",
    "儒学与日本文化\t任意选修课\t2.0\t优秀",
    "国家安全教育\t必修课\t1.0\t合格"
  ].join("\n");
  const { courses, warnings } = C.parseJwText(text);
  assert.strictEqual(courses.length, 5);
  assert.strictEqual(courses[0].name, "高等数学（1）");
  assert.strictEqual(courses[0].score, 90);
  assert.strictEqual(courses[1].score, "良");           // 等级制保留原文
  assert.strictEqual(courses[2].score, "");             // 字母成绩无法换算 → 留空待手动填写
  assert.strictEqual(courses[3].type, "optional");      // 任选课自动标记
  assert.strictEqual(courses[4].score, "合格");
  assert.ok(warnings.some((w) => w.includes("字母等级") && w.includes("A")), "字母成绩应有提示");
});

console.log("— 体测降档判定 —");
t("peVerdict：≥80 不降档、<80 降档、保健班不降档、空/无效返回 null", () => {
  assert.strictEqual(C.peVerdict(85, false).down, false);
  assert.strictEqual(C.peVerdict(85, false).kind, "good");
  assert.strictEqual(C.peVerdict(90, false).kind, "excellent");
  assert.strictEqual(C.peVerdict(75, false).down, true);
  assert.strictEqual(C.peVerdict(75, false).kind, "below");
  assert.strictEqual(C.peVerdict(75, true).down, false);
  assert.strictEqual(C.peVerdict(75, true).kind, "health");
  assert.strictEqual(C.peVerdict("", false), null);
  assert.strictEqual(C.peVerdict("abc", false), null);
  assert.strictEqual(C.peVerdict(undefined, false), null);
  assert.strictEqual(C.peVerdict(null, false), null);
});

console.log("— 双方案 —");
t("本部 C3 基准 65、仁济 C3 基准 70", () => {
  applyScheme("benbu");
  assert.strictEqual(C.calcC3([]).score, 65);
  applyScheme("renji");
  assert.strictEqual(C.calcC3([]).score, 70);
});
t("两套方案 C1 基准/权重/五级换算一致", () => {
  applyScheme("benbu");
  assert.strictEqual(C.calcC1([], []).score, 80);
  assert.strictEqual(C.calcC2([{ credit: 2, score: "优" }]).score, 90);
  applyScheme("renji");
  assert.strictEqual(C.calcC1([], []).score, 80);
});
t("本部 C3 加分后总分使用 65 基准", () => {
  applyScheme("benbu");
  const year = {
    courses: [{ credit: 4, score: 90 }],
    c1: { adds: [], subs: [] },
    c3: { items: [{ points: 11 }] } // C3 = 65 + 11 = 76
  };
  const r = C.calcYear(year);
  // C = 80×0.1 + 90×0.7 + 76×0.2 = 8 + 63 + 15.2 = 86.2
  assert.strictEqual(r.total, 86.2);
  assert.strictEqual(r.c3.score, 76);
});
applyScheme("renji");

console.log("\n全部通过：" + passed + " 项");
