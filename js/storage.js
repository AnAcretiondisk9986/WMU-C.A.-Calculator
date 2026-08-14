/* =========================================================================
 * storage.js — localStorage 持久化 + JSON 导入/导出
 * 数据模型：
 *   {
 *     profile: { name, className, studentId },     // 个人信息（用于班级排名展示）
 *     years: [ { id, name, courses[], c1:{adds,subs}, c3:{items} } ],
 *     classMembers: [ { name, total } ]             // 班级排名：姓名+总分
 *   }
 * ========================================================================= */

"use strict";

const STORAGE_KEY = "wmu-zongce-v1";
const ARCHIVE_KEY = "wmu-zongce-archives-v1";

const DEFAULT_DATA = {
  version: 1,             // 数据模型版本（供未来迁移）
  profile: { name: "", className: "", studentId: "" },
  scheme: "benbu",        // 测评方案：benbu 温医大本部（默认）/ renji 仁济学院
  years: [],
  classMembers: []
};

/** scheme 白名单校验，非法回退默认方案（load 与 import 共用） */
const normalizeScheme = (scheme) =>
  (scheme === "renji" || scheme === "benbu") ? scheme : DEFAULT_DATA.scheme;

const ZCStorage = {
  /** 返回一份全新的默认数据结构（深拷贝，避免外部改动污染默认值） */
  defaultData() {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return ZCStorage.defaultData();
      const data = JSON.parse(raw);
      // 合并默认结构，避免旧数据缺字段；scheme 做白名单校验
      return {
        version: Number.isInteger(data.version) ? data.version : DEFAULT_DATA.version,
        profile: Object.assign({}, DEFAULT_DATA.profile, data.profile || {}),
        scheme: normalizeScheme(data.scheme),
        years: Array.isArray(data.years) ? data.years : [],
        classMembers: Array.isArray(data.classMembers) ? data.classMembers : []
      };
    } catch (e) {
      console.warn("读取本地数据失败，使用空数据", e);
      return ZCStorage.defaultData();
    }
  },

  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error("保存本地数据失败", e);
      return false;
    }
  },

  exportJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wmu-zongce-data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * 解析导入的 JSON，校验结构后返回数据；失败抛错
   */
  parseImport(text) {
    const data = JSON.parse(text); // 非法 JSON 会抛错
    if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("数据格式不正确：应为 JSON 对象");
    const out = {
      version: Number.isInteger(data.version) ? data.version : DEFAULT_DATA.version,
      profile: Object.assign({}, DEFAULT_DATA.profile, data.profile || {}),
      scheme: normalizeScheme(data.scheme),
      years: Array.isArray(data.years) ? data.years : [],
      classMembers: Array.isArray(data.classMembers) ? data.classMembers : []
    };
    return out;
  },

  /** 从文件选择器读取并导入 */
  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(ZCStorage.parseImport(String(reader.result)));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsText(file, "utf-8");
    });
  }
};

/* =========================================================================
 * ZCArchive — 个人档案卡（多档案）：建立 / 载入 / 导入 / 导出
 * 每张档案卡 { id, name, updatedAt, data }，其中 data 与主数据同构
 * （profile / scheme / years / classMembers / version）。
 * 独立存储于 ARCHIVE_KEY，便于多位同学或不同阶段分别建档。
 * ========================================================================= */

const ZCArchive = {
  list() {
    try {
      const raw = localStorage.getItem(ARCHIVE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn("读取档案卡失败", e);
      return [];
    }
  },

  _saveList(list) {
    try {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      console.error("保存档案卡失败", e);
      return false;
    }
  },

  /** 从主数据建立一张档案卡；同名覆盖，返回 {card, overwritten} */
  create(name, data) {
    const cleanName = String(name || "").trim();
    if (!cleanName) throw new Error("请填写档案名称");
    const snapshot = {
      version: (data && Number.isInteger(data.version)) ? data.version : DEFAULT_DATA.version,
      profile: Object.assign({}, DEFAULT_DATA.profile, (data && data.profile) || {}),
      scheme: normalizeScheme(data && data.scheme),
      years: Array.isArray(data && data.years) ? data.years : [],
      classMembers: Array.isArray(data && data.classMembers) ? data.classMembers : []
    };
    const list = this.list();
    const existing = list.find((c) => c.name === cleanName);
    const card = {
      id: existing ? existing.id : "a-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      name: cleanName,
      updatedAt: new Date().toISOString(),
      data: snapshot
    };
    const next = existing
      ? list.map((c) => (c.id === existing.id ? card : c))
      : list.concat(card);
    this._saveList(next);
    return { card, overwritten: !!existing };
  },

  get(id) {
    return this.list().find((c) => c.id === id) || null;
  },

  remove(id) {
    this._saveList(this.list().filter((c) => c.id !== id));
  },

  /** 解析导入文本：支持整张卡 {name, data} 或整份主数据（用姓名作卡名） */
  parseCard(text) {
    const obj = JSON.parse(text); // 非法 JSON 抛错
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      throw new Error("档案卡格式不正确：应为 JSON 对象");
    }
    if (obj.data && typeof obj.data === "object") {
      return {
        name: String(obj.name || "").trim() || "未命名档案",
        data: ZCStorage.parseImport(JSON.stringify(obj.data))
      };
    }
    const data = ZCStorage.parseImport(text);
    return { name: (data.profile && data.profile.name) || "未命名档案", data };
  },

  importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(this.parseCard(String(reader.result))); }
        catch (e) { reject(e); }
      };
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsText(file, "utf-8");
    });
  },

  exportCard(card) {
    const blob = new Blob([JSON.stringify(card, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (card && card.name ? card.name : "wmu-archive") + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ZCStorage, ZCArchive, DEFAULT_DATA, normalizeScheme, ARCHIVE_KEY };
} else if (typeof window !== "undefined") {
  window.ZCStorage = ZCStorage;
  window.ZCArchive = ZCArchive;
}
