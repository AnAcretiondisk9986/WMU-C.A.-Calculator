/* =========================================================================
 * transfer-app.js — 转专业计算器 页面交互逻辑（依赖 transfer.js 的数据与计算）
 * ========================================================================= */

"use strict";

(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let scheme = "benbu";          // benbu | renji
  let collegeId = "dyc";         // 当前学院 id
  let majorIdx = 0;              // 当前专业下标
  let ready = false;             // 首次渲染完成后再写回持久化，避免空值覆盖已保存数据

  /* ---------------- 持久化（localStorage） ---------------- */
  const T_KEY = "wmu-transfer-v1";
  const INPUT_IDS = ["in-total", "in-rank", "in-interview", "in-c4", "in-c6", "in-ielts", "in-toefl", "in-gaokao", "in-minadmit"];

  function loadPersist() {
    try {
      const raw = localStorage.getItem(T_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function savePersist() {
    try {
      const inputs = {};
      INPUT_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) inputs[id] = el.value;
      });
      const sp = document.getElementById("in-specialty");
      const fm = document.getElementById("in-frommed");
      localStorage.setItem(T_KEY, JSON.stringify({
        scheme, collegeId, majorIdx, inputs,
        specialty: sp ? sp.value : "-1",
        fromMed: fm ? fm.value : "1"
      }));
    } catch (e) { /* 隐私模式/配额超限等情况下静默失败 */ }
  }

  /* 恢复方案/学院/专业选择（在 renderScheme 之前调用） */
  function restorePersist() {
    const p = loadPersist();
    if (!p) return;
    if (p.scheme === "renji" || p.scheme === "benbu") scheme = p.scheme;
    if (scheme === "benbu") {
      if (p.collegeId && ZT.BENBU_COLLEGES.some((c) => c.id === p.collegeId)) collegeId = p.collegeId;
      const c = getCollege();
      const mi = Number(p.majorIdx);
      if (Number.isInteger(mi) && mi >= 0 && mi < c.majors.length) majorIdx = mi;
    }
  }

  /* 恢复输入框数值（在 renderScheme 构建 DOM 之后调用） */
  function restoreInputs() {
    const p = loadPersist();
    if (!p) return;
    if (p.inputs) {
      Object.keys(p.inputs).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = p.inputs[id];
      });
    }
    const sp = document.getElementById("in-specialty");
    if (sp && p.specialty !== undefined) {
      const idx = Number(p.specialty);
      if (Number.isInteger(idx) && idx >= -1 && idx < sp.options.length) sp.value = String(idx);
    }
    const fm = document.getElementById("in-frommed");
    if (fm && p.fromMed !== undefined) fm.value = p.fromMed === "0" ? "0" : "1";
  }

  /* ---------------- 取当前方案 ---------------- */
  function getCollege() {
    if (scheme === "renji") return ZT.RENJI_COLLEGE;
    return ZT.BENBU_COLLEGES.find((c) => c.id === collegeId) || ZT.BENBU_COLLEGES[0];
  }
  function getMajor() {
    const c = getCollege();
    if (scheme === "renji") return null;
    return c.majors[Math.min(majorIdx, c.majors.length - 1)];
  }

  /* ---------------- 渲染：方案选择 ---------------- */
  function renderSchemeSelect() {
    document.querySelectorAll('#scheme-select input[type="radio"][name="scheme"]').forEach((r) => {
      r.checked = r.value === scheme;
    });
  }

  function renderScheme() {
    renderSchemeSelect();
    const isBenbu = scheme === "benbu";
    $("#scheme-tag").textContent = isBenbu ? "温医大本部" : "仁济学院";
    $("#college-row").hidden = !isBenbu;
    $("#renji-tip").hidden = isBenbu;
    if (!isBenbu) {
      $("#major-select").hidden = true;
    } else {
      renderColleges();
      renderMajors();
    }
    renderDynamic();
    renderDoc();
    calcAndRender();
  }

  function renderColleges() {
    const sel = $("#college-select");
    sel.innerHTML = ZT.BENBU_COLLEGES.map((c) =>
      `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    sel.value = collegeId;
  }

  function renderMajors() {
    const c = getCollege();
    const sel = $("#major-select");
    sel.hidden = false;
    sel.innerHTML = c.majors.map((m, i) =>
      `<option value="${i}">${esc(m.name)}${m.qualify ? `（要求前 ${m.qualify * 100}%）` : ""}</option>`).join("");
    sel.value = majorIdx;
  }

  /* ---------------- 渲染：动态输入项 ---------------- */
  function renderDynamic() {
    const c = getCollege();
    const enRule = ZT.ENGLISH_RULES[c.english] || {};
    $("#in-ielts-wrap").hidden = !enRule.ielts;
    $("#in-toefl-wrap").hidden = !enRule.toefl;
    $("#english-tag").textContent = `满分 ${ZT.englishFull(enRule)} 分`;
    $("#english-note").textContent = enRule.note || "";

    // 面试
    $("#interview-tag").textContent = `满分 ${c.interviewMax} 分`;
    $("#interview-hint").textContent = c.interviewLabel
      ? (c.interviewHint || `由面试考核小组打分，重点考察综合素质。`)
      : c.interviewPass
        ? `面试成绩低于合格分 ${c.interviewPass} 分（满分 ${c.interviewMax} 分）不予录取。`
        : `由面试考核小组打分，重点考察综合素质。`;
    $("#in-interview").max = c.interviewMax;

    // 专长
    if (c.specialty) {
      $("#grp-specialty").hidden = false;
      $("#specialty-tag").textContent = `满分 ${c.specialty.full} 分`;
      const sel = $("#in-specialty");
      sel.innerHTML =
        `<option value="-1">无 / 未提供佐证材料</option>` +
        c.specialty.tiers.map((t, i) =>
          `<option value="${i}">${esc(t.label)}（${t.points} 分）</option>`).join("");
    } else {
      $("#grp-specialty").hidden = true;
    }

    // 高考成绩
    if (c.gaokao) {
      $("#grp-gaokao").hidden = false;
      $("#gaokao-tag").textContent = `满分 ${c.gaokao.full} 分`;
      $("#min-admit-label").textContent = c.gaokao.label;
      $("#gaokao-hint").textContent = c.gaokao.type === "formula"
        ? `得分 = ${c.gaokao.full}－[（专业最低录取分－高考成绩）×${c.gaokao.k}]，最高 ${c.gaokao.full} 分、最低 0 分；生源地当年未招生的以临床医学专业录取分为参考，均未招生视为 0 分。`
        : `高考成绩 ≥ 最低录取分得满分 ${c.gaokao.full} 分，低于不得分；生源地当年未招生的视为 0 分。`;
    } else {
      $("#grp-gaokao").hidden = true;
    }

    // 跨专业（眼视光）
    if (c.cross) {
      $("#grp-cross").hidden = false;
      $("#cross-hint").textContent = c.cross.note;
    } else {
      $("#grp-cross").hidden = true;
    }

    // 排名公式提示
    const m = getMajor();
    const hint = $("#rank-formula-hint");
    if (c.rankTiers) {
      hint.textContent = "护理学院按分档计分：前5%→65分，5-10%→50分，10-15%→40分，15-20%→30分，20-30%→20分。";
    } else if (m && m.top) {
      hint.textContent = `得分 = ${c.rankFull}×[1－（专业排名－1）/（该专业人数×${m.top}）]，最高 ${c.rankFull} 分。`;
    } else {
      hint.textContent = `得分 = ${c.rankFull}×[1－（专业排名－1）/该专业人数]，最高 ${c.rankFull} 分。`;
    }
  }

  /* ---------------- 渲染：计算依据卡 ---------------- */
  function renderDoc() {
    const c = getCollege();
    const m = getMajor();
    const doc = $("#doc-body");
    const enRule = ZT.ENGLISH_RULES[c.english] || {};
    let html = "";

    html += `<h3>${esc(c.name)} · 选拔类转专业考核</h3>`;
    html += `<p class="hint">依据文件：${scheme === "renji"
      ? "《温州医科大学仁济学院2025年转专业通知》（2025-08-20）、《学生转专业管理办法》（学生手册2024版）"
      : "《温州医科大学本科学生转专业管理办法》（温医大〔2021〕99号）及各学院《选拔类转专业考核实施办法》（2024年12月30日印发）"}</p>`;

    // 接收专业与资格
    if (c.majors) {
      html += `<h3>接收专业与最低成绩要求</h3><ul class="doc-list">`;
      html += c.majors.map((mj) => {
        const top = mj.qualify ? `平均学分绩点排名不低于本专业（专业大类）年级前 ${mj.qualify * 100}%` : "";
        const extra = mj.minTotal ? `；且考核总分不低于 ${mj.minTotal} 分` : "";
        return `<li>${esc(mj.name)}：${top}${extra}</li>`;
      }).join("");
      html += `<li>思想政治品德良好，在校期间无违法违纪行为、未受过任何处分；应修课程无不及格成绩记录；在读一年级全日制本科学生。</li>`;
      if (c.id === "ysg") {
        html += `<li>5+3 一体化专业仅面向其他 5+3 一体化专业。</li>`;
      }
      html += `</ul>`;
    } else {
      html += `<h3>接收专业</h3><p class="hint">${esc(c.name)}（2025 年转专业，适用对象为 2024 年级本科专业学生）</p>`;
    }

    // 考核构成
    html += `<h3>考核内容及分值</h3><ul class="doc-list">`;
    html += `<li>专业成绩排名：满分 ${c.rankFull || 65} 分` +
      (c.rankTiers ? "（分档计分）" : m && m.top ? `，公式 ${c.rankFull}×[1－（排名－1）/（人数×${m.top}）]` : `，公式 ${c.rankFull}×[1－（排名－1）/人数]`) + `</li>`;
    html += `<li>${esc(c.interviewLabel || "面试考核")}：满分 ${c.interviewMax} 分${c.interviewPass ? `（低于 ${c.interviewPass} 分不予录取）` : ""}</li>`;
    if (c.specialty) {
      html += `<li>专长（论文、学术科研成果等）：满分 ${c.specialty.full} 分，按最高级别计入一次。</li>`;
    }
    html += `<li>大学英语等级成绩：满分 ${ZT.englishFull(enRule)} 分。${esc(enRule.note || "")}</li>`;
    if (c.gaokao) {
      html += `<li>${esc(c.gaokao.type === "formula" ? "高考成绩" : "高考成绩（原高考成绩）")}：满分 ${c.gaokao.full} 分。</li>`;
    }
    if (c.cross) {
      html += `<li>跨专业情况：满分 ${c.cross.full} 分。${esc(c.cross.note)}</li>`;
    }
    html += `</ul>`;

    // 专长档次
    if (c.specialty) {
      html += `<h3>专长计分档次</h3><ul class="doc-list">`;
      html += c.specialty.tiers.map((t) => `<li>${esc(t.label)}（${t.points} 分）</li>`).join("");
      html += `</ul>`;
    }

    // 仁济补充说明
    if (scheme === "renji") {
      html += `<h3>仁济学院其他说明</h3><ul class="doc-list">`;
      html += `<li>${esc(ZT.RENJI_COLLEGE.note)}</li>`;
      html += `<li>最多可同时申请填报五个专业志愿（平行志愿、不设级差），可自主选择平级或降级就读；专业之间应补修课程学分达 24 及以上的建议降级就读。</li>`;
      html += `<li>申请非医学类专业原则上不受学年学习成绩限制；不适应原专业学习、或入学后发现疾病/生理缺陷的，可申请学院其他专业（原专业当年高考录取线应不低于转入专业）。</li>`;
      html += `<li>学生在校期间只能转一次专业；定向培养、委托培养、专升本、单考单招等特殊类型招生者及本科三年级及以上者不予考虑。</li>`;
      html += `</ul>`;
    }

    doc.innerHTML = html;
  }

  /* ---------------- 计算与结果渲染 ---------------- */
  function readInput() {
    const num = (id) => {
      const v = $(id).value;
      return v === "" ? "" : Number(v);
    };
    const input = {
      rank: num("#in-rank"),
      total: num("#in-total"),
      interview: num("#in-interview"),
      c4: num("#in-c4"),
      c6: num("#in-c6"),
      ielts: num("#in-ielts"),
      toefl: num("#in-toefl"),
      specialtyIdx: $("#in-specialty").value,
      gaokao: num("#in-gaokao"),
      minAdmit: num("#in-minadmit"),
      fromMed: $("#in-frommed") ? Number($("#in-frommed").value) : null
    };
    const c = getCollege();
    const m = getMajor();
    // 眼视光：目标专业是否医学类（由 major.med 显式标注，避免按名称硬编码）
    input.toMed = m && m.med ? 1 : 0;
    return input;
  }

  function calcAndRender() {
    const c = getCollege();
    const m = getMajor();
    const input = readInput();
    const res = ZT.calcTransfer(c, m, input);

    // 资格徽章
    const ql = $("#qualify-line");
    const rkPct = res.qualify.msg || "";
    if (res.qualify.ok === null) {
      ql.innerHTML = `<span class="pe-badge none">${esc(rkPct)}</span>`;
    } else if (res.qualify.ok) {
      ql.innerHTML = `<span class="pe-badge ok">${esc(rkPct)}</span>`;
    } else {
      ql.innerHTML = `<span class="pe-badge down">${esc(rkPct)}</span>`;
    }

    // 结果概览
    const grid = $("#result-grid");
    grid.innerHTML = `
      <div class="result-item total">
        <div class="label">考核综合成绩</div>
        <div class="value">${res.total}</div>
        <div class="extra">满分 100 分</div>
      </div>
      <div class="result-item">
        <div class="label">专业成绩排名</div>
        <div class="value">${res.items[0] ? res.items[0].score : 0}</div>
        <div class="extra">${res.items[0] ? "/ " + (res.items[0].full || "") : ""}</div>
      </div>
      <div class="result-item">
        <div class="label">面试考核</div>
        <div class="value">${res.items[1] ? res.items[1].score : 0}</div>
        <div class="extra">/ ${c.interviewMax}</div>
      </div>
      <div class="result-item">
        <div class="label">其他加分合计</div>
        <div class="value">${res.items.slice(2).reduce((a, x) => a + Number(x.score), 0)}</div>
        <div class="extra">专长 / 英语<br>高考 / 跨专业</div>
      </div>`;

    // 明细表
    const tb = $("#detail-table");
    tb.innerHTML = `
      <thead><tr><th>考核项目</th><th class="num">满分</th><th class="num">得分</th><th>计算说明</th></tr></thead>
      <tbody>${res.items.map((it) => `
        <tr>
          <td>${esc(it.name)}</td>
          <td class="num">${it.full === "" ? "—" : it.full}</td>
          <td class="num strong">${it.score}</td>
          <td class="cell-note">${esc(it.formula || "—")}</td>
        </tr>`).join("")}
        <tr class="total-row">
          <td>综合成绩</td><td class="num">100</td>
          <td class="num strong">${res.total}</td><td class="cell-note">各项得分之和</td>
        </tr>
      </tbody>`;

    // 备注
    const notes = $("#result-notes");
    const warns = res.warnings.map((w) => `<li class="warn">${esc(w)}</li>`).join("");
    notes.innerHTML = warns ? `<ul class="result-notes-list">${warns}</ul>` : "";

    if (ready) savePersist();
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $("#scheme-select").addEventListener("change", (e) => {
      const rb = e.target.closest('input[type="radio"][name="scheme"]');
      if (!rb) return;
      scheme = rb.value;
      renderScheme();
    });
    $("#college-select").addEventListener("change", (e) => {
      collegeId = e.target.value;
      majorIdx = 0;
      renderMajors();
      renderDynamic();
      renderDoc();
      calcAndRender();
    });
    $("#major-select").addEventListener("change", (e) => {
      majorIdx = Number(e.target.value);
      renderDynamic();
      renderDoc();
      calcAndRender();
    });
    // 所有输入框变化即重算
    ["in-total", "in-rank", "in-interview", "in-c4", "in-c6", "in-ielts", "in-toefl",
      "in-specialty", "in-gaokao", "in-minadmit", "in-frommed"].forEach((id) => {
      const el = $("#" + id);
      if (el) el.addEventListener("input", calcAndRender);
    });
  }

  /* ---------------- 启动 ---------------- */
  restorePersist();
  renderScheme();
  bind();
  restoreInputs();
  ready = true;
  calcAndRender(); // 用恢复后的输入重算一次并写回
})();
