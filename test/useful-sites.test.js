"use strict";

const assert = require("assert");
const groups = require("../js/useful-sites-data.js");

const sites = groups.flatMap(group => group.sites);
const urls = sites.map(site => site.url);

assert(groups.length > 0, "至少应包含一个网站分类");
assert(sites.length > 0, "至少应收录一个网站");
assert.strictEqual(new Set(groups.map(group => group.id)).size, groups.length, "分类 id 不得重复");
assert.strictEqual(new Set(urls).size, urls.length, "网站 URL 不得重复");

groups.forEach(group => {
  assert(group.title && group.description && group.icon && group.tone, `分类 ${group.id} 信息不完整`);
  group.sites.forEach(site => {
    assert(site.name && site.description, `分类 ${group.id} 中存在信息不完整的网站`);
    const parsed = new URL(site.url);
    assert.strictEqual(parsed.protocol, "https:", `${site.name} 应使用 HTTPS`);
  });
});

console.log(`实用网站数据校验通过：${groups.length} 个分类，${sites.length} 个网站`);
