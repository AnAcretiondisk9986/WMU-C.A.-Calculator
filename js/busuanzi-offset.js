/* =========================================================================
 * busuanzi-offset.js — 不蒜子换域名后的计数恢复
 *
 * 背景：不蒜子按域名（Referer）分别计数。站点从旧域名迁移到新域名后，
 * 新域名的 site_pv / site_uv 从零开始。旧域名（GitHub Pages）仍在线，
 * 其累计计数仍保存在不蒜子服务器上（查询可得）。
 *
 * 本脚本在官方 busuanzi 脚本填充当前域名计数后，将旧域名累计值叠加显示，
 * 使页面上呈现「旧站累计 + 新站新增」的连续数字。
 *
 * 更新方法：访问旧域名页面 → 不蒜子接口返回 site_pv/site_uv → 更新 OFFSET。
 * ========================================================================= */

(function () {
  "use strict";

  // 旧域名累计值（2026-02 查询 anacretiondisk9986.github.io/WMU-C.A.-Calculator/）
  var OFFSET_PV = 148;
  var OFFSET_UV = 39;

  // 官方脚本是异步加载填充，轮询等待 span 出现数字后叠加
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var pv = document.getElementById("busuanzi_value_site_pv");
    var uv = document.getElementById("busuanzi_value_site_uv");
    var pvDone = false, uvDone = false;
    if (pv && /^\d+$/.test(pv.textContent)) {
      pv.textContent = String(parseInt(pv.textContent, 10) + OFFSET_PV);
      pvDone = true;
    }
    if (uv && /^\d+$/.test(uv.textContent)) {
      uv.textContent = String(parseInt(uv.textContent, 10) + OFFSET_UV);
      uvDone = true;
    }
    if ((pvDone && uvDone) || tries > 40) clearInterval(timer); // 最多等约 20 秒
  }, 500);
})();
