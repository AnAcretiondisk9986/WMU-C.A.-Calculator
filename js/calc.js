/* =========================================================================
 * calc.js — 纯计算逻辑（不依赖 DOM）
 * 依据《学生素质综合测评办法》：
 *   C1 = min(100, 80 + Σ加分 - Σ减分)
 *   C2 = Σ(成绩×学分) / Σ学分        （五级分制先换算）
 *   C3 = min(100, 70 + Σ加分)
 *   C  = C1×10% + C2×70% + C3×20%
 *   在校综合测评成绩 = 各学年 C 的平均值
 * ========================================================================= */

"use strict";

/** 数字四舍五入保留 n 位小数 */
function round(n, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** 成绩换算：百分制数字直接返回；五级制字符串按表换算；非法返回 null */
function convertScore(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (FIVE_GRADE.hasOwnProperty(s)) return FIVE_GRADE[s];
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/**
 * C2 学分加权平均分
 * @param {Array<{name, credit, score}>} courses
 * @returns {{score, creditSum, failCredits, failCount, invalidCount}}
 */
function calcC2(courses) {
  const list = Array.isArray(courses) ? courses : [];
  let weighted = 0, creditSum = 0, failCredits = 0, failCount = 0, invalidCount = 0;
  for (const c of list) {
    const credit = Number(c.credit);
    if (!isFinite(credit) || credit <= 0) continue;
    const score = convertScore(c.score);
    if (score === null) { invalidCount++; continue; }
    weighted += score * credit;
    creditSum += credit;
    if (score < 60) { failCredits += credit; failCount++; }
  }
  const score = creditSum > 0 ? weighted / creditSum : 0;
  return {
    score: round(score),
    rawScore: creditSum > 0 ? score : 0,
    creditSum: round(creditSum, 1),
    failCredits: round(failCredits, 1),
    failCount,
    invalidCount
  };
}

/**
 * C1 思想品德
 * @param {Array<{name, points}>} adds 加分
 * @param {Array<{name, points}>} subs 减分（points 为正数）
 * @returns {{score, addSum, subSum, qualified}}
 */
function calcC1(adds, subs) {
  const sum = (arr) => (Array.isArray(arr) ? arr : []).reduce((acc, x) => {
    const p = Number(x.points);
    return acc + (isFinite(p) ? p : 0);
  }, 0);
  const addSum = sum(adds);
  const subSum = Math.abs(sum(subs)); // 减分总量（正数）
  const raw = BASE_C1 + addSum - subSum;
  const score = Math.min(CAP, raw);
  return { score: round(score), addSum: round(addSum), subSum: round(subSum), qualified: score >= C1_PASS };
}

/**
 * C3 发展素质
 * @param {Array<{name, points}>} items
 * @returns {{score, addSum}}
 */
function calcC3(items) {
  const addSum = (Array.isArray(items) ? items : []).reduce((acc, x) => {
    const p = Number(x.points);
    return acc + (isFinite(p) ? p : 0);
  }, 0);
  const score = Math.min(CAP, BASE_C3 + addSum);
  return { score: round(score), addSum: round(addSum) };
}

/**
 * 单学年综合成绩
 * @param {object} year {courses, c1:{adds,subs}, c3:{items}}
 * @returns {{c1, c2, c3, total, c2Failed}}
 */
function calcYear(year) {
  const y = year || {};
  const c1 = calcC1(y.c1 && y.c1.adds, y.c1 && y.c1.subs);
  const c2 = calcC2(y.courses);
  const c3 = calcC3(y.c3 && y.c3.items);
  const c2Failed = c2.creditSum > 0 && c2.failCredits >= C2_FAIL_CREDITS;
  const total = round(c1.score * WEIGHTS.c1 + c2.score * WEIGHTS.c2 + c3.score * WEIGHTS.c3);
  return { c1, c2, c3, total, c2Failed };
}

/**
 * 在校综合测评成绩（各学年平均），返回 null 表示无有效学年
 */
function calcOverall(years) {
  const list = (Array.isArray(years) ? years : []).filter(y => y);
  const totals = list.map(calcYear).map(r => r.total);
  if (!totals.length) return null;
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  return { avg: round(avg), totals };
}

/**
 * 班级排名：对每人每学年（或在校平均）总分排序
 * @param {Array<{name, yearTotals: {[yearKey]: number}|number, overall?: number}>} members
 * @returns 排序后的 [{name, total, rank}]
 */
function rankMembers(members) {
  const list = (Array.isArray(members) ? members : [])
    .filter(m => m && m.name)
    .map(m => ({ name: m.name, total: round(m.total) }));
  list.sort((a, b) => b.total - a.total);
  let prev = null, prevRank = 0;
  return list.map((m, i) => {
    const rank = (prev !== null && Math.abs(m.total - prev) < 1e-9) ? prevRank : i + 1;
    prev = m.total; prevRank = rank;
    return { ...m, rank };
  });
}

/* 导出到 window（供浏览器端使用），同时兼容 Node 测试 */
(function expose() {
  const api = { round, convertScore, calcC2, calcC1, calcC3, calcYear, calcOverall, rankMembers };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (typeof window !== "undefined") {
    window.ZCCalc = api;
  }
})();
