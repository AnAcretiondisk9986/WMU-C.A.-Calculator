# WMU 综测计算器 — 交接文档（HANDOFF）

> 写给接手者（DSH）。读完本文档 + 跑一遍测试，即可接手本项目。
> 最后更新：2026-08-13，基于 `main` 分支 `ed678e1`。

---

## 1. 项目是什么

**温州医科大学素质综合测评计算器**（含独立的**转专业考核计算器**），是一个基于 GitHub Pages 的纯前端静态网页：

- **零依赖、零构建**：只有 HTML / CSS / 原生 JS，没有 package.json、没有框架、没有 CI。
- 依据《学生素质综合测评办法》实现综测计算，**仅供学生自评参考**，结果以班级测评小组、系及学院认定为准。
- 双页面互链：`index.html`（综测）↔ `transfer.html`（转专业），导航栏互相跳转。

## 2. 快速开始

```bash
# 本地直接用浏览器打开即可使用（数据存本机 localStorage）
start index.html

# 跑计算层单测（无需安装任何依赖，Node 内置 assert）
node test/calc.test.js
node test/transfer.test.js
```

部署：GitHub 仓库 → Settings → Pages → `Deploy from a branch`（main / root）。无自动部署，改完手动推送即可。

## 3. 目录结构

| 文件 | 职责 |
|---|---|
| `index.html` | 综测页面骨架（三个 tab：个人测评 / 班级排名 / 数据管理 + 导入模态框） |
| `transfer.html` | 转专业考核计算页面 |
| `css/style.css` | 全部样式 |
| `js/data.js` | 综测评分表数据（表1~表7、加减分项目、五级换算、两套方案常量） |
| `js/calc.js` | 综测纯计算逻辑（C1/C2/C3/总分/排名/教务文本解析/体测判定），无 DOM |
| `js/storage.js` | localStorage 持久化 + JSON 导入导出 |
| `js/app.js` | 综测交互层（渲染、快选面板、学年管理、导入 UI、班级排名） |
| `js/transfer.js` | 转专业数据 + 纯计算（本部 13 学院 + 仁济） |
| `js/transfer-app.js` | 转专业页面交互逻辑 |
| `test/calc.test.js` | 综测计算层单测（Node） |
| `test/transfer.test.js` | 转专业计算层单测（Node） |
| `scripts/verify-transfer.js` | Playwright 渲染冒烟验证（**可选**，依赖本机 playwright） |

## 4. 架构要点（改代码前必读）

1. **脚本加载顺序敏感**：`index.html` 按 `data.js → calc.js → storage.js → app.js` 顺序加载，依赖全局变量链；`transfer.html` 按 `transfer.js → transfer-app.js`。新增脚本别打乱顺序。
2. **纯计算层与 DOM 分离**：`calc.js` / `transfer.js` 不碰 DOM，通过 `window.ZCCalc` / `window.ZT` 导出，同时 `module.exports` 供 Node 测试 require——这是双环境复用，**不要在计算层引入 DOM/localStorage**。
3. **方案切换机制**：`data.js` 里 `SCHEMES` 注册表（`benbu` 本部默认 / `renji` 仁济）+ `setScheme()` 把 `FIVE_GRADE/WEIGHTS/BASE_C1/BASE_C3/CAP/C1_PASS/C2_FAIL_CREDITS/C1_ADD_ITEMS/C1_SUB_ITEMS/C3_CATEGORIES` 挂到全局，`calc.js`、`app.js` 直接引用这些全局名。
4. **持久化**：综测主数据单 key `wmu-zongce-v1`（localStorage），模型 `{profile, scheme, years[], classMembers[]}`；**个人档案卡**另存 key `wmu-zongce-archives-v1`（数组，`ZCArchive` 管理）。转专业页 key `wmu-transfer-v1` 持久化方案/学院/输入。

## 5. 计算规则速览

### 综测（index.html）

| 部分 | 公式 | 封顶/合格线 |
|---|---|---|
| C1 思想品德 | `min(100, 80 + Σ加分 − Σ减分)` | <60 分不合格 |
| C2 课程成绩 | `Σ(考分×学分) / Σ学分`（学分加权平均） | 不及格学分 ≥20 不合格 |
| C3 发展素质 | `min(100, 基准分 + Σ加分)`，基准：本部 65 / 仁济 70 | 只加分 |
| 学年综合 C | `C1×10% + C2×70% + C3×20%` | — |
| 在校综合 | 各学年 C 的平均值 | — |

- 五级制换算：优=90 / 良=80 / 中=70 / 及格=60 / 不及格=50。
- 体测降档：总分 ≥80（良好）不降档，<80 降一等级；保健班/保健科证明不降档。
- 加分细则按 20-21、23-24 学年测评会议纪要维护，快选面板用「级别×等级」矩阵编码（学科竞赛、文体竞赛等）。

### 转专业（transfer.html）

- **本部**：按接收学院切换 13 个学院的《选拔类转专业考核实施办法》，每学院含专业成绩排名公式（含各专业系数、护理分档制）、面试满分/合格线、大学英语计分（10 种规则）、专长档次、高考计分（口腔公式 `10−[(最低录取分−高考)×0.25]`）、跨专业计分（眼视光非医→医 0 分）。
- **仁济**：2025 统一方案（成绩 65% / 面试 25% / 专长 5% / 英语 5%），判定第一轮（前 15%）、第二轮（前 50%）申请资格。

## 6. 常见改动的落点

| 想改什么 | 改哪里 | 同步改 |
|---|---|---|
| 加分细则/分值 | `data.js` 对应方案常量 | `test/calc.test.js` 加用例 |
| 新增综测学院方案 | ① `data.js` 定义常量 + `SCHEMES` 注册；② `index.html` 下拉加 option；③ `storage.js` scheme 白名单加 key | 测试 |
| 新增转专业学院 | `transfer.js` 的 `BENBU_COLLEGES` | `test/transfer.test.js` |
| 计算规则/公式 | `calc.js`（或 `transfer.js`） | 同步更新 `test/*` 与 README 速览表 |
| UI 样式/交互 | `app.js` / `transfer-app.js` / `css/style.css` | 浏览器手测 |

## 7. 导入功能（三条路径，别混淆）

1. **教务系统粘贴导入**：教务系统复制成绩表格 → 粘贴 → `parseJwText`（在 `calc.js`）解析，表头定位 + 制表符/空格分隔，作废行跳过，补考/重修/等级制给警告。
2. **豆包 OCR 批量导入**：引导卡片 → 截图 → 豆包 OCR（内置一键复制提示词 `OCR_PROMPT`）→ 豆包输出 Tab 分隔表格 → 仍走路径 1 的解析。
3. **JSON 文件备份**：`storage.js` 的 exportJSON / importFromFile。

## 8. 已知问题与坑（接手后建议优先处理）

> 2026-08-13 接手后已修复坑 1~4、坑 6（补 CI），并额外修了第 11 节列出的几处。坑 5、7 仍待处理。

1. 【已修复】 —— **README 写了 `node smoke.test.js` 但项目里不存在该文件**：README 已改为指向 `scripts/verify-transfer.js`。
2. 【已修复】 —— **`calc.js` 头部注释过时**（C3 写 70）：连同 `index.html`「公式速览」里的硬编码 70 一并改为「基准分按方案（本部 65 / 仁济 70）」。
3. 【已修复】 —— **清空数据会把方案重置为本部**：`btn-wipe` 改用 `ZCStorage.defaultData()` 并保留当前 `scheme`。
4. 【已修复】 —— **`transfer-app.js` 用字符串硬编码判断专业**：眼视光各专业加显式 `med` 字段，UI 改读 `m.med`。
5. 【仍待处理】 —— **`verify-transfer.js` 强依赖本机 playwright + 静态服务器**，截图写入被忽略的 `.reasonix/`，不可移植。
6. 【已修复】 —— **无 CI**：新增 `.github/workflows/ci.yml`，push/PR 时跑三个 node 测试（未含自动部署 Pages）。
7. 【仍待处理】 —— **数据只存浏览器 localStorage**：转专业页已加本地持久化，但仍是本地存储，跨设备仍需 JSON 导出兜底。
8. 【已过时】 —— **git 状态**：本次改动后工作树非干净、尚未提交。

## 9. 验证清单（每次改动后）

```bash
node test/calc.test.js      # 综测计算层，必须全绿
node test/transfer.test.js  # 转专业计算层，必须全绿
# 浏览器手测：方案切换（本部/仁济）、五级制换算、教务粘贴导入、导出/导入 JSON
```

## 10. 建议的下一步（可选）

- [x] 修掉第 8 节的坑 1~4（README 对齐、注释修正、清空保留 scheme、去掉硬编码）
- [x] 给转专业页加 localStorage 持久化（目前每次刷新重填）
- [x] 加 GitHub Actions：push 时跑 node 测试（含新增 storage 测试；**自动部署 Pages 未做**，仍为手动分支部署）
- [ ] 新增学院方案前，先按第 6 节清单逐项核对
- [ ] 把 `verify-transfer.js` 改造成 CI 可移植的冒烟测试（去掉 `.reasonix/` 截图与硬编码端口）
- [ ] 交接文档文件名统一（`handoff.md` / `HANDOFF.md` 大小写），README 加链接

## 11. 本次接手已落地改动（2026-08-13）

- 空学年不再算出误导性总分：`calcYear` 无有效课程时 `total` 返回 `null`，`calcOverall` 跳过空学年，UI 显示「—」；「带入我的成绩」对空学年给出提示。
- C1 减分过大时下限钳制到 0，避免负分。
- `storage.js`：`scheme` 白名单校验（load 与 import 统一）、新增 `version` 字段与 `defaultData()`、`parseImport` 拒绝数组等非对象、支持 Node `require`。
- 转专业页：学院/专业/输入数值持久化到 `wmu-transfer-v1`，刷新不丢；`toMed`/`interviewHint` 去硬编码。
- 体验/无障碍：课程表与模态框横向滚动、Escape 关闭导入模态框、删除按钮加 `aria-label`、模态框加 `role="dialog" aria-modal`。
- 测试：新增 `test/storage.test.js`，`calc/transfer` 测试各补边界用例；CI 已加。
