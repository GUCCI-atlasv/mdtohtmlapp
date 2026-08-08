var api = globalThis.browser || globalThis.chrome;

async function inject(tabId) {
  await api.scripting.executeScript({ target: { tabId: tabId }, files: ["vendor/readability.js", "content.js"] });
}

async function preferences() {
  var saved = await api.storage.local.get(["metadata", "frontmatter", "cleanContent"]);
  return {
    metadata: typeof saved.metadata === "boolean" ? saved.metadata : true,
    frontmatter: typeof saved.frontmatter === "boolean" ? saved.frontmatter : true,
    cleanContent: typeof saved.cleanContent === "boolean" ? saved.cleanContent : true
  };
}

async function showBadge(text, color) {
  await api.action.setBadgeBackgroundColor({ color: color || "#33835c" });
  await api.action.setBadgeText({ text: text });
  setTimeout(function () { api.action.setBadgeText({ text: "" }); }, 1800);
}

async function saveFile(tab, scope, format) {
  await inject(tab.id);
  var opts = await preferences();
  var result = await api.tabs.sendMessage(tab.id, Object.assign({ type: "MDHTML_EXPORT", format: format, scope: scope }, opts));
  if (!result || !result.ok) throw new Error((result && result.error) || "Export failed");
  var dataUrl = "data:" + result.mime + ";charset=utf-8," + encodeURIComponent(result.content);
  await api.downloads.download({ url: dataUrl, filename: result.filename, saveAs: false });
  await showBadge("✓");
}

async function saveHtml(tab, scope) {
  return saveFile(tab, scope, "html");
}

async function saveMarkdown(tab, scope) {
  return saveFile(tab, scope, "markdown");
}

async function copyMarkdown(tab, scope) {
  await inject(tab.id);
  var opts = await preferences();
  var result = await api.tabs.sendMessage(tab.id, Object.assign({ type: "MDHTML_COPY", scope: scope }, opts));
  if (!result || !result.ok) throw new Error((result && result.error) || "Copy failed");
  await showBadge("✓");
}

api.runtime.onInstalled.addListener(async function () {
  await api.contextMenus.removeAll();
  api.contextMenus.create({ id: "mdhtml-root", title: "保存网页", contexts: ["page", "selection"] });
  api.contextMenus.create({ id: "mdhtml-save-page-html", parentId: "mdhtml-root", title: "保存正文为 HTML", contexts: ["page", "selection"] });
  api.contextMenus.create({ id: "mdhtml-save-full-html", parentId: "mdhtml-root", title: "保存完整网页为 HTML", contexts: ["page", "selection"] });
  api.contextMenus.create({ id: "mdhtml-save-selection-html", parentId: "mdhtml-root", title: "保存选中内容为 HTML", contexts: ["selection"] });
  api.contextMenus.create({ id: "mdhtml-separator", parentId: "mdhtml-root", type: "separator", contexts: ["page", "selection"] });
  api.contextMenus.create({ id: "mdhtml-save-page-md", parentId: "mdhtml-root", title: "另存正文为 Markdown", contexts: ["page", "selection"] });
  api.contextMenus.create({ id: "mdhtml-copy-page-md", parentId: "mdhtml-root", title: "复制正文为 Markdown", contexts: ["page", "selection"] });
  api.contextMenus.create({ id: "mdhtml-pick", parentId: "mdhtml-root", title: "手动选择正文区域", contexts: ["page", "selection"] });
});

api.contextMenus.onClicked.addListener(async function (info, tab) {
  if (!tab || !/^https?:|^file:/i.test(tab.url || "")) return;
  try {
    if (info.menuItemId === "mdhtml-save-page-html") await saveHtml(tab, "main");
    else if (info.menuItemId === "mdhtml-save-full-html") await saveHtml(tab, "page");
    else if (info.menuItemId === "mdhtml-save-selection-html") await saveHtml(tab, "selection");
    else if (info.menuItemId === "mdhtml-save-page-md") await saveMarkdown(tab, "main");
    else if (info.menuItemId === "mdhtml-copy-page-md") await copyMarkdown(tab, "main");
    else if (info.menuItemId === "mdhtml-pick") {
      await inject(tab.id);
      await api.tabs.sendMessage(tab.id, { type: "MDHTML_START_PICKER" });
    }
  } catch (_) {
    await showBadge("!", "#b42318");
  }
});

api.commands.onCommand.addListener(async function (command) {
  if (command !== "save-as-html") return;
  var tabs = await api.tabs.query({ active: true, currentWindow: true });
  var tab = tabs[0];
  if (!tab || !/^https?:|^file:/i.test(tab.url || "")) return;
  try { await saveHtml(tab, "main"); }
  catch (_) { await showBadge("!", "#b42318"); }
});
