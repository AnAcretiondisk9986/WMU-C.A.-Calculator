/* =========================================================================
 * transfer.js — 转专业考核综合成绩计算（本部 / 仁济）
 * 依据：
 *   本部：《温州医科大学本科学生转专业管理办法》（温医大〔2021〕99号）
 *         及各学院《选拔类转专业考核实施办法》（2024年12月30日印发）
 *   仁济：《温州医科大学仁济学院2025年转专业通知》（2025-08-20）
 *         及《学生转专业管理办法》（学生手册2024版）
 * 仅供自评参考，最终以学校/学院认定为准。
 * ========================================================================= */

"use strict";

/* =========================================================================
 * 一、大学英语等级成绩计分规则
 * 每项规则形如 { c4: [[门槛,分值],...], c6: [...], ielts?, toefl?, note? }
 * 分档表按门槛升序，取「最后一个满足 分数>=门槛」的分值，不重复计分、取高。
 * ========================================================================= */
const ENGLISH_RULES = {
  /* 通用10分制：四级<425=0、≥425=3、≥550=5；六级≥425=8、≥550=10
     第一临床 / 第二临床 / 基础 / 康复 / 中医药 */
  std10: {
    c4: [[425, 3], [550, 5]],
    c6: [[425, 8], [550, 10]],
    note: "四级<425 不得分；不重复计分，以得分高者为准。雅思6.0、托福75≈六级425；雅思7.0、托福95≈六级550。"
  },
  /* 仁济5分制：四级<425=0、≥425且<550=3、≥550=5；六级≥425=5 */
  renji5: {
    c4: [[425, 3], [550, 5]],
    c6: [[425, 5]],
    note: "四级<425 不得分；不重复计分，以得分高者为准。"
  },
  /* 口腔医学院：六级≥550=10、500-549=8、425-499=6；四级≥550=5、500-549=3、425-499=1 */
  oral: {
    c4: [[425, 1], [500, 3], [550, 5]],
    c6: [[425, 6], [500, 8], [550, 10]],
    note: "不重复计分，以得分高者为准。雅思6.0、托福75≈六级450；雅思6.5、托福85≈六级500。"
  },
  /* 精神医学学院：四级425-549=4、≥550=6；六级425-549=7、≥550=10 */
  jingshen: {
    c4: [[425, 4], [550, 6]],
    c6: [[425, 7], [550, 10]],
    note: "不重复计分，以得分高者为准。雅思6.0、托福75≈六级450；雅思6.5、托福85≈六级500；雅思7.0、托福95≈六级550。"
  },
  /* 眼视光学院（10分制）：
     CET-4 425-550(含425不含550)=4、≥550=6；
     CET-6 450-500=6、500-550(含500不含550)=8、≥550=10；
     IELTS 6.0-6.5=6、6.5-7.0(含6.5不含7.0)=8、≥7.0=10；
     TOEFL 75-88=6、88-95(含88不含95)=8、≥95=10 */
  yanshi: {
    c4: [[425, 4], [550, 6]],
    c6: [[450, 6], [500, 8], [550, 10]],
    ielts: [[6.0, 6], [6.5, 8], [7.0, 10]],
    toefl: [[75, 6], [88, 8], [95, 10]],
    note: "各考试间不重复计分，以得分高者为准。"
  },
  /* 检验医学院（5分制）：四级425-549=2、≥550=4；六级425-549=3、≥550=5 */
  jianyan: {
    c4: [[425, 2], [550, 4]],
    c6: [[425, 3], [550, 5]],
    note: "不重复计分，以得分高者为准。"
  },
  /* 药学院（10分制）：六级≥500=10；四级≥550或六级≥425=5；四级425-549=4 */
  yaoxue: {
    c4: [[425, 4], [550, 5]],
    c6: [[425, 5], [500, 10]],
    note: "不重复计分，以得分高者为准。雅思6.0、托福75≈六级450；雅思6.5、托福85≈六级500。"
  },
  /* 护理学院（5分制）：四级425-549=2、≥550=4；六级≥425=5 */
  huli: {
    c4: [[425, 2], [550, 4]],
    c6: [[425, 5]],
    note: "不重复计分，以得分高者为准。"
  },
  /* 公共卫生 / 医学人文与管理（5分制）：四级425-549=1、≥550=2；六级425-549=3、≥550=5 */
  gongwei: {
    c4: [[425, 1], [550, 2]],
    c6: [[425, 3], [550, 5]],
    note: "不重复计分，以得分高者为准。雅思6.0、托福75≈六级450；雅思6.5、托福85≈六级500。"
  }
};

/* =========================================================================
 * 二、专长计分档次（各学院不同）
 * ========================================================================= */
const SPECIALTY_TIERS = {
  /* 省级以上科研项目（负责人）/二级及以上或SCI二区及以上论文（第1）→5；校级以上/正式刊物→3 */
  s5_2: [
    { label: "省级以上科研项目（负责人），或二级及以上刊物/SCI二区及以上论文（排名第1）", points: 5 },
    { label: "校级以上科研项目（负责人），或有正式刊号刊物发表论文", points: 3 }
  ],
  /* 眼视光 5分3档 */
  s5_3_ys: [
    { label: "出版专著（排名前二），或省级及以上学生创新项目（第一负责人），或省级及以上学科竞赛一等以上（排名第一），或授权发明专利（第一负责人），或国家级赛事（体育/英语/艺术）第一名（排名第一）", points: 5 },
    { label: "二级（含）以上刊物发表论文，或省级学科竞赛二等奖（排名第一），或授权实用新型专利（第一负责人）", points: 3 },
    { label: "校级学生创新项目（第一负责人），或校级学科竞赛一等以上奖项（排名第一）", points: 2 }
  ],
  /* 精神医学 5分2档+赛事 */
  s5_2_js: [
    { label: "省级及以上科研创新项目立项/学科竞赛获奖/授权发明专利（不含实用新型、外观、软著）/一级或人文社科2A级及以上期刊论文（均须排名第一）；或国家级赛事（体育、艺术）第一名（排名第一）", points: 5 },
    { label: "市级、校级科研创新项目立项/学科竞赛获奖/二级或人文社科2B级期刊论文（排名第一）；或省级赛事（体育、艺术）第一名（排名第一）", points: 3 }
  ],
  /* 基础 10分2档 */
  s10_2: [
    { label: "主持省级及以上科研项目，或以第一作者在二级及以上刊物发表论文", points: 10 },
    { label: "主持校级科研项目，或以第一作者在正式刊物发表论文（每项）", points: 5 }
  ],
  /* 检验 5分3档 */
  s5_3: [
    { label: "国家级/省级科研项目、学生创新项目、学科竞赛及其他权威赛事获奖、国家发明专利或一级刊物/SCI刊物论文（排名第一）", points: 5 },
    { label: "校级各类项目，或二级刊物公开发表论文", points: 3 },
    { label: "院级各类项目，或正式刊物公开发表论文", points: 1 }
  ],
  /* 药学 10分2档 */
  s10_2_yx: [
    { label: "出版专著（排名前二），或省级以上学生创新项目/科研项目（第一负责人），或省级以上学科竞赛、“互联网+”、“挑战杯”等一等以上（团队排名第一），或授权发明专利（第一发明人），或国家级权威赛事第一名（团队排名第一），或一级刊物/SCI刊物论文（排名前二）", points: 10 },
    { label: "校级学生创新项目/科研项目（第一负责人），或校级学科竞赛等一等以上（团队排名第一），或二级刊物论文（排名前二）", points: 5 }
  ],
  /* 护理 5分3档 */
  s5_3_hl: [
    { label: "国家级/省级科研项目、学生创新项目、学科竞赛及其他权威赛事获奖、发明专利或一级刊物/SCI刊物论文（排名第一）", points: 5 },
    { label: "校级各类项目，或二级刊物公开发表论文", points: 3 },
    { label: "院级各类项目，或正式刊物公开发表论文", points: 2 }
  ],
  /* 公共卫生/医人文 10分3档 */
  s10_3: [
    { label: "国家级/省级科研项目、学生创新项目、学科竞赛及其他权威赛事获奖、发明专利或一级刊物/SCI刊物论文（排名第一）", points: 10 },
    { label: "校级各类项目，或二级刊物公开发表论文", points: 5 },
    { label: "院级各类项目，或正式刊物公开发表论文", points: 3 }
  ],
  /* 中医药 10分2档 */
  s10_2_zy: [
    { label: "省级及以上科研项目或学生创新项目立项、学科竞赛获奖、获国家发明专利或A2级及以上学术期刊发表论文（均须排名第一）", points: 10 },
    { label: "市级、校级科研项目或学生创新项目立项、学科竞赛获奖或B级学术期刊发表论文", points: 5 }
  ],
  /* 仁济 5分3档 */
  s5_3_rj: [
    { label: "获国家级科研项目（负责人），或一级及以上刊物公开发表论文（排名第1）", points: 5 },
    { label: "获省级以上科研项目（负责人），或二级刊物公开发表论文（排名第1）", points: 3 },
    { label: "获校级以上科研项目（负责人），或在二级以下（不含）刊物公开发表论文（排名第1）", points: 1.5 }
  ]
};

/* =========================================================================
 * 三、学院（专业）方案
 * rank: 专业成绩排名（通用公式 full×[1-(排名-1)/(人数×top)]；护理为分档）
 * ========================================================================= */
const BENBU_COLLEGES = [
  {
    id: "dyc", name: "第一临床医学院（信息与工程学院）",
    rankFull: 50, interviewMax: 25,
    specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_2 },
    english: "std10",
    gaokao: { full: 10, type: "threshold", label: "转入专业生源地当年最低录取分" },
    majors: [
      { name: "临床医学（5+3 一体化）", top: 0.15, qualify: 0.15 },
      { name: "临床医学（五年制）", top: 0.15, qualify: 0.15 },
      { name: "医学影像学", top: 0.15, qualify: 0.15 },
      { name: "医学影像技术", top: 0.3, qualify: 0.3 },
      { name: "信息管理与信息系统", top: 0.5, qualify: 0.5 }
    ]
  },
  {
    id: "dec", name: "第二临床医学院",
    rankFull: 50, interviewMax: 25,
    specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_2 },
    english: "std10",
    gaokao: { full: 10, type: "threshold", label: "转入专业生源地当年最低录取分" },
    majors: [
      { name: "临床医学（5+3 一体化，含儿科学、麻醉学等方向）", top: 0.15, qualify: 0.15 },
      { name: "临床医学（五年制）", top: 0.15, qualify: 0.15 },
      { name: "儿科学", top: 0.15, qualify: 0.15 },
      { name: "麻醉学", top: 0.15, qualify: 0.15 }
    ]
  },
  {
    id: "ysg", name: "眼视光学院（生物医学工程学院）",
    rankFull: 45, interviewMax: 35,
    specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_3_ys },
    english: "yanshi",
    gaokao: null,
    cross: { full: 5, medToMed: 5, nonMedToMed: 0, note: "医学类指原专业毕业学位为医学学位；医学类转入医学类、医学类转入非医学类、非医学类转入非医学类得5分，非医学类转入医学类得0分" },
    majors: [
      { name: "眼视光医学（5+3 一体化）", med: true, top: 0.3, qualify: 0.15, minTotal: 75 },
      { name: "眼视光医学", med: true, top: 0.3, qualify: 0.15, minTotal: 75 },
      { name: "眼视光医学（新医科班）", med: true, top: 0.3, qualify: 0.15, minTotal: 75 },
      { name: "生物医学工程（眼视光工程新工科班）", med: false, top: 0.3, qualify: 0.15, minTotal: 75 },
      { name: "生物医学工程", med: false, top: 0.5, qualify: 0.3, minTotal: 60 }
    ]
  },
  {
    id: "kq", name: "口腔医学院",
    rankFull: 50, interviewMax: 30,
    specialty: null,
    english: "oral",
    gaokao: { full: 10, type: "formula", k: 0.25, label: "口腔医学专业当年最低录取分（生源地未招生以临床医学为参考）" },
    majors: [
      { name: "口腔医学", top: 0.3, qualify: 0.15 }
    ]
  },
  {
    id: "jsyx", name: "精神医学学院",
    rankFull: 50, interviewMax: 30, interviewPass: 18,
    specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_2_js },
    english: "jingshen",
    gaokao: { full: 5, type: "threshold", label: "拟转入专业当年浙江省最低录取分（外省考生按文件比例折算）" },
    majors: [
      { name: "精神医学", top: 0.15, qualify: 0.15 },
      { name: "应用心理学", top: 0.3, qualify: 0.3 }
    ]
  },
  {
    id: "jcyx", name: "基础医学院",
    rankFull: 50, interviewMax: 20,
    specialty: { full: 10, tiers: SPECIALTY_TIERS.s10_2 },
    english: "std10",
    gaokao: { full: 10, type: "threshold", label: "转入专业生源地当年最低录取分" },
    majors: [
      { name: "基础医学", top: 0.15, qualify: 0.15 }
    ]
  },
  {
    id: "jy", name: "检验医学院（生命科学学院）",
    rankFull: 65, interviewMax: 25,
    specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_3 },
    english: "jianyan",
    gaokao: null,
    majors: [
      { name: "医学检验技术", top: 0.3, qualify: 0.3 },
      { name: "卫生检验与检疫", top: 0.3, qualify: 0.3 },
      { name: "生物技术", top: 0.3, qualify: 0.3 }
    ]
  },
  {
    id: "yx", name: "药学院",
    rankFull: 50, interviewMax: 25, interviewLabel: "选拔考核",
    interviewHint: "重点考察对拟转入领域的涉猎、专业基础与综合素质。",
    specialty: { full: 10, tiers: SPECIALTY_TIERS.s10_2_yx },
    english: "yaoxue",
    gaokao: { full: 5, type: "threshold", label: "转入专业生源地当年最低录取分" },
    majors: [
      { name: "临床药学", top: 0.3, qualify: 0.3 },
      { name: "药学", top: 0.3, qualify: 0.3 },
      { name: "生物制药", top: 0.3, qualify: 0.3 }
    ]
  },
  {
    id: "hl", name: "护理学院",
    rankTiers: [[0.05, 65], [0.10, 50], [0.15, 40], [0.20, 30], [0.30, 20]],
    interviewMax: 20,
    specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_3_hl },
    english: "huli",
    gaokao: { full: 5, type: "threshold", label: "拟申请转入专业当年最低录取分" },
    majors: [
      { name: "护理学", qualify: 0.3 },
      { name: "助产学", qualify: 0.3 }
    ]
  },
  {
    id: "ggws", name: "公共卫生学院",
    rankFull: 50, interviewMax: 30,
    specialty: { full: 10, tiers: SPECIALTY_TIERS.s10_3 },
    english: "gongwei",
    gaokao: { full: 5, type: "threshold", label: "转入专业生源地当年最低录取分" },
    majors: [
      { name: "预防医学", top: 0.15, qualify: 0.15 },
      { name: "放射医学", top: 0.15, qualify: 0.15 }
    ]
  },
  {
    id: "yrw", name: "医学人文与管理学院",
    rankFull: 50, interviewMax: 30,
    specialty: { full: 10, tiers: SPECIALTY_TIERS.s10_3 },
    english: "gongwei",
    gaokao: { full: 5, type: "threshold", label: "转入专业生源地当年最低录取分" },
    majors: [
      { name: "公共事业管理", top: 0.5, qualify: 0.5 },
      { name: "市场营销", top: 0.5, qualify: 0.5 },
      { name: "健康服务与管理", top: 0.5, qualify: 0.5 }
    ]
  },
  {
    id: "kf", name: "康复医学院",
    rankFull: 50, interviewMax: 25,
    specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_2 },
    english: "std10",
    gaokao: { full: 10, type: "threshold", label: "转入专业生源地当年最低录取分" },
    majors: [
      { name: "康复治疗学", top: 0.3, qualify: 0.3 },
      { name: "运动康复", top: 0.3, qualify: 0.3 },
      { name: "听力与言语康复", top: 0.3, qualify: 0.3 }
    ]
  },
  {
    id: "zyy", name: "中医药学院",
    rankFull: 50, interviewMax: 25,
    specialty: { full: 10, tiers: SPECIALTY_TIERS.s10_2_zy },
    english: "std10",
    gaokao: { full: 5, type: "threshold", label: "拟申请转入专业当年最低录取分（外省考生按文件比例折算）" },
    majors: [
      { name: "中医学", top: 0.15, qualify: 0.15 },
      { name: "中药学", top: 0.3, qualify: 0.3 }
    ]
  }
];

/* 仁济学院：2025年转专业通知（统一方案，无学院区分） */
const RENJI_COLLEGE = {
  id: "renji",
  name: "仁济学院（2025年转专业）",
  rankFull: 65, top: 1, interviewMax: 25,
  specialty: { full: 5, tiers: SPECIALTY_TIERS.s5_3_rj },
  english: "renji5",
  gaokao: null,
  roundQualify: [0.15, 0.5], // 第一轮前15%、第二轮前50%
  note: "专业成绩排名公式：65×[1－（专业排名－1）/该专业人数]；通识选修课成绩不计入排名；上一学年降级转入的学生不得申请、不计入总人数与排名。"
};

/* =========================================================================
 * 四、计算核心（纯函数，不依赖 DOM）
 * ========================================================================= */

/** 数字四舍五入保留 n 位小数 */
function tRound(n, digits = 2) {
  if (!isFinite(n)) return 0;
  const f = Math.pow(10, digits);
  return Math.round((n + Number.EPSILON) * f) / f;
}

/**
 * 按分档表计分：表项 [门槛, 分值] 升序，取满足 分数>=门槛 的最高档
 */
function tierScore(score, tiers) {
  if (score === undefined || score === null || score === "") return 0;
  const s = Number(score);
  if (!isFinite(s) || s < 0) return 0;
  let pts = 0;
  for (const [gate, p] of tiers) {
    if (s >= gate) pts = p;
  }
  return pts;
}

/**
 * 大学英语等级成绩：四六级（及眼视光的雅思/托福）取最高分，不重复计分
 * @returns {{score:number, source:string}}
 */
function englishScore(rule, inputs) {
  const cand = [];
  if (rule.c4 && inputs.c4 !== undefined && inputs.c4 !== null && inputs.c4 !== "") {
    cand.push(["CET-4", tierScore(inputs.c4, rule.c4)]);
  }
  if (rule.c6 && inputs.c6 !== undefined && inputs.c6 !== null && inputs.c6 !== "") {
    cand.push(["CET-6", tierScore(inputs.c6, rule.c6)]);
  }
  if (rule.ielts && inputs.ielts !== undefined && inputs.ielts !== null && inputs.ielts !== "") {
    cand.push(["IELTS", tierScore(inputs.ielts, rule.ielts)]);
  }
  if (rule.toefl && inputs.toefl !== undefined && inputs.toefl !== null && inputs.toefl !== "") {
    cand.push(["TOEFL", tierScore(inputs.toefl, rule.toefl)]);
  }
  if (!cand.length) return { score: 0, source: "" };
  cand.sort((a, b) => b[1] - a[1]);
  return { score: cand[0][1], source: cand[0][0] };
}

/**
 * 专业成绩排名得分
 * @param {object} college 学院方案
 * @param {object} major 选中的专业
 * @param {number} rank 专业排名
 * @param {number} total 专业人数
 * @returns {{score:number, formula:string, percent:number|null}}
 */
function rankScore(college, major, rank, total) {
  const n = Number(total), r = Number(rank);
  if (!isFinite(n) || n <= 0 || !isFinite(r) || r <= 0) {
    return { score: 0, formula: "", percent: null };
  }
  const percent = r / n; // 排名占比
  let score, formula;
  if (college.rankTiers) {
    // 护理学院分档制：命中最高档即停
    let pts = 0;
    for (const [pct, p] of college.rankTiers) {
      if (percent <= pct) { pts = p; break; }
    }
    score = pts;
    formula = "分档：前5%→65，5-10%→50，10-15%→40，15-20%→30，20-30%→20";
  } else {
    const full = college.rankFull;
    const top = (major && major.top) || college.top || 1;
    score = full * Math.max(0, 1 - (r - 1) / (n * top));
    formula = `${full}×[1－（${r}－1）/（${n}×${top}）]`;
  }
  const cap = college.rankFull || (college.rankTiers ? 65 : 1);
  return { score: tRound(Math.min(Math.max(score, 0), cap)), formula, percent: tRound(percent * 100, 1) };
}

/**
 * 高考成绩得分
 * @returns {{score:number, formula:string}}
 */
function gaokaoScore(rule, gaokao, minAdmit) {
  if (!rule) return { score: 0, formula: "无此项" };
  const g = Number(gaokao), m = Number(minAdmit);
  if (!isFinite(g) || !isFinite(m) || g <= 0 || m <= 0) {
    return { score: 0, formula: "" };
  }
  if (rule.type === "threshold") {
    const s = g >= m ? rule.full : 0;
    return {
      score: s,
      formula: `高考成绩 ${g} ${g >= m ? "≥" : "<"} 最低录取分 ${m}，得 ${s}/${rule.full} 分`
    };
  }
  if (rule.type === "formula") {
    // 口腔：10－[（专业最低录取分－高考成绩）×0.25]，最高10最低0
    const s = Math.min(rule.full, Math.max(0, rule.full - (m - g) * rule.k));
    return {
      score: tRound(s),
      formula: `${rule.full}－[（${m}－${g}）×${rule.k}] = ${tRound(s)}`
    };
  }
  return { score: 0, formula: "" };
}

/**
 * 跨专业情况得分（眼视光学院）
 * fromMed/toMed 均按数字处理（1=医学类，0=非医学类）
 */
function crossScore(college, fromMed, toMed) {
  if (!college.cross) return { score: 0, formula: "无此项" };
  const fm = Number(fromMed);
  if (fromMed === undefined || fromMed === null || fromMed === "" || !isFinite(fm)) {
    return { score: 0, formula: "" };
  }
  const tm = Number(toMed) ? 1 : 0;
  // 规则：医学→医学、医学→非医、非医→非医 均为满分；非医→医 为 0
  const isFull = (fm === tm) || (fm === 1 && tm === 0);
  const final = isFull ? college.cross.medToMed : college.cross.nonMedToMed;
  return {
    score: final,
    formula: `${fm ? "医学类" : "非医学类"}转入${tm ? "医学类" : "非医学类"}，得 ${final} 分`
  };
}

/** 英语规则满分 = 分档表最高分值（std10→10、renji5→5、jianyan→5 等） */
function englishFull(rule) {
  if (!rule) return 0;
  let max = 0;
  ["c4", "c6", "ielts", "toefl"].forEach((k) => {
    if (Array.isArray(rule[k])) {
      rule[k].forEach(([, p]) => { if (p > max) max = p; });
    }
  });
  return max;
}

/**
 * 综合计算入口
 * @param {object} college 学院方案
 * @param {object} major 目标专业
 * @param {object} input {rank, total, interview, c4, c6, ielts, toefl, specialtyIdx, gaokao, minAdmit, fromMed, toMed}
 * @returns {{items:Array, total:number, qualify:{...}, warnings:Array}}
 */
function calcTransfer(college, major, input) {
  const inp = input || {};
  const items = [];
  const warnings = [];

  // 1. 专业成绩排名
  const rk = rankScore(college, major, inp.rank, inp.total);
  items.push({ name: "专业成绩排名", full: college.rankFull || (college.rankTiers ? 65 : ""), score: rk.score, formula: rk.formula });

  // 2. 面试考核
  const iv = Number(inp.interview);
  const ivScore = isFinite(iv) && iv > 0 ? Math.min(iv, college.interviewMax) : 0;
  items.push({ name: college.interviewLabel || "面试考核", full: college.interviewMax, score: ivScore, formula: iv > 0 ? `面试得分 ${ivScore}/${college.interviewMax}` : "" });
  if (college.interviewPass && ivScore > 0 && ivScore < college.interviewPass) {
    warnings.push(`面试成绩低于合格分 ${college.interviewPass} 分（满分 ${college.interviewMax} 分），不予录取。`);
  }

  // 3. 专长
  let spScore = 0, spFull = 0;
  if (college.specialty) {
    spFull = college.specialty.full;
    const sp = college.specialty.tiers;
    const idx = Number(inp.specialtyIdx);
    if (isFinite(idx) && idx >= 0 && idx < sp.length) {
      spScore = sp[idx].points;
      items.push({ name: "专长（论文、学术科研成果等）", full: spFull, score: spScore, formula: `按最高级别计入一次：${sp[idx].label}` });
    } else {
      items.push({ name: "专长（论文、学术科研成果等）", full: spFull, score: 0, formula: "未选择或未填写" });
    }
  }

  // 4. 大学英语等级成绩
  const enRule = ENGLISH_RULES[college.english];
  const en = englishScore(enRule, inp);
  items.push({ name: "大学英语等级成绩", full: englishFull(enRule), score: en.score, formula: en.source ? `按 ${en.source} 计 ${en.score} 分` : "未填写" });

  // 5. 高考成绩
  const gk = gaokaoScore(college.gaokao, inp.gaokao, inp.minAdmit);
  if (college.gaokao) {
    items.push({ name: "高考成绩（原高考成绩加分）", full: college.gaokao.full, score: gk.score, formula: gk.formula });
  }

  // 6. 跨专业情况（眼视光）
  if (college.cross) {
    const cr = crossScore(college, inp.fromMed, inp.toMed);
    items.push({ name: "跨专业情况", full: college.cross.full, score: cr.score, formula: cr.formula });
  }

  const total = tRound(items.reduce((a, x) => a + Number(x.score), 0));

  // 资格判定
  const qualify = { ok: null, msg: "" };
  if (rk.percent !== null) {
    const pct = rk.percent;
    if (college.roundQualify) {
      // 仁济：两轮
      const r1 = pct <= college.roundQualify[0] * 100;
      const r2 = pct <= college.roundQualify[1] * 100;
      qualify.ok = r1 || r2;
      qualify.msg = r1
        ? `排名前 ${pct}%，符合第一轮申请条件（前 ${college.roundQualify[0] * 100}%）`
        : r2
          ? `排名前 ${pct}%，符合第二轮申请条件（前 ${college.roundQualify[1] * 100}%）；第一轮未入围者可第二轮报名`
          : `排名前 ${pct}%，超出两轮申请条件（第二轮要求前 ${college.roundQualify[1] * 100}%）`;
    } else if (major && major.qualify) {
      const need = major.qualify * 100;
      qualify.ok = pct <= need;
      qualify.msg = qualify.ok
        ? `排名前 ${pct}%，满足“前 ${need}%”的申请条件`
        : `排名前 ${pct}%，未达到“前 ${need}%”的申请条件`;
    }
    if (major && major.minTotal && total > 0) {
      if (total >= major.minTotal) {
        qualify.msg += `；考核总分 ${total} ≥ ${major.minTotal} 分，满足总分要求`;
      } else {
        qualify.ok = false;
        qualify.msg += `；考核总分 ${total} 分 < ${major.minTotal} 分，未达到总分要求`;
      }
    }
  } else {
    qualify.msg = "请填写专业排名与人数以判定申请资格";
  }

  return { items, total, qualify, warnings };
}

/* =========================================================================
 * 五、导出（浏览器 window / Node 测试兼容）
 * ========================================================================= */
(function expose() {
  const api = {
    tRound, tierScore, englishScore, englishFull, rankScore, gaokaoScore, crossScore, calcTransfer,
    ENGLISH_RULES, BENBU_COLLEGES, RENJI_COLLEGE
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (typeof window !== "undefined") {
    window.ZT = api;
  }
})();
