/* =========================================================================
 * ocr.js — 教务系统成绩截图 OCR 导入
 * 基于 Tesseract.js（纯前端 WASM，GitHub Pages 可直接运行）：
 *   1. 识别图片 → 逐词输出（含 bounding box）
 *   2. 按文字坐标做列聚类 → 重建表格（比整段文本解析可靠）
 *   3. 表头语义定位（课程名称/学分/成绩/课程性质/成绩性质/是否作废）
 * 依赖：<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js">
 * ========================================================================= */

"use strict";

const ZCOcr = {
  worker: null,

  /** 加载/复用识别引擎（首次需联网下载中文语言包，约 10-15MB，之后浏览器缓存） */
  async loadEngine(onLog) {
    if (!window.Tesseract) {
      throw new Error("OCR 引擎未加载：请确认页面能访问 CDN（cdn.jsdelivr.net）");
    }
    if (this.worker) return this.worker;
    const worker = await window.Tesseract.createWorker("chi_sim", 1, {
      logger: (m) => { if (onLog) onLog(m); }
    });
    this.worker = worker;
    return worker;
  },

  /** 识别图片（File / Image / dataURL） */
  async recognize(image) {
    if (!this.worker) throw new Error("请先加载 OCR 引擎");
    const { data } = await this.worker.recognize(image);
    return data;
  },

  /** 从识别结果（data.blocks）提取有序行：每行 {y, words:[{text,x0,x1}]} */
  linesFromBlocks(blocks) {
    const lines = [];
    for (const block of blocks || []) {
      for (const para of (block.paragraphs || [])) {
        for (const line of (para.lines || [])) {
          const words = (line.words || [])
            .filter((w) => w && w.text && String(w.text).trim())
            .map((w) => ({
              text: String(w.text).trim(),
              x0: w.bbox ? w.bbox.x0 : 0,
              x1: w.bbox ? w.bbox.x1 : 0,
              y0: w.bbox ? w.bbox.y0 : 0
            }));
          if (words.length) {
            lines.push({ y: line.bbox ? line.bbox.y0 : (words[0].y0 || 0), words });
          }
        }
      }
    }
    return lines.sort((a, b) => a.y - b.y);
  },

  /**
   * 纯函数：由识别行重建表格并提取课程（可单测）
   * @param {Array<{y:number, words:Array<{text,x0,x1}>}>} lines
   * @returns {{courses:Array, warnings:string[], headerTexts:string[]}}
   */
  buildTable(lines) {
    const warnings = [];
    // 1) 收集全部有效词，按 x0 排序
    const all = [];
    for (const line of lines) {
      for (const w of line.words) {
        if (w.x1 > w.x0) all.push(w);
      }
    }
    if (!all.length) throw new Error("未识别到任何文字（请确认截图清晰、包含成绩表格）");
    all.sort((a, b) => a.x0 - b.x0);

    // 2) 列聚类：间隙大于阈值（中位词宽×0.8，最小 12px）视为新列
    const widths = all.map((w) => w.x1 - w.x0).sort((a, b) => a - b);
    const medianW = widths[Math.floor(widths.length / 2)] || 20;
    const gapTh = Math.max(12, medianW * 0.8);
    const cols = [];
    for (const w of all) {
      if (!cols.length || w.x0 - cols[cols.length - 1].x1 > gapTh) {
        cols.push({ x0: w.x0, x1: w.x1 });
      } else {
        const c = cols[cols.length - 1];
        c.x0 = Math.min(c.x0, w.x0);
        c.x1 = Math.max(c.x1, w.x1);
      }
    }

    // 3) 每行映射到列 → 单元格文本
    const rows = lines.map((line) => {
      const cells = cols.map(() => []);
      for (const w of line.words) {
        const cx = (w.x0 + w.x1) / 2;
        // 找包含中心的列，否则找最近列
        let ci = cols.findIndex((c) => cx >= c.x0 && cx <= c.x1);
        if (ci < 0) {
          let best = 0, bestD = Infinity;
          cols.forEach((c, i) => {
            const d = Math.min(Math.abs(cx - c.x0), Math.abs(cx - c.x1));
            if (d < bestD) { bestD = d; best = i; }
          });
          ci = best;
        }
        cells[ci].push(w);
      }
      return {
        texts: cells.map((ws) => ws.sort((a, b) => a.x0 - b.x0).map((w) => w.text).join("").trim()),
        lineText: line.words.map((w) => w.text).join(" ").trim()
      };
    });

    // 4) 定位表头行（含“课程”与“学分”字样）
    let headerIdx = rows.findIndex((r) => r.lineText.includes("课程") && r.lineText.includes("学分"));
    if (headerIdx < 0) {
      warnings.push("未定位到表头行（需包含“课程名称”“学分”），将尝试按关键词直接匹配列");
    }
    const headerTexts = headerIdx >= 0 ? rows[headerIdx].texts : [];

    // 5) 列语义定位（宽松匹配，容忍 OCR 错字）
    const hit = (texts, pred) => texts.findIndex((t) => t && pred(t));
    const iName = hit(headerTexts, (t) =>
      t.includes("课程名称") || (t.includes("课程") && !t.includes("代码") && !t.includes("性质") && !t.includes("类别") && !t.includes("标记") && !t.includes("归属")));
    const iCredit = hit(headerTexts, (t) => t.includes("学分"));
    const iScore = hit(headerTexts, (t) => t.includes("成绩") && !t.includes("性质") && !t.includes("备注") && !t.includes("作废"));
    const iType = hit(headerTexts, (t) => t.includes("性质") && !t.includes("成绩"));
    const iKsz = hit(headerTexts, (t) => t.includes("成绩性质"));
    const iInvalid = hit(headerTexts, (t) => t.includes("作废"));

    const courseLines = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

    // 6) 提取课程
    const TYPE_MAP = {
      "必修课": "required", "必修": "required",
      "限制性选修课": "limited", "限选课": "limited", "限选": "limited",
      "任意选修课": "optional", "任选课": "optional", "任选": "optional"
    };
    const FIVE = (typeof FIVE_GRADE !== "undefined" && FIVE_GRADE) || {};
    const courses = [];
    for (const row of courseLines) {
      const t = row.texts;
      const name = iName >= 0 && t[iName] ? t[iName] : "";
      // 名称行可能混入其他噪声：过滤纯数字/符号
      if (!name || /^[\d\s.（）()\-—]+$/.test(name)) continue;
      const credit = iCredit >= 0 && t[iCredit] ? Number(String(t[iCredit]).replace(/[^\d.]/g, "")) : NaN;
      const typeRaw = iType >= 0 && t[iType] ? t[iType] : "";
      const type = TYPE_MAP[typeRaw] || "";
      const ksz = iKsz >= 0 && t[iKsz] ? t[iKsz] : "";
      if (iInvalid >= 0 && t[iInvalid] && /^是$/.test(t[iInvalid])) {
        warnings.push(`「${name}」成绩已作废，已跳过`);
        continue;
      }
      let score = "";
      if (iScore >= 0 && t[iScore]) {
        const raw = t[iScore];
        const digits = String(raw).replace(/[^\d.]/g, "");
        const n = digits !== "" ? Number(digits) : NaN;
        if (isFinite(n) && n >= 0) score = n;
        else if (FIVE.hasOwnProperty(raw)) {
          score = raw;
          warnings.push(`「${name}」为等级制成绩（${raw}），按 ${FIVE[raw]} 分换算，请核实`);
        } else if (/^[A-Da-d]$/.test(raw)) {
          warnings.push(`「${name}」成绩为字母等级（${raw}），无法自动换算，请手动填写分数`);
        } else {
          warnings.push(`「${name}」成绩识别为“${raw}”，请核实`);
        }
      }
      if (score === "") warnings.push(`「${name}」未识别到成绩，请手动填写`);
      else if (/补考|重修/.test(ksz)) warnings.push(`「${name}」成绩性质为“${ksz}”，请按规则确认计分（补考合格按60分、重修按最高成绩）`);
      courses.push({
        name,
        credit: isFinite(credit) && credit > 0 ? credit : "",
        score,
        scale: typeof score === "number" ? "percent" : "five",
        type
      });
    }
    if (!courses.length) throw new Error("未提取到课程数据（请确认截图包含完整成绩表格）");
    return { courses, warnings, headerTexts };
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ZCOcr;
} else if (typeof window !== "undefined") {
  window.ZCOcr = ZCOcr;
}
