/* =========================================================================
 * app.js — 主交互逻辑：状态管理、渲染、事件绑定、快捷添加面板
 * ========================================================================= */

"use strict";

(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  let state = ZCStorage.load();
  let currentYearId = state.years.length ? state.years[0].id : null;
  let quickTarget = null;   // 快选面板的目标列表
  let customTarget = null;  // 自定义条目目标
  let c3Open = { study: true, social: false, innov: false, sports: false };

  /* ---------------- 工具 ---------------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function save() {
    ZCStorage.save(state);
  }

  function getCurrentYear() {
    if (!state.years.length) return null;
    return state.years.find((y) => y.id === currentYearId) || state.years[0];
  }

  function setCurrentYear(id) {
    currentYearId = id;
    renderAll();
  }

  function ensureDefaultYear() {
    if (!state.years.length) {
      state.years.push(newYear("2024-2025 学年"));
      currentYearId = state.years[state.years.length - 1].id;
    }
  }

  function newYear(name) {
    return {
      id: "y-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      name,
      courses: [],
      c1: { adds: [], subs: [] },
      c3: { items: [], peScore: "", peHealthClass: false }
    };
  }

  /* ---------------- 各区块渲染 ---------------- */
  function renderProfile() {
    $("#profile-name").value = state.profile.name || "";
    $("#profile-class").value = state.profile.className || "";
    $("#profile-id").value = state.profile.studentId || "";
  }

  function renderYearSelect() {
    const sel = $("#year-select");
    sel.innerHTML = state.years.map((y) =>
      `<option value="${esc(y.id)}">${esc(y.name)}</option>`).join("");
    if (currentYearId && state.years.some((y) => y.id === currentYearId)) {
      sel.value = currentYearId;
    } else if (state.years.length) {
      currentYearId = state.years[0].id;
      sel.value = currentYearId;
    }
  }

  function renderYearOverview() {
    const year = getCurrentYear();
    const box = $("#year-overview");
    if (!year) { box.innerHTML = ""; return; }
    const r = ZCCalc.calcYear(year);
    const c1Cls = r.c1.qualified ? "" : "bad";
    const c2Cls = r.c2Failed ? "bad" : "";
    box.innerHTML = `
      <div class="result-item ${c1Cls}">
        <div class="label">思想品德 C1（10%）</div>
        <div class="value">${r.c1.score}</div>
        <div class="extra">基准${BASE_C1} ${r.c1.addSum ? "+" + r.c1.addSum : ""} ${r.c1.subSum ? "−" + r.c1.subSum : ""}
          ${r.c1.qualified ? "" : " · 不合格"}</div>
      </div>
      <div class="result-item ${c2Cls}">
        <div class="label">课程成绩 C2（70%）</div>
        <div class="value">${r.c2.creditSum > 0 ? r.c2.score : "—"}</div>
        <div class="extra">${r.c2.creditSum > 0 ? r.c2.creditSum + " 学分" : "请添加课程"}
          ${r.c2Failed ? " · 不及格学分≥20，C2不合格" : r.c2.failCount ? " · 有不及格" : ""}</div>
      </div>
      <div class="result-item">
        <div class="label">发展素质 C3（20%）</div>
        <div class="value">${r.c3.score}</div>
        <div class="extra">基准${BASE_C3} ${r.c3.addSum ? "+" + r.c3.addSum : ""}</div>
      </div>
      <div class="result-item total">
        <div class="label">学年综合成绩 C</div>
        <div class="value">${r.total}</div>
        <div class="extra">C1×10% + C2×70% + C3×20%</div>
      </div>`;
  }

  function renderC1() {
    const year = getCurrentYear();
    if (!year) return;
    const adds = year.c1.adds, subs = year.c1.subs;
    const r = ZCCalc.calcC1(adds, subs);

    const itemHtml = (it, listKey, minus) => `
      <div class="item-row ${minus ? "minus" : ""}">
        <span class="item-name">${esc(it.name)}</span>
        <span class="item-points">${minus ? "−" : "+"}${Math.abs(it.points)}</span>
        <button class="del" data-list="${listKey}" data-idx="${adds.indexOf(it) >= 0 ? adds.indexOf(it) : subs.indexOf(it)}" title="删除">✕</button>
      </div>`;

    const addList = $("#c1-add-list");
    addList.innerHTML = adds.length
      ? adds.map((it) => itemHtml(it, "c1_add", false)).join("")
      : '<div class="empty-hint">暂无加分项目</div>';
    $("#c1-add-total").textContent = "+" + r.addSum;

    const subList = $("#c1-sub-list");
    subList.innerHTML = subs.length
      ? subs.map((it) => itemHtml(it, "c1_sub", true)).join("")
      : '<div class="empty-hint">暂无减分项目</div>';
    $("#c1-sub-total").textContent = "−" + r.subSum;
  }

  function renderC2Stat() {
    const year = getCurrentYear();
    if (!year) return;
    const stat = $("#c2-stat");
    const r = ZCCalc.calcC2(year.courses, { excludeOptional: !!year.c2OnlyRequired });
    if (year.courses.length) {
      const parts = [`学分加权平均分 <b>${r.creditSum > 0 ? r.score : "—"}</b>`];
      parts.push(`总学分 ${r.creditSum}`);
      if (r.excludedCount) parts.push(`<span style="color:var(--text-soft)">已排除 ${r.excludedCount} 门任意选修课</span>`);
      if (r.invalidCount) parts.push(`<span style="color:var(--warn)">${r.invalidCount} 行成绩未填写/无效</span>`);
      if (r.failCount) parts.push(`<span style="color:var(--danger)">${r.failCount} 门不及格（${r.failCredits} 学分）</span>`);
      if (r.failCredits >= C2_FAIL_CREDITS) parts.push(`<span style="color:var(--danger)"><b>不及格学分≥20，课程学习成绩不合格</b></span>`);
      stat.innerHTML = parts.join(" · ");
    } else {
      stat.innerHTML = "";
    }
  }

  function renderC2() {
    const year = getCurrentYear();
    if (!year) return;
    const body = $("#course-body");
    if (!year.courses.length) {
      body.innerHTML = '<tr><td colspan="6"><div class="empty-hint">暂无课程，点击下方按钮添加，或从教务系统复制成绩表一键导入</div></td></tr>';
    } else {
      body.innerHTML = year.courses.map((c, i) => {
        const scale = c.scale === "five" ? "five" : "percent";
        const type = c.type || "";
        const scoreAttrs = scale === "five"
          ? 'list="grade-list" placeholder="优/良/中/及格/不及格"'
          : 'placeholder="0-100"';
        return `
        <tr data-idx="${i}">
          <td><input data-field="name" value="${esc(c.name)}" placeholder="课程名称" maxlength="40"></td>
          <td class="scale-cell">
            <select data-field="scale" class="scale-select" title="选择该课程的成绩计分方式">
              <option value="percent"${scale === "percent" ? " selected" : ""}>百分制</option>
              <option value="five"${scale === "five" ? " selected" : ""}>五级制</option>
            </select>
          </td>
          <td class="type-cell">
            <select data-field="type" class="scale-select" title="课程性质（教务系统导入时自动识别）">
              <option value=""${type === "" ? " selected" : ""}>未标记</option>
              <option value="required"${type === "required" ? " selected" : ""}>必修</option>
              <option value="limited"${type === "limited" ? " selected" : ""}>限选</option>
              <option value="optional"${type === "optional" ? " selected" : ""}>任选</option>
            </select>
          </td>
          <td class="num"><input data-field="credit" type="number" min="0" step="0.5" value="${c.credit ?? ""}" placeholder="学分"></td>
          <td class="num"><input data-field="score" value="${esc(c.score)}" ${scoreAttrs} maxlength="10"></td>
          <td class="op"><button class="del" data-action="del-course" data-idx="${i}" title="删除">✕</button></td>
        </tr>`;
      }).join("");
    }
    const chk = $("#c2-only-required");
    if (chk) chk.checked = !!year.c2OnlyRequired;
    renderC2Stat();
  }

  /* 体测降档判定徽章 HTML（依据《奖学金实施办法》：未达良好<80 按降一等级评定；保健班/保健科证明不予降档） */
  function peBadgeHtml(year) {
    const score = year.c3.peScore;
    const hc = !!year.c3.peHealthClass;
    const healthLabel = getActiveScheme().peHealthLabel;
    const hasScore = score !== undefined && score !== null && score !== "";
    if (!hasScore) return '<span class="pe-badge none">未填写，无判定</span>';
    const s = Number(score);
    if (!isFinite(s)) return '<span class="pe-badge none">成绩无效</span>';
    if (hc) {
      return `<span class="pe-badge ok">不予降档</span><span class="pe-reason">${esc(healthLabel)}</span>`;
    }
    if (s >= 80) {
      const level = s >= 90 ? "优秀" : "良好";
      return `<span class="pe-badge ok">不予降档</span><span class="pe-reason">${level}（≥80）</span>`;
    }
    return '<span class="pe-badge down">予以降档</span><span class="pe-reason">未达良好（&lt;80 分）</span>';
  }

  function renderPeCard(year) {
    const score = year.c3.peScore;
    const hc = !!year.c3.peHealthClass;
    const healthLabel = getActiveScheme().peHealthLabel;
    return `
      <div class="pe-card">
        <div class="pe-head">体质测试 <span class="tag">奖学金降档判定</span></div>
        <div class="pe-row">
          <label class="pe-score-label">体测总分
            <input type="number" data-pe-score min="0" max="100" step="1" placeholder="0-100" value="${esc(score)}">
          </label>
          <label class="pe-check"><input type="checkbox" data-pe-health ${hc ? "checked" : ""}> ${esc(healthLabel)}</label>
        </div>
        <div class="pe-result" data-pe-result>${peBadgeHtml(year)}</div>
        <p class="hint">依据《奖学金实施办法》：优秀学生奖学金要求体测达良好及以上（≥80 分）；未达良好者按降一等级评定，${esc(healthLabel)}不予降档。</p>
      </div>`;
  }

  function updatePeBadge(year) {
    const result = $("#c3-cats [data-pe-result]");
    if (result) result.innerHTML = peBadgeHtml(year);
  }

  function renderC3() {
    const year = getCurrentYear();
    if (!year) return;
    const wrap = $("#c3-cats");
    wrap.innerHTML = C3_CATEGORIES.map((cat) => {
      const items = year.c3.items.filter((it) => it.cat === cat.key);
      const sum = ZCCalc.calcC3(items).addSum;
      const open = c3Open[cat.key];
      const listHtml = items.length
        ? items.map((it, i) => `
            <div class="item-row">
              <span class="item-name">${esc(it.name)}</span>
              <span class="item-points">+${it.points}</span>
              <button class="del" data-list="c3_${cat.key}" data-idx="${i}" title="删除">✕</button>
            </div>`).join("")
        : '<div class="empty-hint">暂无条目</div>';
      return `
        <div class="c3-cat" data-cat="${cat.key}">
          <div class="c3-cat-head" data-toggle-cat="${cat.key}">
            <span class="cat-title">${cat.label} <span style="color:var(--text-soft);font-weight:400;font-size:12px">${open ? "▾" : "▸"}</span></span>
            <span class="cat-total">+${sum}</span>
          </div>
          ${open ? `<div class="c3-cat-body">
            ${cat.key === "study" ? renderPeCard(year) : ""}
            <div class="items">${listHtml}</div>
            <div class="row-actions">
              <button class="btn small" data-quick="c3_${cat.key}" type="button">＋ 按评分表快捷添加</button>
              <button class="btn small ghost" data-custom="c3_${cat.key}" type="button">自定义条目</button>
            </div>
          </div>` : ""}
        </div>`;
    }).join("");
  }

  function renderOverall() {
    const box = $("#overall-result");
    if (!state.years.length) {
      box.innerHTML = '<p class="hint">尚无学年数据，请先在"个人测评"中添加学年并录入。</p>';
      return;
    }
    const rows = state.years.map((y) => {
      const r = ZCCalc.calcYear(y);
      return `<div class="overall-item">
        <div class="y-name">${esc(y.name)}</div>
        <div class="y-total">${r.total}</div>
        <div style="font-size:11px;color:var(--text-soft)">C1 ${r.c1.score} · C2 ${r.c2.score} · C3 ${r.c3.score}</div>
      </div>`;
    }).join("");
    const overall = ZCCalc.calcOverall(state.years);
    box.innerHTML = `
      <div class="overall-grid">${rows}</div>
      <div class="overall-avg">
        <span class="hint" style="margin:0">在校综合测评成绩 = 各学年综合测评成绩的平均值</span>
        <span class="avg-value">${overall ? overall.avg : "—"}</span>
      </div>`;
  }

  function renderRank() {
    const body = $("#rank-body");
    const ranked = ZCCalc.rankMembers(state.classMembers);
    const myName = (state.profile.name || "").trim();
    $("#rank-empty").style.display = ranked.length ? "none" : "";
    body.innerHTML = ranked.length ? ranked.map((m, i) => `
      <tr class="${m.name === myName ? "me" : ""}">
        <td class="num">${m.rank <= 3 ? `<span class="rank-top r${m.rank}">${m.rank}</span>` : m.rank}</td>
        <td>${esc(m.name)}${m.name === myName ? ' <span class="tag" style="font-size:10px">我</span>' : ""}</td>
        <td class="num">${m.total}</td>
        <td class="op"><button class="del" data-action="del-rank" data-idx="${i}" title="删除">✕</button></td>
      </tr>`).join("") : "";
  }

  function renderSchemeSelect() {
    const sel = $("#scheme-select");
    if (sel) sel.value = getSchemeKey();
  }

  function renderAll() {
    setScheme(state.scheme || "benbu"); // 保证评分表/基准分/权重使用当前方案
    ensureDefaultYear();
    renderSchemeSelect();
    renderYearSelect();
    renderYearOverview();
    renderC1();
    renderC2();
    renderC3();
    renderOverall();
    renderRank();
  }

  /* 按快选目标返回对应评分表数据（兼容双方案：C1_* 与 C3_CATEGORIES 为全局，随方案切换） */
  function getItemList(target) {
    if (target === "c1_add") return C1_ADD_ITEMS;
    if (target === "c1_sub") return C1_SUB_ITEMS;
    if (target && target.startsWith("c3_")) {
      const cat = C3_CATEGORIES.find((c) => c.key === target.slice(3));
      return cat ? cat.items : [];
    }
    return [];
  }

  /* ---------------- 快捷添加面板 ---------------- */
  function openQuickModal(target) {
    quickTarget = target;
    const titleMap = {
      c1_add: "思想品德表现 · 加分项目", c1_sub: "思想品德表现 · 减分项目",
      c3_study: "发展素质 · 学习能力", c3_social: "发展素质 · 社会活动与社会工作",
      c3_innov: "发展素质 · 创新创业成果", c3_sports: "发展素质 · 文体素质"
    };
    $("#quick-modal-title").textContent = titleMap[target] || "快捷添加";
    const body = $("#quick-modal-body");

    const itemList = getItemList(target);

    body.innerHTML = itemList.map((it, gi) => {
      const hint = it.hint ? `<span class="q-hint">（${esc(it.hint)}）</span>` : "";
      if (it.levels) {
        const btns = it.levels.map((lv) =>
          `<button class="q-btn" data-g="${gi}" data-l="${esc(lv.label)}" data-p="${lv.points}" type="button">${esc(lv.label)} <span class="pts">${lv.points > 0 ? "+" : ""}${lv.points}分</span></button>`
        ).join("");
        return `<div class="quick-group"><p class="quick-group-title">${esc(it.label)}${hint}</p><div class="quick-levels">${btns}</div></div>`;
      }
      if (it.matrix) {
        const rows = Object.keys(it.matrix);
        const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(it.matrix[r]))));
        const head = `<tr><th>级别 \\ 等级</th>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
        const rowsHtml = rows.map((r) => {
          const cells = cols.map((c) => {
            const p = it.matrix[r][c];
            if (p === undefined || p === "—" || p === null) return `<td style="color:#c6ccd6">—</td>`;
            return `<td><button class="q-btn" data-g="${gi}" data-l="${esc(r + "·" + c)}" data-p="${p}" type="button"><span class="pts">${p}分</span></button></td>`;
          }).join("");
          return `<tr><td>${esc(r)}</td>${cells}</tr>`;
        }).join("");
        return `<div class="quick-group"><p class="quick-group-title">${esc(it.label)}${hint}</p><table class="matrix-table"><thead>${head}</thead><tbody>${rowsHtml}</tbody></table></div>`;
      }
      return "";
    }).join("");

    $("#quick-modal").hidden = false;
  }

  function closeQuickModal() { $("#quick-modal").hidden = true; quickTarget = null; }

  function addQuickItem(gi, levelLabel, points) {
    const year = getCurrentYear();
    if (!year || !quickTarget) return;
    const listName = quickTarget;
    const itemList = getItemList(listName);
    const item = itemList[gi];
    const name = `${item.label}（${levelLabel}）`;
    let p = Number(points);
    if (!isFinite(p)) return;
    if (listName === "c1_sub") p = -Math.abs(p);
    if (listName.startsWith("c3_")) {
      year.c3.items.push({ cat: listName.slice(3), name, points: p });
    } else if (listName === "c1_add") {
      year.c1.adds.push({ name, points: p });
    } else {
      year.c1.subs.push({ name, points: p });
    }
    save();
    closeQuickModal();
    renderAll();
  }

  /* ---------------- 自定义条目 ---------------- */
  function openCustomModal(target) {
    customTarget = target;
    const titleMap = {
      c1_add: "自定义加分", c1_sub: "自定义减分",
      c3_study: "自定义条目 · 学习能力", c3_social: "自定义条目 · 社会活动与社会工作",
      c3_innov: "自定义条目 · 创新创业成果", c3_sports: "自定义条目 · 文体素质"
    };
    $("#custom-modal-title").textContent = titleMap[target] || "自定义条目";
    $("#custom-name").value = "";
    $("#custom-points").value = "";
    $("#custom-points").parentElement.style.display = ""; // 恢复字段（重命名模式会隐藏）
    $("#custom-modal").hidden = false;
    setTimeout(() => $("#custom-name").focus(), 0);
  }

  function closeCustomModal() { $("#custom-modal").hidden = true; customTarget = null; }

  function confirmCustom() {
    const year = getCurrentYear();
    const name = $("#custom-name").value.trim();
    const p = Number($("#custom-points").value);
    if (!year || !customTarget) return;
    if (!name) { alert("请填写项目名称"); return; }
    if (!isFinite(p) || p === 0) { alert("请填写有效分值（非零数字）"); return; }
    let pts = p;
    if (customTarget === "c1_sub") pts = -Math.abs(p);
    if (customTarget.startsWith("c3_")) {
      year.c3.items.push({ cat: customTarget.slice(3), name, points: pts });
    } else if (customTarget === "c1_add") {
      year.c1.adds.push({ name, points: pts });
    } else {
      year.c1.subs.push({ name, points: pts });
    }
    save();
    closeCustomModal();
    renderAll();
  }

  /* ---------------- 学年管理 ---------------- */
  function addYear() {
    ensureDefaultYear();
    const n = state.years.length + 1;
    const y = newYear(`新学年 ${n}`);
    state.years.push(y);
    currentYearId = y.id;
    save();
    renderAll();
    // 打开重命名
    openRenameModal();
  }

  function openRenameModal() {
    const year = getCurrentYear();
    if (!year) return;
    customTarget = "__rename__";
    $("#custom-modal-title").textContent = "重命名学年";
    $("#custom-name").value = year.name;
    $("#custom-points").parentElement.style.display = "none"; // 隐藏分值字段
    $("#custom-modal").hidden = false;
    setTimeout(() => $("#custom-name").select(), 0);
  }

  function confirmRename() {
    const year = getCurrentYear();
    if (!year) return;
    const name = $("#custom-name").value.trim();
    if (!name) { alert("学年名称不能为空"); return; }
    year.name = name;
    save();
    closeCustomModal();
    renderAll();
  }

  function deleteYear() {
    if (!state.years.length) return;
    const year = getCurrentYear();
    if (!confirm(`确定删除学年「${year.name}」及其全部数据吗？此操作不可撤销。`)) return;
    state.years = state.years.filter((y) => y.id !== year.id);
    currentYearId = state.years.length ? state.years[0].id : null;
    save();
    renderAll();
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    // Tab 切换
    $$(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
      $$(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      $$(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
    }));

    // 个人信息
    ["name", "class", "id"].forEach((f) => {
      $("#profile-" + f).addEventListener("input", (e) => {
        state.profile[f === "class" ? "className" : f === "id" ? "studentId" : "name"] = e.target.value;
        save();
        renderRank();
      });
    });

    // 测评方案切换
    $("#scheme-select").addEventListener("change", (e) => {
      state.scheme = e.target.value;
      setScheme(state.scheme);
      save();
      renderAll();
    });

    // 学年
    $("#year-select").addEventListener("change", (e) => setCurrentYear(e.target.value));
    $("#btn-add-year").addEventListener("click", addYear);
    $("#btn-rename-year").addEventListener("click", openRenameModal);
    $("#btn-del-year").addEventListener("click", deleteYear);

    // C2 课程
    $("#btn-add-course").addEventListener("click", () => {
      const year = getCurrentYear();
      if (!year) return;
      year.courses.push({ name: "", credit: "", score: "", scale: "percent" });
      save();
      renderC2();
      renderYearOverview();
      const last = $("#course-body tr:last-child input");
      if (last) last.focus();
    });
    $("#course-body").addEventListener("input", (e) => {
      const tr = e.target.closest("tr");
      if (!tr) return;
      const year = getCurrentYear();
      const idx = Number(tr.dataset.idx);
      const field = e.target.dataset.field;
      if (!year || !year.courses[idx]) return;
      year.courses[idx][field] = e.target.value;
      save();
      renderYearOverview();
      renderC2Stat(); // 不重建表格，保持输入焦点
    });
    $("#course-body").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="del-course"]');
      if (!btn) return;
      const year = getCurrentYear();
      year.courses.splice(Number(btn.dataset.idx), 1);
      save();
      renderC2();
      renderYearOverview();
    });

    // 分数制/课程性质切换
    const FIVE_WORDS = ["优", "良", "中", "及格", "不及格"];
    $("#course-body").addEventListener("change", (e) => {
      const field = e.target.dataset.field;
      if (field !== "scale" && field !== "type") return;
      const tr = e.target.closest("tr");
      const year = getCurrentYear();
      const idx = Number(tr.dataset.idx);
      if (!year || !year.courses[idx]) return;
      const course = year.courses[idx];
      if (field === "type") {
        course.type = e.target.value;
      } else {
        const scale = e.target.value;
        const scoreInput = tr.querySelector('[data-field="score"]');
        const old = course.score;
        const isFiveWord = typeof old === "string" && FIVE_WORDS.includes(old.trim());
        if (scale === "five") {
          scoreInput.setAttribute("list", "grade-list");
          scoreInput.placeholder = "优/良/中/及格/不及格";
          if (old !== "" && old != null && !isFiveWord) { course.score = ""; scoreInput.value = ""; }
        } else {
          scoreInput.removeAttribute("list");
          scoreInput.placeholder = "0-100";
          if (isFiveWord) { course.score = ""; scoreInput.value = ""; }
        }
        course.scale = scale;
      }
      save();
      renderYearOverview();
      renderC2Stat();
    });

    // 仅统计必修+限选开关
    $("#c2-only-required").addEventListener("change", (e) => {
      const year = getCurrentYear();
      if (!year) return;
      year.c2OnlyRequired = e.target.checked;
      save();
      renderYearOverview();
      renderC2Stat();
    });

    // 教务系统粘贴导入
    const importModal = $("#import-modal");
    function openImportModal() {
      $("#import-text").value = "";
      $("#import-result").textContent = "";
      $("#import-result").classList.remove("error");
      importModal.hidden = false;
      setTimeout(() => $("#import-text").focus(), 0);
    }
    function closeImportModal() { importModal.hidden = true; }
    $("#btn-import-jw").addEventListener("click", openImportModal);
    $("#import-modal-close").addEventListener("click", closeImportModal);
    $("#import-modal-cancel").addEventListener("click", closeImportModal);
    $("#import-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeImportModal(); });
    $("#import-modal-ok").addEventListener("click", () => {
      const year = getCurrentYear();
      if (!year) return;
      const text = $("#import-text").value;
      const resultBox = $("#import-result");
      resultBox.classList.remove("error");
      try {
        const { courses, warnings } = ZCCalc.parseJwText(text);
        let added = 0, skipped = 0;
        for (const c of courses) {
          const dup = year.courses.some((x) => x.name === c.name && String(x.credit) === String(c.credit));
          if (dup) { skipped++; continue; }
          year.courses.push(c);
          added++;
        }
        save();
        closeImportModal();
        renderC2();
        renderYearOverview();
        const msgs = [`已导入 ${added} 门课程`];
        if (skipped) msgs.push(`跳过重复 ${skipped} 门`);
        if (warnings.length) msgs.push(...warnings.slice(0, 5));
        alert(msgs.join("；"));
      } catch (err) {
        resultBox.textContent = "解析失败：" + (err && err.message ? err.message : String(err));
        resultBox.classList.add("error");
      }
    });

    // 通用：删除条目（事件委托）
    document.addEventListener("click", (e) => {
      const del = e.target.closest(".item-row .del");
      if (!del) return;
      const year = getCurrentYear();
      const listKey = del.dataset.list;
      const idx = Number(del.dataset.idx);
      if (listKey === "c1_add") year.c1.adds.splice(idx, 1);
      else if (listKey === "c1_sub") year.c1.subs.splice(idx, 1);
      else if (listKey && listKey.startsWith("c3_")) {
        const cat = listKey.slice(3);
        const items = year.c3.items.filter((it) => it.cat === cat);
        const realIdx = year.c3.items.indexOf(items[idx]);
        if (realIdx >= 0) year.c3.items.splice(realIdx, 1);
      }
      save();
      renderAll();
    });

    // C3 分类折叠 + 快捷/自定义按钮（事件委托）
    document.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-toggle-cat]");
      if (toggle) {
        const k = toggle.dataset.toggleCat;
        c3Open[k] = !c3Open[k];
        renderC3();
        return;
      }
      const q = e.target.closest("[data-quick]");
      if (q) { openQuickModal(q.dataset.quick); return; }
      const cu = e.target.closest("[data-custom]");
      if (cu) { openCustomModal(cu.dataset.custom); return; }
    });

    // 体测成绩输入与保健班复选框
    $("#c3-cats").addEventListener("input", (e) => {
      if (e.target.dataset.peScore === undefined) return;
      const year = getCurrentYear();
      if (!year) return;
      year.c3.peScore = e.target.value === "" ? "" : Number(e.target.value);
      save();
      updatePeBadge(year);
    });
    $("#c3-cats").addEventListener("change", (e) => {
      if (e.target.dataset.peHealth === undefined) return;
      const year = getCurrentYear();
      if (!year) return;
      year.c3.peHealthClass = e.target.checked;
      save();
      updatePeBadge(year);
    });

    // 快选面板
    $("#quick-modal-body").addEventListener("click", (e) => {
      const btn = e.target.closest(".q-btn");
      if (!btn) return;
      addQuickItem(Number(btn.dataset.g), btn.dataset.l, btn.dataset.p);
    });
    $("#quick-modal-close").addEventListener("click", closeQuickModal);
    $("#quick-modal-cancel").addEventListener("click", closeQuickModal);
    $("#quick-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeQuickModal(); });

    // 自定义面板
    $("#custom-modal-close").addEventListener("click", closeCustomModal);
    $("#custom-modal-cancel").addEventListener("click", closeCustomModal);
    $("#custom-modal-ok").addEventListener("click", () => {
      if (customTarget === "__rename__") confirmRename();
      else confirmCustom();
    });
    $("#custom-modal").addEventListener("click", (e) => { if (e.target === e.currentTarget) closeCustomModal(); });
    $("#custom-points").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#custom-modal-ok").click(); });
    $("#custom-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#custom-modal-ok").click(); });

    // 班级排名
    $("#btn-rank-add").addEventListener("click", addRankMember);
    $("#rank-name").addEventListener("keydown", (e) => { if (e.key === "Enter") addRankMember(); });
    $("#rank-total").addEventListener("keydown", (e) => { if (e.key === "Enter") addRankMember(); });
    $("#btn-rank-me").addEventListener("click", () => {
      const year = getCurrentYear();
      const name = (state.profile.name || "").trim();
      if (!year) { alert("请先录入学年数据"); return; }
      if (!name) { alert("请先在右上角填写姓名"); return; }
      const total = ZCCalc.calcYear(year).total;
      // 若已存在同名则更新
      const idx = state.classMembers.findIndex((m) => m.name === name);
      if (idx >= 0) state.classMembers[idx].total = total;
      else state.classMembers.push({ name, total });
      save();
      renderRank();
    });
    $("#btn-rank-clear").addEventListener("click", () => {
      if (!confirm("确定清空全部班级成员吗？")) return;
      state.classMembers = [];
      save();
      renderRank();
    });
    $("#rank-body").addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="del-rank"]');
      if (!btn) return;
      state.classMembers.splice(Number(btn.dataset.idx), 1);
      save();
      renderRank();
    });

    // 数据管理
    $("#btn-export").addEventListener("click", () => ZCStorage.exportJSON(state));
    $("#import-file").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      const msg = $("#manage-msg");
      if (!file) return;
      try {
        const data = await ZCStorage.importFromFile(file);
        if (!confirm("导入将覆盖当前全部数据，确定继续吗？")) return;
        state = data;
        currentYearId = state.years.length ? state.years[0].id : null;
        save();
        renderAll();
        msg.textContent = `导入成功：${state.years.length} 个学年、${state.classMembers.length} 名班级成员。`;
        msg.classList.remove("error");
      } catch (err) {
        msg.textContent = "导入失败：" + (err && err.message ? err.message : "文件格式错误");
        msg.classList.add("error");
      } finally {
        e.target.value = "";
      }
    });
    $("#btn-wipe").addEventListener("click", () => {
      if (!confirm("确定清空本浏览器中保存的全部数据吗？此操作不可撤销，建议先导出备份。")) return;
      state = { profile: { name: "", className: "", studentId: "" }, years: [], classMembers: [] };
      currentYearId = null;
      save();
      renderAll();
      $("#manage-msg").textContent = "已清空全部数据。";
    });

    // 关闭模态框的 Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (!$("#quick-modal").hidden) closeQuickModal();
        if (!$("#custom-modal").hidden) closeCustomModal();
      }
    });
  }

  function addRankMember() {
    const name = $("#rank-name").value.trim();
    const total = Number($("#rank-total").value);
    if (!name) { alert("请填写姓名"); return; }
    if (!isFinite(total)) { alert("请填写有效总分"); return; }
    const idx = state.classMembers.findIndex((m) => m.name === name);
    if (idx >= 0) state.classMembers[idx].total = total;
    else state.classMembers.push({ name, total });
    $("#rank-name").value = "";
    $("#rank-total").value = "";
    save();
    renderRank();
    $("#rank-name").focus();
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    ensureDefaultYear();
    save(); // 首次打开时持久化默认学年
    bindEvents();
    renderAll();
  });
})();
