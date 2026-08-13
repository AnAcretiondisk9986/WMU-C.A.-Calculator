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
      state.years.push({ id: "y-" + Date.now(), name: "2024-2025 学年", courses: [], c1: { adds: [], subs: [] }, c3: { items: [] } });
      currentYearId = state.years[state.years.length - 1].id;
    }
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
        <div class="extra">基准80 ${r.c1.addSum ? "+" + r.c1.addSum : ""} ${r.c1.subSum ? "−" + r.c1.subSum : ""}
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
        <div class="extra">基准70 ${r.c3.addSum ? "+" + r.c3.addSum : ""}</div>
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
    const r = ZCCalc.calcC2(year.courses);
    if (year.courses.length) {
      const parts = [`学分加权平均分 <b>${r.creditSum > 0 ? r.score : "—"}</b>`];
      parts.push(`总学分 ${r.creditSum}`);
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
      body.innerHTML = '<tr><td colspan="4"><div class="empty-hint">暂无课程，点击下方按钮添加（成绩可输入百分制数字或 优/良/中/及格/不及格）</div></td></tr>';
    } else {
      body.innerHTML = year.courses.map((c, i) => `
        <tr data-idx="${i}">
          <td><input data-field="name" value="${esc(c.name)}" placeholder="课程名称" maxlength="40"></td>
          <td class="num"><input data-field="credit" type="number" min="0" step="0.5" value="${c.credit ?? ""}" placeholder="学分"></td>
          <td class="num"><input data-field="score" value="${esc(c.score)}" list="grade-list" placeholder="成绩" maxlength="10"></td>
          <td class="op"><button class="del" data-action="del-course" data-idx="${i}" title="删除">✕</button></td>
        </tr>`).join("");
    }
    renderC2Stat();
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

  function renderAll() {
    ensureDefaultYear();
    renderYearSelect();
    renderYearOverview();
    renderC1();
    renderC2();
    renderC3();
    renderOverall();
    renderRank();
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

    const itemList = target === "c1_add" ? C1_ADD_ITEMS
      : target === "c1_sub" ? C1_SUB_ITEMS
      : target === "c3_study" ? C3_STUDY_ITEMS
      : target === "c3_social" ? C3_SOCIAL_ITEMS
      : target === "c3_innov" ? C3_INNOV_ITEMS
      : C3_SPORTS_ITEMS;

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
    const itemList = listName === "c1_add" ? C1_ADD_ITEMS
      : listName === "c1_sub" ? C1_SUB_ITEMS
      : listName === "c3_study" ? C3_STUDY_ITEMS
      : listName === "c3_social" ? C3_SOCIAL_ITEMS
      : listName === "c3_innov" ? C3_INNOV_ITEMS
      : C3_SPORTS_ITEMS;
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
    const y = { id: "y-" + Date.now(), name: `新学年 ${n}`, courses: [], c1: { adds: [], subs: [] }, c3: { items: [] } };
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

    // 学年
    $("#year-select").addEventListener("change", (e) => setCurrentYear(e.target.value));
    $("#btn-add-year").addEventListener("click", addYear);
    $("#btn-rename-year").addEventListener("click", openRenameModal);
    $("#btn-del-year").addEventListener("click", deleteYear);

    // C2 课程
    $("#btn-add-course").addEventListener("click", () => {
      const year = getCurrentYear();
      if (!year) return;
      year.courses.push({ name: "", credit: "", score: "" });
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
