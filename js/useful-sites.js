(function () {
  "use strict";

  const groups = window.WMU_USEFUL_SITES || [];
  const filterRoot = document.getElementById("site-filters");
  const groupsRoot = document.getElementById("site-groups");
  const searchInput = document.getElementById("site-search");
  const status = document.getElementById("site-status");
  const clearButton = document.getElementById("site-search-clear");
  let activeGroup = "all";

  const icons = {
    campus: ["M4 20h16", "M6 20V9h12v11", "M9 20v-5h6v5", "M3 9l9-5 9 5"],
    college: ["M4 20h16", "M6 20V8h12v12", "M9 8V5h6v3", "M9 12h2M13 12h2M9 16h2M13 16h2"],
    book: ["M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23z", "M20 5.5A3.5 3.5 0 0 0 16.5 2H12v18h4.5A3.5 3.5 0 0 1 20 23z"],
    globe: ["M3 12h18", "M12 3a14 14 0 0 1 0 18", "M12 3a14 14 0 0 0 0 18", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"],
    search: ["M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z", "m16 16 5 5"],
    close: ["M6 6l12 12", "M18 6 6 18"],
    external: ["M14 5h5v5", "M13 11l6-6", "M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"]
  };

  function createIcon(name, className) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className || "icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    (icons[name] || icons.globe).forEach(function (pathData) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      svg.appendChild(path);
    });
    return svg;
  }

  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return url;
    }
  }

  function createFilter(group) {
    const button = document.createElement("button");
    button.className = "site-filter";
    button.type = "button";
    button.dataset.group = group ? group.id : "all";
    button.setAttribute("aria-pressed", group ? "false" : "true");
    if (group) button.appendChild(createIcon(group.icon));
    const text = document.createElement("span");
    text.textContent = group ? group.title : "全部";
    button.appendChild(text);
    button.addEventListener("click", function () {
      activeGroup = button.dataset.group;
      filterRoot.querySelectorAll(".site-filter").forEach(function (item) {
        item.setAttribute("aria-pressed", String(item === button));
      });
      render();
    });
    return button;
  }

  function createSiteCard(site, group) {
    const link = document.createElement("a");
    link.className = "site-card tone-" + group.tone;
    link.href = site.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", site.name + "，在新窗口打开");

    const mark = document.createElement("span");
    mark.className = "site-card-mark";
    mark.appendChild(createIcon(group.icon, "site-card-icon"));

    const copy = document.createElement("span");
    copy.className = "site-card-copy";
    const name = document.createElement("strong");
    name.textContent = site.name;
    const description = document.createElement("span");
    description.className = "site-card-description";
    description.textContent = site.description;
    const domain = document.createElement("span");
    domain.className = "site-card-domain";
    domain.textContent = getDomain(site.url);
    copy.append(name, description, domain);

    const open = createIcon("external", "site-card-open");
    link.append(mark, copy, open);
    return link;
  }

  function createGroup(group, sites) {
    const section = document.createElement("section");
    section.className = "site-group";
    section.id = "sites-" + group.id;

    const head = document.createElement("div");
    head.className = "site-group-head";
    const titleWrap = document.createElement("div");
    titleWrap.className = "site-group-title";
    const iconWrap = document.createElement("span");
    iconWrap.className = "site-group-icon tone-" + group.tone;
    iconWrap.appendChild(createIcon(group.icon));
    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = group.title;
    const description = document.createElement("p");
    description.textContent = group.description;
    copy.append(title, description);
    titleWrap.append(iconWrap, copy);
    const count = document.createElement("span");
    count.className = "site-group-count";
    count.textContent = sites.length + " 个站点";
    head.append(titleWrap, count);

    const grid = document.createElement("div");
    grid.className = "site-grid";
    sites.forEach(function (site) {
      grid.appendChild(createSiteCard(site, group));
    });
    section.append(head, grid);
    return section;
  }

  function normalized(value) {
    return String(value || "").toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
  }

  function render() {
    const query = normalized(searchInput.value);
    let total = 0;
    groupsRoot.replaceChildren();

    groups.forEach(function (group) {
      if (activeGroup !== "all" && activeGroup !== group.id) return;
      const sites = group.sites.filter(function (site) {
        if (!query) return true;
        return normalized([group.title, site.name, site.description, getDomain(site.url)].join(" ")).includes(query);
      });
      if (!sites.length) return;
      total += sites.length;
      groupsRoot.appendChild(createGroup(group, sites));
    });

    if (!total) {
      const empty = document.createElement("div");
      empty.className = "site-empty";
      empty.appendChild(createIcon("search", "site-empty-icon"));
      const title = document.createElement("strong");
      title.textContent = "未找到匹配的网站";
      const note = document.createElement("span");
      note.textContent = "试试搜索网站名称、用途或域名";
      empty.append(title, note);
      groupsRoot.appendChild(empty);
    }

    status.textContent = query || activeGroup !== "all" ? "找到 " + total + " 个网站" : "共收录 " + total + " 个网站";
    clearButton.hidden = !searchInput.value;
  }

  function init() {
    filterRoot.appendChild(createFilter(null));
    groups.forEach(function (group) {
      filterRoot.appendChild(createFilter(group));
    });
    searchInput.addEventListener("input", render);
    clearButton.addEventListener("click", function () {
      searchInput.value = "";
      searchInput.focus();
      render();
    });
    render();
  }

  init();
})();
