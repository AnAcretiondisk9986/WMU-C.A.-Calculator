/* storage.js 单测（Node 环境运行，mock localStorage） */
"use strict";

const assert = require("assert");
const { ZCStorage, DEFAULT_DATA, normalizeScheme } = require("../js/storage.js");

let passed = 0;
function t(name, fn) { fn(); passed++; console.log("  ✔ " + name); }

/* 用 mock localStorage 隔离测试（Node 无 localStorage 全局） */
function mockLocalStorage(initial) {
  const store = Object.assign({}, initial || {});
  global.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  };
  return store;
}

console.log("— 默认数据与深拷贝 —");
t("defaultData 返回含 version 的全新对象，且互不影响", () => {
  const a = ZCStorage.defaultData();
  const b = ZCStorage.defaultData();
  assert.strictEqual(a.version, 1);
  assert.strictEqual(a.scheme, "benbu");
  assert.deepStrictEqual(a.profile, { name: "", className: "", studentId: "" });
  a.profile.name = "张三";
  assert.strictEqual(b.profile.name, "", "深拷贝互不影响");
  assert.strictEqual(DEFAULT_DATA.profile.name, "", "默认值不被污染");
});

console.log("— scheme 白名单 —");
t("normalizeScheme 只接受 benbu/renji，其余回退默认", () => {
  assert.strictEqual(normalizeScheme("benbu"), "benbu");
  assert.strictEqual(normalizeScheme("renji"), "renji");
  assert.strictEqual(normalizeScheme("garbage"), "benbu");
  assert.strictEqual(normalizeScheme(""), "benbu");
  assert.strictEqual(normalizeScheme(undefined), "benbu");
  assert.strictEqual(normalizeScheme(null), "benbu");
});

console.log("— 导入解析 —");
t("parseImport 校验 scheme 白名单", () => {
  const d = ZCStorage.parseImport(JSON.stringify({ scheme: "garbage", years: [] }));
  assert.strictEqual(d.scheme, "benbu");
});
t("parseImport 合并 profile 缺省字段", () => {
  const d = ZCStorage.parseImport(JSON.stringify({ profile: { name: "张三" } }));
  assert.strictEqual(d.profile.name, "张三");
  assert.strictEqual(d.profile.className, "");
  assert.strictEqual(d.profile.studentId, "");
});
t("parseImport 非法 JSON 抛错", () => {
  assert.throws(() => ZCStorage.parseImport("{not json"));
});
t("parseImport 非对象抛错", () => {
  assert.throws(() => ZCStorage.parseImport("[1,2,3]"));
});

console.log("— load / save（mock localStorage） —");
t("load 空存储返回默认数据", () => {
  mockLocalStorage();
  const d = ZCStorage.load();
  assert.strictEqual(d.scheme, "benbu");
  assert.deepStrictEqual(d.years, []);
  assert.strictEqual(d.version, 1);
});
t("load 脏 scheme 回退默认", () => {
  mockLocalStorage({ "wmu-zongce-v1": JSON.stringify({ scheme: "xxx", years: [{ id: "y1" }] }) });
  const d = ZCStorage.load();
  assert.strictEqual(d.scheme, "benbu");
  assert.strictEqual(d.years.length, 1);
});
t("load 旧数据缺字段自动合并", () => {
  mockLocalStorage({ "wmu-zongce-v1": JSON.stringify({ profile: { name: "李四" } }) });
  const d = ZCStorage.load();
  assert.strictEqual(d.profile.name, "李四");
  assert.strictEqual(d.profile.studentId, "");
  assert.strictEqual(d.scheme, "benbu");
});
t("load 损坏 JSON 不抛错，回退默认", () => {
  mockLocalStorage({ "wmu-zongce-v1": "{broken" });
  const d = ZCStorage.load();
  assert.strictEqual(d.scheme, "benbu");
});
t("save/load 往返保留 scheme 与 years", () => {
  mockLocalStorage();
  const data = ZCStorage.defaultData();
  data.scheme = "renji";
  data.years.push({ id: "y1", name: "2024-2025 学年", courses: [], c1: { adds: [], subs: [] }, c3: { items: [] } });
  assert.strictEqual(ZCStorage.save(data), true);
  const d = ZCStorage.load();
  assert.strictEqual(d.scheme, "renji");
  assert.strictEqual(d.years.length, 1);
});

console.log("\n全部通过：" + passed + " 项");
