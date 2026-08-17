/* storage.js 单测（Node 环境运行，mock localStorage） */
"use strict";

const assert = require("assert");
const { ZCStorage, ZCArchive, DEFAULT_DATA, normalizeScheme } = require("../js/storage.js");

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

console.log("— 个人档案卡（ZCArchive） —");
t("create 建立档案卡并持久化快照", () => {
  mockLocalStorage();
  const data = ZCStorage.defaultData();
  data.profile.name = "张三";
  data.scheme = "renji";
  data.years.push({ id: "y1", name: "2024-2025", courses: [{ name: "高数", credit: 4, score: 90 }], c1: { adds: [], subs: [] }, c3: { items: [] } });
  const { card, overwritten } = ZCArchive.create("本人·大一", data);
  assert.strictEqual(overwritten, false);
  assert.strictEqual(card.name, "本人·大一");
  assert.strictEqual(card.data.profile.name, "张三");
  assert.strictEqual(card.data.scheme, "renji");
  assert.strictEqual(card.data.years.length, 1);
  assert.strictEqual(ZCArchive.list().length, 1);
});
t("create 同名覆盖不新增", () => {
  mockLocalStorage();
  ZCArchive.create("本人", ZCStorage.defaultData());
  const res2 = ZCArchive.create("本人", ZCStorage.defaultData());
  assert.strictEqual(res2.overwritten, true);
  assert.strictEqual(ZCArchive.list().length, 1);
});
t("create 空名抛错", () => {
  mockLocalStorage();
  assert.throws(() => ZCArchive.create("  ", ZCStorage.defaultData()));
});
t("remove 删除档案卡", () => {
  mockLocalStorage();
  const { card } = ZCArchive.create("本人", ZCStorage.defaultData());
  ZCArchive.remove(card.id);
  assert.strictEqual(ZCArchive.list().length, 0);
});
t("parseCard 支持整张卡与整份主数据", () => {
  const card = { name: "本人", updatedAt: "2026-08-13", data: { profile: { name: "张三" }, scheme: "renji", years: [] } };
  const r1 = ZCArchive.parseCard(JSON.stringify(card));
  assert.strictEqual(r1.name, "本人");
  assert.strictEqual(r1.data.scheme, "renji");
  assert.strictEqual(r1.data.profile.name, "张三");
  const r2 = ZCArchive.parseCard(JSON.stringify({ profile: { name: "李四" }, scheme: "benbu", years: [] }));
  assert.strictEqual(r2.name, "李四");
  assert.strictEqual(r2.data.scheme, "benbu");
});
t("parseCard 非法输入抛错", () => {
  assert.throws(() => ZCArchive.parseCard("{not json"));
  assert.throws(() => ZCArchive.parseCard("[1,2,3]"));
});
t("update 同步数据回档案卡（保持 id/名称不变）", () => {
  mockLocalStorage();
  const { card } = ZCArchive.create("本人", ZCStorage.defaultData());
  const data = ZCStorage.defaultData();
  data.profile.name = "张三";
  data.scheme = "renji";
  const updated = ZCArchive.update(card.id, data);
  assert.strictEqual(updated.id, card.id);
  assert.strictEqual(updated.name, "本人");
  assert.strictEqual(updated.data.profile.name, "张三");
  assert.strictEqual(updated.data.scheme, "renji");
  assert.strictEqual(ZCArchive.list().length, 1);
});
t("update 不存在的卡抛错", () => {
  mockLocalStorage();
  assert.throws(() => ZCArchive.update("nope", ZCStorage.defaultData()));
});
t("currentId 设置/读取/清除", () => {
  mockLocalStorage();
  assert.strictEqual(ZCArchive.getCurrentId(), null);
  ZCArchive.setCurrentId("abc");
  assert.strictEqual(ZCArchive.getCurrentId(), "abc");
  ZCArchive.setCurrentId(null);
  assert.strictEqual(ZCArchive.getCurrentId(), null);
});
t("remove 删除当前卡时清理 currentId", () => {
  mockLocalStorage();
  const { card } = ZCArchive.create("本人", ZCStorage.defaultData());
  ZCArchive.setCurrentId(card.id);
  ZCArchive.remove(card.id);
  assert.strictEqual(ZCArchive.getCurrentId(), null);
});

console.log("\n全部通过：" + passed + " 项");
