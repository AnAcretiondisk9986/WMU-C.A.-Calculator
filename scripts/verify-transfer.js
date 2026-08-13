/* 渲染验证脚本：node scripts/verify-transfer.js
 * 需要先安装 playwright：npm i playwright && npx playwright install chromium
 * 并另起本地静态服务器：python -m http.server 8137 */
const assert = require("assert");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message));

  // 1. transfer.html 默认本部·第一临床
  await page.goto("http://127.0.0.1:8137/transfer.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: ".reasonix/attachments/verify_transfer_benbu_default.png", fullPage: true });

  // 2. 填数据（第一临床 临床医学五年制：120人 第8名 面试22 四级480 高考610/620）
  await page.fill("#in-total", "120");
  await page.fill("#in-rank", "8");
  await page.fill("#in-interview", "22");
  await page.fill("#in-c4", "480");
  await page.fill("#in-gaokao", "610");
  await page.fill("#in-minadmit", "620");
  await page.waitForTimeout(200);
  const total = await page.textContent("#result-grid .result-item.total .value");
  console.log("本部·第一临床 总分 =", total.trim(), "(期望 55.56)");
  assert.strictEqual(total.trim(), "55.56", "第一临床总分");
  await page.screenshot({ path: ".reasonix/attachments/verify_transfer_benbu_filled.png", fullPage: true });

  // 3. 切到口腔医学院（高考公式 + 口腔英语）
  await page.selectOption("#college-select", "kq");
  await page.fill("#in-total", "100");
  await page.fill("#in-rank", "5");
  await page.fill("#in-interview", "26");
  await page.fill("#in-c6", "510");
  await page.fill("#in-gaokao", "610");
  await page.fill("#in-minadmit", "620");
  await page.waitForTimeout(200);
  const total2 = await page.textContent("#result-grid .result-item.total .value");
  console.log("本部·口腔 总分 =", total2.trim(), "(期望 84.83)");
  assert.strictEqual(total2.trim(), "84.83", "口腔总分");
  await page.screenshot({ path: ".reasonix/attachments/verify_transfer_kq.png", fullPage: true });

  // 4. 切到眼视光（IELTS/TOEFL + 跨专业）
  await page.selectOption("#college-select", "ysg");
  await page.selectOption("#major-select", "4"); // 生物医学工程
  await page.fill("#in-total", "100");
  await page.fill("#in-rank", "20");
  await page.fill("#in-interview", "30");
  await page.fill("#in-ielts", "6.8");
  await page.selectOption("#in-specialty", "2");
  await page.selectOption("#in-frommed", "0");
  await page.waitForTimeout(200);
  const total3 = await page.textContent("#result-grid .result-item.total .value");
  console.log("本部·眼视光 总分 =", total3.trim(), "(期望 72.9)");
  assert.strictEqual(total3.trim(), "72.9", "眼视光总分");
  await page.screenshot({ path: ".reasonix/attachments/verify_transfer_ysg.png", fullPage: true });

  // 5. 仁济方案
  await page.selectOption("#scheme-select", "renji");
  await page.fill("#in-total", "120");
  await page.fill("#in-rank", "10");
  await page.fill("#in-interview", "22");
  await page.fill("#in-c6", "440");
  await page.waitForTimeout(200);
  const total4 = await page.textContent("#result-grid .result-item.total .value");
  const qualify = await page.textContent("#qualify-line");
  console.log("仁济 总分 =", total4.trim(), "(期望 87.13)");
  console.log("仁济 资格 =", qualify.trim());
  assert.strictEqual(total4.trim(), "87.13", "仁济总分");
  assert.ok(qualify.includes("第一轮"), "仁济第一轮资格");
  await page.screenshot({ path: ".reasonix/attachments/verify_transfer_renji.png", fullPage: true });

  // 6. index.html 链接存在
  await page.goto("http://127.0.0.1:8137/index.html", { waitUntil: "networkidle" });
  const link = await page.$('a[href="transfer.html"]');
  console.log("index.html 转专业链接:", link ? "存在 ✓" : "缺失 ✗");

  console.log(errors.length ? "console 错误:\n" + errors.join("\n") : "无 console 错误 ✓");
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
