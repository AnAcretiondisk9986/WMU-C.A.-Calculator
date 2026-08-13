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
 * @param {Array<{name, credit, score, type?}>} courses
 * @param {{excludeOptional?: boolean}} opts excludeOptional=true 时排除 type==='optional'（任意选修课）
 * @returns {{score, creditSum, failCredits, failCount, invalidCount, excludedCount}}
 */
function calcC2(courses, opts) {
  const list = Array.isArray(courses) ? courses : [];
  const excludeOptional = !!(opts && opts.excludeOptional);
  let weighted = 0, creditSum = 0, failCredits = 0, failCount = 0, invalidCount = 0, excludedCount = 0;
  for (const c of list) {
    if (excludeOptional && c.type === "optional") { excludedCount++; continue; }
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
    invalidCount,
    excludedCount
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
  const c2 = calcC2(y.courses, { excludeOptional: !!y.c2OnlyRequired });
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
 * 教务系统（正方 V9）成绩查询页复制文本 → 课程数组
 * 支持制表符 / 2+空格 / 全角空格分隔；表头定位（含"课程名称"与"学分"列）；
 * 课程性质列映射为 required/limited/optional。
 * @param {string} text
 * @returns {{courses: Array, warnings: string[]}}
 */
const JW_TYPE_MAP = {
  "必修课": "required", "必修": "required",
  "限制性选修课": "limited", "限选课": "limited", "限选": "limited",
  "任意选修课": "optional", "任选课": "optional", "任选": "optional"
};

function splitJwLine(line) {
  let parts = line.split(/\t+/).map(s => s.trim()).filter(s => s.length > 0);
  if (parts.length < 2) {
    parts = line.split(/[ \u3000]{2,}/).map(s => s.trim()).filter(s => s.length > 0);
  }
  return parts;
}

function parseJwText(text) {
  const warnings = [];
  const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  // 定位表头行：同时包含"课程名称"与"学分"
  let headerIdx = -1, header = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = splitJwLine(lines[i]);
    const hasName = cols.some(c => c.includes("课程名称") || c === "课程");
    const hasCredit = cols.some(c => c.includes("学分"));
    if (hasName && hasCredit) { headerIdx = i; header = cols; break; }
  }
  if (headerIdx < 0) throw new Error("未识别到成绩表头（需包含“课程名称”“学分”列）");
  const iName = Math.max(header.findIndex(c => c.includes("课程名称")), header.findIndex(c => c === "课程"));
  const iCredit = header.findIndex(c => c.includes("学分"));
  const iScore = header.findIndex(c => c.includes("成绩"));
  const iType = Math.max(header.findIndex(c => c.includes("课程性质")), header.findIndex(c => c.includes("性质") && !c.includes("成绩")));
  const iRemark = header.findIndex(c => c.includes("备注"));
  if (iName < 0 || iCredit < 0) throw new Error("表头缺少“课程名称”或“学分”列");
  if (iScore < 0) {
    if (header.some(c => c.includes("绩点"))) {
      throw new Error("未找到“成绩”列（该页面可能只显示绩点；请从成绩单打印视图复制，或手动填写成绩）");
    }
    throw new Error("未找到“成绩”列");
  }
  const courses = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitJwLine(lines[i]);
    if (cols.length < 3) continue;
    const name = (cols[iName] || "").trim();
    if (!name) continue;
    const credit = Number((cols[iCredit] || "").replace(/[^\d.]/g, ""));
    const type = iType >= 0 ? (JW_TYPE_MAP[(cols[iType] || "").trim()] || "") : "";
    let score = "";
    const scoreRaw = (cols[iScore] || "").trim();
    const digits = scoreRaw.replace(/[^\d.]/g, "");
    const n = digits !== "" ? Number(digits) : NaN;
    if (isFinite(n) && n >= 0) score = n;
    else if (FIVE_GRADE && FIVE_GRADE.hasOwnProperty(scoreRaw)) score = scoreRaw;
    else if (iRemark >= 0) {
      const rDigits = (cols[iRemark] || "").replace(/[^\d.]/g, "");
      const rn = rDigits !== "" ? Number(rDigits) : NaN;
      if (isFinite(rn) && rn >= 0) score = rn;
    }
    if (score === "") {
      warnings.push(`「${name}」未解析到有效成绩，请手动填写`);
    }
    courses.push({
      name,
      credit: isFinite(credit) && credit > 0 ? credit : "",
      score,
      scale: typeof score === "number" ? "percent" : "five",
      type
    });
  }
  if (!courses.length) throw new Error("未解析到任何课程数据（请确认复制的是成绩表格）");
  return { courses, warnings };
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
  const api = { round, convertScore, calcC2, calcC1, calcC3, calcYear, calcOverall, rankMembers, parseJwText };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (typeof window !== "undefined") {
    window.ZCCalc = api;
  }
})();
