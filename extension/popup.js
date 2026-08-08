(function () {
  "use strict";

  var api = globalThis.browser || globalThis.chrome;
  var currentTab = null;
  var preparing = 0;
  var filenameTouched = false;
  var contentReady = false;
  var $ = function (id) { return document.getElementById(id); };

  function setStatus(message, kind) {
    $("status").textContent = message || "";
    $("status").className = "status" + (kind ? " " + kind : "");
  }

  function forbidden(url) {
    return !/^https?:|^file:/i.test(url || "");
  }

  function toggleButtons(disabled) {
    $("saveMarkdown").disabled = disabled;
    $("copyMarkdown").disabled = disabled;
    $("saveHtml").disabled = disabled;
  }

  function safeHost(url) {
    try { return new URL(url).hostname || "本地文件"; } catch (_) { return ""; }
  }

  function safeFilename(value) {
    return String(value || "page").replace(/\.(md|html?)$/i, "").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "page";
  }

  async function sendToPage(message) {
    if (!currentTab || forbidden(currentTab.url)) throw new Error("浏览器保护页面无法导出，请在普通网页上使用。");
    try {
      await api.scripting.executeScript({ target: { tabId: currentTab.id }, files: ["vendor/readability.js", "content.js"] });
      return await api.tabs.sendMessage(currentTab.id, message);
    } catch (error) {
      throw new Error(/^file:/i.test(currentTab.url || "")
        ? "请在扩展详情中开启“允许访问文件网址”，然后重试。"
        : "无法读取此页面。请刷新页面后重试。");
    }
  }

  function options() {
    return {
      scope: $("scope").value,
      metadata: $("metadata").checked,
      frontmatter: true,
      cleanContent: $("cleanContent").checked
    };
  }

  function updateStats(result) {
    var parts = [];
    if (result && result.characters) parts.push(result.characters.toLocaleString() + " 字符");
    if (result && result.imageTotal) parts.push("图片 " + result.imageValid + "/" + result.imageTotal);
    if (result && result.codeBlocks) parts.push("代码 " + result.codeBlocks);
    $("stats").textContent = parts.length ? parts.join(" · ") : "内容已准备完成";
  }

  async function persist() {
    await api.storage.local.set({
      scope: $("scope").value,
      metadata: $("metadata").checked,
      cleanContent: $("cleanContent").checked
    });
  }

  async function prepare() {
    var token = ++preparing;
    contentReady = false;
    toggleButtons(true);
    $("summaryTitle").textContent = "正在整理网页内容…";
    $("stats").textContent = "请稍候";
    setStatus("");
    try {
      var result = await sendToPage(Object.assign({ type: "MDHTML_PREPARE" }, options()));
      if (token !== preparing) return;
      if (!result || !result.ok) throw new Error((result && result.error) || "没有识别到正文。");
      if (!filenameTouched) $("filename").value = result.filename || "page";
      var qualityParts = [result.quality || ""];
      if (result.imageTotal) qualityParts.push("图片 " + result.imageValid + "/" + result.imageTotal);
      if (result.codeBlocks) qualityParts.push("代码 " + result.codeBlocks);
      $("quality").textContent = qualityParts.filter(Boolean).join(" · ");
      $("quality").classList.toggle("warn", result.qualityLevel === "warn");
      if (result.imageInvalid) setStatus("有 " + result.imageInvalid + " 张图片只有占位图，已从结果中移除。", "warn");
      $("summaryTitle").textContent = "HTML 文件已准备好";
      updateStats(result);
      contentReady = true;
      await persist();
    } catch (error) {
      if (token !== preparing) return;
      $("quality").textContent = "";
      $("summaryTitle").textContent = "无法生成 HTML";
      $("stats").textContent = "请更换保存范围后重试";
      setStatus(error.message || "提取失败，请选择其他范围。", "error");
    } finally {
      if (token === preparing) {
        toggleButtons(!contentReady);
      }
    }
  }

  async function download(content, filename, mime) {
    var blob = new Blob([content], { type: mime + ";charset=utf-8" });
    var objectUrl = URL.createObjectURL(blob);
    try {
      await api.downloads.download({ url: objectUrl, filename: filename, saveAs: false });
    } finally {
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 15000);
    }
  }

  async function saveMarkdown() {
    if (!contentReady) return;
    toggleButtons(true);
    try {
      var result = await sendToPage(Object.assign({
        type: "MDHTML_EXPORT",
        format: "markdown",
        filename: safeFilename($("filename").value)
      }, options()));
      if (!result || !result.ok) throw new Error((result && result.error) || "Markdown 生成失败。");
      await download(result.content, result.filename, result.mime);
      setStatus("已保存 " + result.filename);
    } catch (error) {
      setStatus(error.message || "下载失败，请重试。", "error");
    } finally { toggleButtons(false); }
  }

  async function copyMarkdown() {
    if (!contentReady) return;
    try {
      var result = await sendToPage(Object.assign({
        type: "MDHTML_EXPORT",
        format: "markdown",
        filename: safeFilename($("filename").value)
      }, options()));
      if (!result || !result.ok) throw new Error((result && result.error) || "Markdown 生成失败。");
      await navigator.clipboard.writeText(result.content);
      setStatus("Markdown 已复制");
    } catch (_) {
      setStatus("复制失败，请重试。", "error");
    }
  }

  async function saveHtml() {
    toggleButtons(true);
    setStatus("正在生成 HTML…", "info");
    try {
      var result = await sendToPage(Object.assign({
        type: "MDHTML_EXPORT",
        format: "html",
        filename: safeFilename($("filename").value)
      }, options()));
      if (!result || !result.ok) throw new Error((result && result.error) || "HTML 生成失败。");
      await download(result.content, result.filename, result.mime);
      setStatus("已保存 " + result.filename);
    } catch (error) {
      setStatus(error.message || "HTML 生成失败，请重试。", "error");
    } finally { toggleButtons(false); }
  }

  async function pickContent() {
    try {
      var result = await sendToPage({ type: "MDHTML_START_PICKER" });
      if (!result || !result.ok) throw new Error("无法启动区域选择。");
      window.close();
    } catch (error) { setStatus(error.message, "error"); }
  }

  async function init() {
    var tabs = await api.tabs.query({ active: true, currentWindow: true });
    currentTab = tabs[0];
    if (!currentTab) throw new Error("找不到当前标签页。");
    $("pageTitle").textContent = currentTab.title || "未命名页面";
    $("pageUrl").textContent = safeHost(currentTab.url);
    if (currentTab.favIconUrl) {
      $("favicon").src = currentTab.favIconUrl;
      $("favicon").hidden = false;
      $("fallbackIcon").hidden = true;
    }
    var saved = await api.storage.local.get(["scope", "metadata", "cleanContent"]);
    if (saved.scope) $("scope").value = saved.scope;
    if (typeof saved.metadata === "boolean") $("metadata").checked = saved.metadata;
    if (typeof saved.cleanContent === "boolean") $("cleanContent").checked = saved.cleanContent;
    if (forbidden(currentTab.url)) {
      setStatus("浏览器保护页面不允许扩展读取。", "error");
      toggleButtons(true);
      $("pickContent").disabled = true;
      return;
    }
    var info = await sendToPage({ type: "MDHTML_INSPECT" });
    $("selectionOption").disabled = !(info && info.hasSelection);
    $("pickedOption").disabled = !(info && info.hasPicked);
    if (($("scope").value === "selection" && $("selectionOption").disabled) || ($("scope").value === "picked" && $("pickedOption").disabled)) {
      $("scope").value = "main";
    }
    await prepare();
  }

  $("scope").addEventListener("change", prepare);
  $("metadata").addEventListener("change", prepare);
  $("cleanContent").addEventListener("change", prepare);
  $("filename").addEventListener("input", function () { filenameTouched = true; });
  $("saveMarkdown").addEventListener("click", saveMarkdown);
  $("copyMarkdown").addEventListener("click", copyMarkdown);
  $("saveHtml").addEventListener("click", saveHtml);
  $("pickContent").addEventListener("click", pickContent);
  if (!/Mac/i.test(navigator.platform)) $("shortcut").textContent = "Alt+Shift+M 快速保存 HTML";
  init().catch(function (error) { setStatus(error.message || "无法读取当前标签页。", "error"); toggleButtons(true); });
})();
