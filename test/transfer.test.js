/* =========================================================================
 * transfer.test.js — 转专业计算逻辑测试（node test/transfer.test.js）
 * 用例数据均对照两份政策文件原文。
 * ========================================================================= */

"use strict";

const assert = require("assert");
const {
  tRound, tierScore, englishScore, englishFull, rankScore, gaokaoScore, crossScore, calcTransfer,
  ENGLISH_RULES, BENBU_COLLEGES, RENJI_COLLEGE
} = require("../js/transfer.js");

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("✓", name); }
  catch (e) { fail++; console.error("✗", name, "\n  ", e.message); }
}
function eq(actual, expected, label) {
  assert.strictEqual(actual, expected, `${label}: 期望 ${expected}，实际 ${actual}`);
}

/* ---------------- 英语计分 ---------------- */
test("英语 std10：四级 480→3、四级 560→5、六级 450→8、六级 560→10", () => {
  const r = ENGLISH_RULES.std10;
  eq(englishScore(r, { c4: 480 }).score, 3, "c4=480");
  eq(englishScore(r, { c4: 560 }).score, 5, "c4=560");
  eq(englishScore(r, { c6: 450 }).score, 8, "c6=450");
  eq(englishScore(r, { c6: 560 }).score, 10, "c6=560");
  eq(englishScore(r, { c4: 420 }).score, 0, "c4=420");
  eq(englishScore(r, { c4: 500, c6: 430 }).score, 8, "四六取高");
});

test("英语 renji5（仁济）：四级 500→3、四级 560→5、六级 440→5", () => {
  const r = ENGLISH_RULES.renji5;
  eq(englishScore(r, { c4: 500 }).score, 3, "c4=500");
  eq(englishScore(r, { c4: 560 }).score, 5, "c4=560");
  eq(englishScore(r, { c6: 440 }).score, 5, "c6=440");
});

test("英语 oral（口腔）：六级 510→8、430→6、四级 480→1、520→3、560→5", () => {
  const r = ENGLISH_RULES.oral;
  eq(englishScore(r, { c6: 510 }).score, 8, "c6=510");
  eq(englishScore(r, { c6: 430 }).score, 6, "c6=430");
  eq(englishScore(r, { c6: 420 }).score, 0, "c6=420");
  eq(englishScore(r, { c4: 480 }).score, 1, "c4=480（425-499 档）");
  eq(englishScore(r, { c4: 520 }).score, 3, "c4=520（500-549 档）");
  eq(englishScore(r, { c4: 560 }).score, 5, "c4=560");
});

test("英语 jingshen：四级 500→4、560→6；六级 500→7、560→10", () => {
  const r = ENGLISH_RULES.jingshen;
  eq(englishScore(r, { c4: 500 }).score, 4, "c4=500");
  eq(englishScore(r, { c4: 560 }).score, 6, "c4=560");
  eq(englishScore(r, { c6: 500 }).score, 7, "c6=500");
  eq(englishScore(r, { c6: 560 }).score, 10, "c6=560");
});

test("英语 yanshi（眼视光）：四六雅思托福全表", () => {
  const r = ENGLISH_RULES.yanshi;
  eq(englishScore(r, { c4: 500 }).score, 4, "c4=500");
  eq(englishScore(r, { c4: 560 }).score, 6, "c4=560");
  eq(englishScore(r, { c6: 470 }).score, 6, "c6=470");
  eq(englishScore(r, { c6: 520 }).score, 8, "c6=520");
  eq(englishScore(r, { c6: 560 }).score, 10, "c6=560");
  eq(englishScore(r, { ielts: 6.2 }).score, 6, "ielts=6.2");
  eq(englishScore(r, { ielts: 6.8 }).score, 8, "ielts=6.8");
  eq(englishScore(r, { ielts: 7.5 }).score, 10, "ielts=7.5");
  eq(englishScore(r, { toefl: 80 }).score, 6, "toefl=80");
  eq(englishScore(r, { toefl: 90 }).score, 8, "toefl=90");
  eq(englishScore(r, { toefl: 100 }).score, 10, "toefl=100");
});

test("英语 jianyan/yaoxue/huli/gongwei", () => {
  eq(englishScore(ENGLISH_RULES.jianyan, { c4: 500 }).score, 2, "检验 c4=500");
  eq(englishScore(ENGLISH_RULES.jianyan, { c6: 560 }).score, 5, "检验 c6=560");
  eq(englishScore(ENGLISH_RULES.yaoxue, { c4: 500 }).score, 4, "药学 c4=500");
  eq(englishScore(ENGLISH_RULES.yaoxue, { c4: 560 }).score, 5, "药学 c4=560");
  eq(englishScore(ENGLISH_RULES.yaoxue, { c6: 430 }).score, 5, "药学 c6=430");
  eq(englishScore(ENGLISH_RULES.yaoxue, { c6: 520 }).score, 10, "药学 c6=520");
  eq(englishScore(ENGLISH_RULES.huli, { c4: 500 }).score, 2, "护理 c4=500");
  eq(englishScore(ENGLISH_RULES.huli, { c4: 560 }).score, 4, "护理 c4=560");
  eq(englishScore(ENGLISH_RULES.huli, { c6: 440 }).score, 5, "护理 c6=440");
  eq(englishScore(ENGLISH_RULES.gongwei, { c4: 500 }).score, 1, "公卫 c4=500");
  eq(englishScore(ENGLISH_RULES.gongwei, { c4: 560 }).score, 2, "公卫 c4=560");
  eq(englishScore(ENGLISH_RULES.gongwei, { c6: 500 }).score, 3, "公卫 c6=500");
  eq(englishScore(ENGLISH_RULES.gongwei, { c6: 560 }).score, 5, "公卫 c6=560");
});

/* ---------------- 专业成绩排名 ---------------- */
test("排名公式：第一临床 临床医学(五年制) 120人第8名", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "dyc");
  const m = c.majors[1]; // 临床医学（五年制）top 0.15
  const r = rankScore(c, m, 8, 120);
  eq(r.score, 30.56, "得分");
  eq(r.percent, 6.7, "排名占比");
});

test("排名公式：医学影像技术 top=0.3", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "dyc");
  const m = c.majors[3];
  const r = rankScore(c, m, 20, 100);
  eq(r.score, 18.33, "得分 50×[1-19/30]");
});

test("排名分档：护理学院", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "hl");
  eq(rankScore(c, null, 5, 100).score, 65, "前5%");
  eq(rankScore(c, null, 8, 100).score, 50, "5-10%");
  eq(rankScore(c, null, 13, 100).score, 40, "10-15%");
  eq(rankScore(c, null, 18, 100).score, 30, "15-20%");
  eq(rankScore(c, null, 25, 100).score, 20, "20-30%");
  eq(rankScore(c, null, 40, 100).score, 0, "超30%");
});

test("排名公式：仁济 120人第10名", () => {
  const r = rankScore(RENJI_COLLEGE, null, 10, 120);
  eq(r.score, 60.13, "得分 65×[1-9/120]");
  eq(r.percent, 8.3, "排名占比");
});

/* ---------------- 高考成绩 ---------------- */
test("高考门槛式 10 分", () => {
  const rule = { full: 10, type: "threshold" };
  eq(gaokaoScore(rule, 610, 620).score, 0, "低于最低分");
  eq(gaokaoScore(rule, 630, 620).score, 10, "高于最低分");
});

test("高考门槛式 5 分", () => {
  const rule = { full: 5, type: "threshold" };
  eq(gaokaoScore(rule, 610, 620).score, 0, "低于最低分");
  eq(gaokaoScore(rule, 620, 620).score, 5, "等于最低分");
});

test("高考公式（口腔）：10-[(最低分-高考)×0.25]", () => {
  const rule = { full: 10, type: "formula", k: 0.25 };
  eq(gaokaoScore(rule, 610, 620).score, 7.5, "610/620");
  eq(gaokaoScore(rule, 600, 620).score, 5, "600/620");
  eq(gaokaoScore(rule, 560, 620).score, 0, "下限截断");
  eq(gaokaoScore(rule, 650, 620).score, 10, "上限截断");
});

/* ---------------- 跨专业（眼视光） ---------------- */
test("跨专业：医→医=5、非医→医=0、医→非医=5、非医→非医=5", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "ysg");
  eq(crossScore(c, 1, 1).score, 5, "医→医");
  eq(crossScore(c, 0, 1).score, 0, "非医→医");
  eq(crossScore(c, 1, 0).score, 5, "医→非医");
  eq(crossScore(c, 0, 0).score, 5, "非医→非医");
});

test("跨专业：UI 传字符串值（select value \"1\"/\"0\"）同样正确", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "ysg");
  eq(crossScore(c, "1", 1).score, 5, "UI 医→医");
  eq(crossScore(c, "0", 1).score, 0, "UI 非医→医");
  eq(crossScore(c, "1", 0).score, 5, "UI 医→非医");
  eq(crossScore(c, "0", 0).score, 5, "UI 非医→非医");
});

test("英语满分推导：5 分制学院显示满分 5，10 分制显示 10", () => {
  eq(englishFull(ENGLISH_RULES.std10), 10, "std10");
  eq(englishFull(ENGLISH_RULES.renji5), 5, "renji5");
  eq(englishFull(ENGLISH_RULES.jianyan), 5, "jianyan");
  eq(englishFull(ENGLISH_RULES.huli), 5, "huli");
  eq(englishFull(ENGLISH_RULES.gongwei), 5, "gongwei");
  eq(englishFull(ENGLISH_RULES.oral), 10, "oral");
  eq(englishFull(ENGLISH_RULES.yaoxue), 10, "yaoxue");
  eq(englishFull(ENGLISH_RULES.yanshi), 10, "yanshi");
});

/* ---------------- 综合计算 ---------------- */
test("综合：第一临床 临床医学(五年制) 120人第8名，面试22，四级480，无专长，高考610/最低620", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "dyc");
  const m = c.majors[1];
  const res = calcTransfer(c, m, {
    rank: 8, total: 120, interview: 22, c4: 480, c6: "", specialtyIdx: -1,
    gaokao: 610, minAdmit: 620, fromMed: 1, toMed: 1
  });
  eq(res.total, 55.56, "总分 = 30.56+22+0+3+0");
  eq(res.qualify.ok, true, "前6.7%满足前15%");
  const rankItem = res.items[0];
  eq(rankItem.score, 30.56, "排名分");
});

test("综合：口腔医学院 高考 610/最低 620，六级 510，面试 26，排名 5/100（前5%满足前15%）", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "kq");
  const m = c.majors[0];
  const res = calcTransfer(c, m, {
    rank: 5, total: 100, interview: 26, c4: "", c6: 510, specialtyIdx: -1,
    gaokao: 610, minAdmit: 620
  });
  // 排名 50×[1-4/30]=43.33；英语 8；高考 7.5；面试 26；无专长
  eq(res.total, 84.83, "总分 = 43.33+26+0+8+7.5");
});

test("综合：护理学院 排名 8/100（分档50），面试 18，六级 440（5分），校级项目（3分），高考 600/最低 590（5分）", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "hl");
  const m = c.majors[0];
  const res = calcTransfer(c, m, {
    rank: 8, total: 100, interview: 18, c4: "", c6: 440, specialtyIdx: 1,
    gaokao: 600, minAdmit: 590
  });
  eq(res.total, 81, "总分 = 50+18+3+5+5");
  eq(res.qualify.ok, true, "前8%满足前30%");
});

test("综合：精神医学 面试 17 → 警告不予录取", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "jsyx");
  const m = c.majors[0];
  const res = calcTransfer(c, m, {
    rank: 5, total: 100, interview: 17, c4: 500, c6: "", specialtyIdx: -1
  });
  eq(res.warnings.length, 1, "有面试不通过警告");
  assert.ok(res.warnings[0].includes("不予录取"), "警告内容");
});

test("综合：仁济 120人第10名（前8.3% 第一轮），面试 22，六级 440（5分），无专长", () => {
  const res = calcTransfer(RENJI_COLLEGE, null, {
    rank: 10, total: 120, interview: 22, c4: "", c6: 440, specialtyIdx: -1
  });
  eq(res.total, 87.13, "总分 = 60.13+22+0+5");
  assert.ok(res.qualify.msg.includes("第一轮"), "第一轮资格");
  eq(res.qualify.ok, true, "满足资格");
});

test("综合：仁济 排名 60/100（前60%）→ 两轮均不符合", () => {
  const res = calcTransfer(RENJI_COLLEGE, null, {
    rank: 60, total: 100, interview: 20, specialtyIdx: -1
  });
  eq(res.qualify.ok, false, "超出前50%");
});

test("综合：眼视光 非医→医（跨专业0分），排名 20/100 top0.5（生工），面试 30，雅思 6.8（8分），校级项目（2分）", () => {
  const c = BENBU_COLLEGES.find(x => x.id === "ysg");
  const m = c.majors[4]; // 生物医学工程 top 0.5 qualify 0.3 minTotal 60
  const res = calcTransfer(c, m, {
    rank: 20, total: 100, interview: 30, ielts: 6.8, specialtyIdx: 2, fromMed: 0, toMed: 0
  });
  // 排名 45×[1-19/50]=27.9；面试30；专长2；英语8；跨专业 非医→非医=5
  eq(res.total, 72.9, "总分 = 27.9+30+2+8+5");
  eq(res.qualify.ok, true, "前20%满足前30%且总分≥60");
});

/* ---------------- 边界 ---------------- */
test("空输入不报错", () => {
  const c = BENBU_COLLEGES[0];
  const m = c.majors[0];
  const res = calcTransfer(c, m, {});
  eq(res.total, 0, "空输入总分 0");
  eq(res.qualify.ok, null, "资格未判定");
});

console.log(`\n通过 ${pass} / ${pass + fail}`);
process.exit(fail ? 1 : 0);
