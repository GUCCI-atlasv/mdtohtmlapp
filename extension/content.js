(function () {
  "use strict";
  if (globalThis.__MDHTML_CONTENT_READY__) return;
  globalThis.__MDHTML_CONTENT_READY__ = true;

  var api = globalThis.browser || globalThis.chrome;
  var pickedHtml = "";
  var pickerCleanup = null;

  function textOf(node) {
    return (node && node.textContent || "").replace(/\s+/g, " ").trim();
  }

  function absolute(value) {
    try { return new URL(value, document.baseURI).href; } catch (_) { return value || ""; }
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeInlineText(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/([*_[\]])/g, "\\$1");
  }

  function mdUrl(value) {
    return "<" + String(value || "").replace(/>/g, "%3E").replace(/\s/g, "%20") + ">";
  }

  function metaValue(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      var node = document.querySelector(selectors[i]);
      if (!node) continue;
      var value = node.getAttribute && (node.getAttribute("content") || node.getAttribute("datetime")) || textOf(node);
      if (value && value.trim()) return value.trim();
    }
    return "";
  }

  function pageMetadata() {
    var wechat = location.hostname === "mp.weixin.qq.com";
    return {
      title: metaValue(["#activity-name", "meta[property='og:title']", "meta[name='twitter:title']"]) || document.title || "Untitled",
      byline: metaValue(["#js_name", "meta[name='author']", "[rel='author']", ".author"]),
      siteName: metaValue(["meta[property='og:site_name']"]) || (wechat ? "微信公众号" : ""),
      publishedTime: metaValue(["#publish_time", "meta[property='article:published_time']", "time[datetime]"])
    };
  }

  function selectedRoot() {
    var selection = getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    var box = document.createElement("div");
    for (var i = 0; i < selection.rangeCount; i++) box.appendChild(selection.getRangeAt(i).cloneContents());
    return textOf(box) || box.querySelector("img") ? box : null;
  }

  function rootFromHtml(html) {
    var box = document.createElement("div");
    box.innerHTML = html || "";
    return box;
  }

  function scoreCandidate(node) {
    var textLength = textOf(node).length;
    var paragraphs = node.querySelectorAll("p").length;
    var headings = node.querySelectorAll("h1,h2,h3").length;
    var links = Array.from(node.querySelectorAll("a")).reduce(function (sum, link) { return sum + textOf(link).length; }, 0);
    return textLength + paragraphs * 80 + headings * 60 - links * 0.7;
  }

  function heuristicMainRoot() {
    var candidates = Array.from(document.querySelectorAll("article,main,[role='main'],#main,#content,.main,.content,.post,.article,.entry-content,.post-content"));
    candidates = candidates.filter(function (node) { return textOf(node).length > 120; });
    candidates.sort(function (a, b) { return scoreCandidate(b) - scoreCandidate(a); });
    return candidates[0] || document.body;
  }

  function siteSpecificRoot() {
    var selectors = [
      "#js_content", "[itemprop='articleBody']", ".Post-RichTextContainer", ".RichText.ztext",
      ".article-content", ".article__content", ".post-content", ".entry-content", ".markdown-body",
      ".notion-page-content", "[data-content-editable-root='true']"
    ];
    var candidates = [];
    selectors.forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (node) {
        if (textOf(node).length > 120 && candidates.indexOf(node) < 0) candidates.push(node);
      });
    });
    candidates.sort(function (a, b) { return scoreCandidate(b) - scoreCandidate(a); });
    return candidates[0] || null;
  }

  function readabilityResult() {
    if (typeof Readability !== "function") return null;
    try {
      var clone = document.cloneNode(true);
      clone.querySelectorAll("input[type='checkbox']").forEach(function (checkbox) {
        checkbox.replaceWith(clone.createTextNode(checkbox.checked ? "[x] " : "[ ] "));
      });
      clone.querySelectorAll("pre code").forEach(function (code) {
        var match = code.className.match(/(?:language-|lang-)([\w-]+)/);
        if (match) code.setAttribute("data-mdhtml-language", match[1]);
      });
      var result = new Readability(clone, { charThreshold: 180, keepClasses: false }).parse();
      if (!result || !result.content || (result.textContent || "").trim().length < 180) return null;
      result.root = rootFromHtml(result.content);
      return result;
    } catch (_) {
      return null;
    }
  }

  function extraction(scope) {
    var pageMeta = pageMetadata();
    var base = {
      title: pageMeta.title,
      byline: pageMeta.byline,
      siteName: pageMeta.siteName,
      publishedTime: pageMeta.publishedTime,
      quality: "",
      qualityLevel: "good"
    };
    if (scope === "selection") {
      base.root = selectedRoot();
      base.quality = "当前选区";
      return base;
    }
    if (scope === "picked") {
      base.root = pickedHtml ? rootFromHtml(pickedHtml) : null;
      base.quality = "手动选定";
      return base;
    }
    if (scope === "page") {
      base.root = document.body;
      base.quality = "完整网页";
      return base;
    }

    var specific = siteSpecificRoot();
    if (specific) {
      base.root = specific;
      base.quality = "已识别正文";
      return base;
    }

    var readable = readabilityResult();
    if (readable) {
      base.root = readable.root;
      base.title = readable.title || base.title;
      base.byline = readable.byline || base.byline;
      base.siteName = readable.siteName || base.siteName;
      base.publishedTime = readable.publishedTime || base.publishedTime;
      base.quality = "Readability 正文";
      return base;
    }

    base.root = heuristicMainRoot();
    base.quality = base.root === document.body ? "未识别正文，已使用页面内容" : "启发式正文";
    base.qualityLevel = "warn";
    return base;
  }

  function isPlaceholderImageSource(source) {
    if (!source) return true;
    var value = String(source).trim();
    if (!value || value === "about:blank") return true;
    var decoded = value;
    try { decoded = decodeURIComponent(value); } catch (_) {}
    var lower = decoded.toLowerCase();
    if (/^data:image\/svg\+xml/.test(lower) && /(width=['\"]?1px|height=['\"]?1px|viewbox=['\"]?0 0 1 1)/.test(lower)) return true;
    if (/^data:image\/gif;base64,r0lgodlhaqaba/i.test(value)) return true;
    return /(?:^|[\/_-])(spacer|transparent|blank|1x1)(?:[._-]|$)/i.test(value);
  }

  function srcsetCandidate(srcset) {
    if (!srcset) return "";
    var entries = srcset.split(",").map(function (entry) { return entry.trim().split(/\s+/)[0]; }).filter(Boolean);
    return entries.length ? entries[entries.length - 1] : "";
  }

  function resolveImageSource(img) {
    var lazyAttributes = ["data-src", "data-original", "data-lazy-src", "data-url", "data-backup-src", "data-actualsrc", "data-original-src", "data-echo"];
    var candidates = lazyAttributes.map(function (name) { return img.getAttribute(name); });
    candidates.push(srcsetCandidate(img.getAttribute("data-srcset")));
    candidates.push(srcsetCandidate(img.getAttribute("srcset")));
    candidates.push(img.getAttribute("src"));
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (candidate && !isPlaceholderImageSource(candidate)) return absolute(candidate);
    }
    return "";
  }

  function removePromotionalTail(root) {
    if (!(root.id === "js_content" || location.hostname === "mp.weixin.qq.com")) return false;
    var totalText = textOf(root);
    if (totalText.length < 200) return false;
    var markers = /^(?:\*+)?(?:点击下方卡片|长按识别二维码|扫码关注|推荐阅读|往期推荐)/;
    var nodes = Array.from(root.querySelectorAll("p,section,div,strong"));
    var marker = nodes.find(function (node) {
      var value = textOf(node).replace(/\s+/g, " ");
      if (!value || value.length > 100 || !markers.test(value)) return false;
      return totalText.indexOf(value) > totalText.length * 0.6;
    });
    if (!marker || !root.lastChild) return false;
    try {
      var range = document.createRange();
      range.setStartBefore(marker);
      range.setEndAfter(root.lastChild);
      range.deleteContents();
      return true;
    } catch (_) {
      return false;
    }
  }

  function prepare(root, options) {
    options = options || {};
    var clone = root.cloneNode(true);
    var remove = "script,style,noscript,template,canvas,svg,iframe,object,embed,nav,aside,form,button,[aria-hidden='true'],[hidden],.advertisement,.advert,.ads,.ad,.cookie-banner,.newsletter-signup,.social-share,.reward_area,.qr_code_pc,.rich_media_tool,.rich_media_area_extra,.wx_profile_card_inner,.js_related";
    clone.querySelectorAll(remove).forEach(function (node) { node.remove(); });
    if (options.cleanContent !== false) removePromotionalTail(clone);
    var imageStats = { total: clone.querySelectorAll("img").length, valid: 0, invalid: 0 };
    clone.querySelectorAll("img").forEach(function (img) {
      var src = resolveImageSource(img);
      if (!src) {
        imageStats.invalid++;
        img.remove();
        return;
      }
      imageStats.valid++;
      img.setAttribute("src", src);
      img.removeAttribute("srcset");
      img.removeAttribute("loading");
    });
    clone.querySelectorAll("[class*='code-snippet'],[class*='codeblock'],[data-lang]").forEach(function (node) {
      if (node.tagName === "PRE" || node.closest("pre") || node.querySelector("pre")) return;
      var pre = document.createElement("pre");
      var code = document.createElement("code");
      code.innerHTML = node.innerHTML;
      code.className = node.className || "";
      var dataLang = node.getAttribute("data-lang");
      if (dataLang) code.setAttribute("data-mdhtml-language", dataLang);
      pre.appendChild(code);
      node.replaceWith(pre);
    });
    clone.querySelectorAll("a[href]").forEach(function (link) { link.setAttribute("href", absolute(link.getAttribute("href"))); });
    if (!options.keepEmpty) {
      Array.from(clone.querySelectorAll("p,div,section")).reverse().forEach(function (node) {
        if (!textOf(node) && !node.querySelector("img,video,audio,pre,table,hr")) node.remove();
      });
    }
    clone.__mdhtmlStats = { images: imageStats, codeBlocks: clone.querySelectorAll("pre").length };
    return clone;
  }

  function codeFence(code) {
    var longest = 0;
    String(code).replace(/`+/g, function (run) { longest = Math.max(longest, run.length); return run; });
    return "`".repeat(Math.max(3, longest + 1));
  }

  function codeText(node) {
    var output = "";
    var blockTags = { DIV:1, P:1, LI:1, SECTION:1, ARTICLE:1 };
    function append(value) {
      output += String(value || "").replace(/\u00a0/g, " ").replace(/[\u200b\ufeff]/g, "");
    }
    function walk(current) {
      if (current.nodeType === Node.TEXT_NODE) { append(current.nodeValue); return; }
      if (current.nodeType !== Node.ELEMENT_NODE) return;
      if (current.tagName === "BR") { if (!output.endsWith("\n")) output += "\n"; return; }
      Array.from(current.childNodes).forEach(walk);
      if (blockTags[current.tagName] && output && !output.endsWith("\n")) output += "\n";
    }
    walk(node);
    return output.replace(/\r\n?/g, "\n").split("\n").map(function (line) { return line.replace(/[ \t]+$/g, ""); }).join("\n").replace(/^\n+|\n+$/g, "").replace(/\n{3,}/g, "\n\n");
  }

  function detectCodeLanguage(value, code) {
    var explicit = code && code.getAttribute("data-mdhtml-language");
    var match = code && code.className.match(/(?:language-|lang-)([\w-]+)/);
    if (explicit) return explicit;
    if (match) return match[1];
    if (/(?:^|\n)\s*(?:from\s+[\w.]+\s+import|import\s+[\w.]+|def\s+\w+\s*\(|class\s+\w+|print\s*\()/m.test(value)) return "python";
    if (/(?:^|\n)\s*(?:git\s+clone|pip\s+install|npm\s+(?:install|run)|cd\s+\S+|curl\s+)/m.test(value)) return "bash";
    if (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(value)) return "json";
    return "";
  }

  function inline(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeInlineText(node.nodeValue.replace(/\s+/g, " "));
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    var tag = node.tagName.toLowerCase();
    var children = Array.from(node.childNodes).map(inline).join("");
    if (tag === "br") return "  \n";
    if (tag === "strong" || tag === "b") return children.trim() ? "**" + children.trim() + "**" : "";
    if (tag === "em" || tag === "i") return children.trim() ? "*" + children.trim() + "*" : "";
    if (tag === "del" || tag === "s" || tag === "strike") return children.trim() ? "~~" + children.trim() + "~~" : "";
    if (tag === "code" && (!node.parentElement || node.parentElement.tagName !== "PRE")) {
      var value = node.textContent || "";
      var ticks = value.indexOf("`") >= 0 ? "``" : "`";
      return ticks + (value.charAt(0) === "`" || value.charAt(value.length - 1) === "`" ? " " + value + " " : value) + ticks;
    }
    if (tag === "a") {
      var href = node.getAttribute("href");
      var label = children.trim() || href;
      return href ? "[" + label + "](" + mdUrl(href) + ")" : children;
    }
    if (tag === "img") {
      var src = node.getAttribute("src");
      var alt = escapeInlineText(node.getAttribute("alt") || node.getAttribute("title") || "image");
      return src ? "![" + alt + "](" + mdUrl(src) + ")" : "";
    }
    if (tag === "sup" || tag === "sub") return children;
    return children;
  }

  function inlineChildren(node) {
    return Array.from(node.childNodes).map(inline).join("");
  }

  function tableMarkdown(table) {
    var rows = Array.from(table.querySelectorAll("tr")).map(function (row) {
      return Array.from(row.querySelectorAll(":scope > th,:scope > td")).map(function (cell) {
        return inlineChildren(cell).replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
      });
    }).filter(function (row) { return row.length; });
    if (!rows.length) return "";
    var width = Math.max.apply(null, rows.map(function (row) { return row.length; }));
    rows.forEach(function (row) { while (row.length < width) row.push(""); });
    var out = ["| " + rows[0].join(" | ") + " |", "| " + rows[0].map(function () { return "---"; }).join(" | ") + " |"];
    rows.slice(1).forEach(function (row) { out.push("| " + row.join(" | ") + " |"); });
    return "\n\n" + out.join("\n") + "\n\n";
  }

  function listMarkdown(list, depth) {
    var ordered = list.tagName === "OL";
    var start = +(list.getAttribute("start") || 1);
    var lines = [];
    Array.from(list.children).filter(function (node) { return node.tagName === "LI"; }).forEach(function (item, index) {
      var copy = item.cloneNode(true);
      copy.querySelectorAll(":scope > ul,:scope > ol").forEach(function (node) { node.remove(); });
      var checkbox = copy.querySelector("input[type='checkbox']");
      var task = "";
      if (checkbox) { task = checkbox.checked ? "[x] " : "[ ] "; checkbox.remove(); }
      var marker = ordered ? (start + index) + ". " : "- ";
      var itemText = inlineChildren(copy).replace(/\s+/g, " ").trim();
      lines.push("  ".repeat(depth) + marker + task + itemText);
      Array.from(item.children).filter(function (node) { return node.tagName === "UL" || node.tagName === "OL"; }).forEach(function (nested) {
        lines.push(listMarkdown(nested, depth + 1).replace(/^\n|\n$/g, ""));
      });
    });
    return "\n" + lines.join("\n") + "\n";
  }

  function block(node, depth) {
    depth = depth || 0;
    if (node.nodeType === Node.TEXT_NODE) return escapeInlineText(node.nodeValue.replace(/\s+/g, " "));
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    var tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return "\n\n" + "#".repeat(+tag[1]) + " " + inlineChildren(node).trim() + "\n\n";
    if (tag === "p") return "\n\n" + inlineChildren(node).trim() + "\n\n";
    if (tag === "pre") {
      var code = node.querySelector("code");
      var value = codeText(code || node);
      var language = detectCodeLanguage(value, code);
      var fence = codeFence(value);
      return "\n\n" + fence + language + "\n" + value + "\n" + fence + "\n\n";
    }
    if (tag === "blockquote") {
      var quote = blockChildren(node, depth).trim().split("\n").map(function (line) { return line ? "> " + line : ">"; }).join("\n");
      return "\n\n" + quote + "\n\n";
    }
    if (tag === "ul" || tag === "ol") return listMarkdown(node, depth);
    if (tag === "table") return tableMarkdown(node);
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "figure") {
      var clone = node.cloneNode(true);
      var caption = clone.querySelector("figcaption");
      if (caption) caption.remove();
      return "\n\n" + blockChildren(clone, depth).trim() + (caption ? "\n\n*" + inlineChildren(caption).trim() + "*" : "") + "\n\n";
    }
    if (tag === "details") {
      var summary = node.querySelector(":scope > summary");
      var copyDetails = node.cloneNode(true);
      var copySummary = copyDetails.querySelector(":scope > summary");
      if (copySummary) copySummary.remove();
      return "\n\n### " + (summary ? inlineChildren(summary).trim() : "Details") + "\n\n" + blockChildren(copyDetails, depth).trim() + "\n\n";
    }
    if (tag === "figcaption" || tag === "summary") return "";
    if (["br", "strong", "b", "em", "i", "del", "s", "strike", "code", "a", "img"].indexOf(tag) >= 0) return inline(node);
    return blockChildren(node, depth);
  }

  function blockChildren(node, depth) {
    return Array.from(node.childNodes).map(function (child) { return block(child, depth); }).join("");
  }

  function toMarkdown(root, options) {
    var prepared = prepare(root, options);
    var markdown = blockChildren(prepared, 0)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { markdown: markdown, stats: prepared.__mdhtmlStats || { images:{ total:0, valid:0, invalid:0 }, codeBlocks:0 } };
  }

  function markdownHeadings(markdown) {
    var headings = [];
    var inFence = false;
    String(markdown).split("\n").forEach(function (line) {
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return; }
      if (inFence) return;
      var match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) headings.push({ level: match[1].length, text: match[2].trim() });
    });
    return headings;
  }

  function normalizeHeadingLevels(markdown, startLevel) {
    var levels = Array.from(new Set(markdownHeadings(markdown).map(function (heading) { return heading.level; }))).sort(function (a, b) { return a - b; });
    var mapping = {};
    levels.forEach(function (level, index) { mapping[level] = Math.min(6, startLevel + index); });
    var inFence = false;
    return String(markdown).split("\n").map(function (line) {
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
      if (inFence) return line;
      var match = line.match(/^(#{1,6})\s+(.+)$/);
      return match ? "#".repeat(mapping[match[1].length] || match[1].length) + " " + match[2] : line;
    }).join("\n");
  }

  function comparableTitle(value) {
    return String(value || "").replace(/\\([*_[\]])/g, "$1").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function normalizeWithExistingTitle(markdown, title) {
    var headings = markdownHeadings(markdown);
    var remainingLevels = Array.from(new Set(headings.slice(1).map(function (heading) { return heading.level; }))).sort(function (a, b) { return a - b; });
    var mapping = {};
    remainingLevels.forEach(function (level, index) { mapping[level] = Math.min(6, 2 + index); });
    var inFence = false;
    var titleHandled = false;
    return String(markdown).split("\n").map(function (line) {
      if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
      if (inFence) return line;
      var match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) return line;
      if (!titleHandled && comparableTitle(match[2]) === comparableTitle(title)) {
        titleHandled = true;
        return "# " + match[2];
      }
      return "#".repeat(mapping[match[1].length] || 2) + " " + match[2];
    }).join("\n");
  }

  function ensureDocumentTitle(markdown, context, scope) {
    if (scope !== "main" && scope !== "page") return markdown;
    var headings = markdownHeadings(markdown);
    var alreadyHasTitle = headings.length && comparableTitle(headings[0].text) === comparableTitle(context.title);
    var normalized = alreadyHasTitle ? normalizeWithExistingTitle(markdown, context.title) : normalizeHeadingLevels(markdown, 2);
    return alreadyHasTitle ? normalized : "# " + escapeInlineText(context.title) + "\n\n" + normalized;
  }

  function yamlString(value) {
    return JSON.stringify(String(value || ""));
  }

  function metadataBlock(meta, frontmatter) {
    var now = new Date().toISOString();
    if (frontmatter) {
      var lines = ["---", "title: " + yamlString(meta.title), "source: " + yamlString(location.href), "captured_at: " + yamlString(now)];
      if (meta.byline) lines.push("author: " + yamlString(meta.byline));
      if (meta.siteName) lines.push("site: " + yamlString(meta.siteName));
      if (meta.publishedTime) lines.push("published_at: " + yamlString(meta.publishedTime));
      lines.push("---", "");
      return lines.join("\n");
    }
    return "> 来源：[" + escapeInlineText(location.hostname || location.href) + "](" + mdUrl(location.href) + ")  \n> 保存时间：" + new Date().toLocaleString() + "\n\n";
  }

  function safeFilename(raw) {
    var safe = String(raw || document.title || location.hostname || "page")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
    return safe || "page";
  }

  function articleHtml(context, request) {
    var content = prepare(context.root, { cleanContent: !request || request.cleanContent !== false }).innerHTML;
    var title = context.title || document.title || "Saved page";
    var meta = [];
    if (!request || request.metadata !== false) {
      if (context.byline) meta.push("<span>作者：" + escapeHtml(context.byline) + "</span>");
      if (context.siteName) meta.push("<span>来源：" + escapeHtml(context.siteName) + "</span>");
      if (context.publishedTime) meta.push("<span>发布：" + escapeHtml(context.publishedTime) + "</span>");
      meta.push("<a href=\"" + escapeHtml(location.href) + "\">查看原文</a>");
    }
    var header = "<header class=\"saved-header\"><h1>" + escapeHtml(title) + "</h1>" +
      (meta.length ? "<p class=\"saved-meta\">" + meta.join("") + "</p>" : "") + "</header>";
    return "<!doctype html>\n<html lang=\"" + escapeHtml(document.documentElement.lang || "en") + "\"><head><meta charset=\"utf-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><base href=\"" + escapeHtml(location.href) + "\">" +
      "<meta name=\"source\" content=\"" + escapeHtml(location.href) + "\"><title>" + escapeHtml(title) + "</title>" +
      "<style>body{margin:0;background:#fff;color:#222;font:17px/1.7 system-ui,-apple-system,sans-serif}.saved-page{max-width:780px;margin:auto;padding:48px 24px}.saved-header{margin-bottom:32px}.saved-header h1{margin-bottom:8px;line-height:1.3}.saved-meta{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0;color:#777;font-size:13px}.saved-meta a{margin-left:auto}img,video{max-width:100%;height:auto}pre{overflow:auto;padding:16px;background:#f5f5f5;border-radius:8px}code{font-family:ui-monospace,monospace}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}blockquote{border-left:3px solid #d97757;margin-left:0;padding-left:16px;color:#666}a{color:#0969da}@media(max-width:600px){.saved-page{padding:28px 18px}.saved-meta a{margin-left:0}}@media(prefers-color-scheme:dark){body{background:#111;color:#e8e8e8}a{color:#79b8ff}pre{background:#222}th,td{border-color:#444}.saved-meta{color:#aaa}}</style>" +
      "</head><body><main class=\"saved-page\">" + header + content + "</main></body></html>";
  }

  function cleanFullPage() {
    var html = document.documentElement.cloneNode(true);
    html.querySelectorAll("script,noscript,iframe,object,embed").forEach(function (node) { node.remove(); });
    html.querySelectorAll("a[href],link[href]").forEach(function (node) { node.setAttribute("href", absolute(node.getAttribute("href"))); });
    html.querySelectorAll("img").forEach(function (img) {
      var source = resolveImageSource(img);
      if (source) img.setAttribute("src", source);
      img.removeAttribute("srcset");
    });
    html.querySelectorAll("source[src],video[src],audio[src]").forEach(function (node) { node.setAttribute("src", absolute(node.getAttribute("src"))); });
    html.querySelectorAll("input,textarea,select").forEach(function (node) {
      if (node.tagName === "TEXTAREA") node.textContent = node.value;
      else if (node.tagName === "SELECT") Array.from(node.options).forEach(function (option) { option.toggleAttribute("selected", option.selected); });
      else if (node.type !== "password") node.setAttribute("value", node.value || "");
    });
    var head = html.querySelector("head");
    if (head) { var base = document.createElement("base"); base.href = location.href; head.prepend(base); }
    return "<!doctype html>\n" + html.outerHTML;
  }

  function prepareMarkdown(request) {
    var scope = request.scope || "main";
    var context = extraction(scope);
    if (!context.root || (!textOf(context.root) && !context.root.querySelector("img"))) return { ok: false, error: "所选范围没有可保存的内容。" };
    var converted = toMarkdown(context.root, { cleanContent: request.cleanContent !== false });
    var markdown = ensureDocumentTitle(converted.markdown, context, scope);
    if (!markdown) return { ok: false, error: "没有识别到可转换的正文，请尝试完整网页或手动选择。" };
    if (request.metadata) markdown = metadataBlock(context, request.frontmatter !== false) + markdown;
    var images = converted.stats.images || { total:0, valid:0, invalid:0 };
    return {
      ok: true,
      markdown: markdown + "\n",
      filename: safeFilename(context.title),
      title: context.title,
      quality: context.quality,
      qualityLevel: images.invalid ? "warn" : context.qualityLevel,
      characters: markdown.length,
      words: markdown.trim() ? markdown.trim().split(/\s+/).length : 0,
      imageTotal: images.total,
      imageValid: images.valid,
      imageInvalid: images.invalid,
      codeBlocks: converted.stats.codeBlocks || 0
    };
  }

  function exportPage(request) {
    if (request.format === "markdown") {
      var result = prepareMarkdown(request);
      if (!result.ok) return result;
      return { ok: true, content: request.content || result.markdown, filename: safeFilename(request.filename || result.filename) + ".md", mime: "text/markdown" };
    }
    var context = extraction(request.scope || "main");
    if (!context.root) return { ok: false, error: "所选范围没有可保存的内容。" };
    return {
      ok: true,
      content: request.scope === "page" ? cleanFullPage() : articleHtml(context, request),
      filename: safeFilename(request.filename || context.title) + ".html",
      mime: "text/html"
    };
  }

  function showPickerNotice(message) {
    var notice = document.createElement("div");
    notice.textContent = message;
    Object.assign(notice.style, { position:"fixed", top:"18px", left:"50%", transform:"translateX(-50%)", zIndex:"2147483647", background:"#111", color:"#fff", padding:"9px 14px", borderRadius:"8px", font:"13px system-ui", boxShadow:"0 6px 24px #0005", pointerEvents:"none" });
    document.documentElement.appendChild(notice);
    setTimeout(function () { notice.remove(); }, 2200);
  }

  function startPicker() {
    if (pickerCleanup) pickerCleanup();
    var overlay = document.createElement("div");
    Object.assign(overlay.style, { position:"fixed", zIndex:"2147483646", pointerEvents:"none", border:"2px solid #d97757", background:"rgba(217,119,87,.10)", borderRadius:"4px", transition:"all 50ms" });
    document.documentElement.appendChild(overlay);
    var target = null;
    function move(event) {
      var candidate = document.elementFromPoint(event.clientX, event.clientY);
      if (!candidate || candidate === overlay || candidate.closest("[data-mdhtml-picker]") || candidate === document.documentElement) return;
      target = candidate;
      var rect = candidate.getBoundingClientRect();
      Object.assign(overlay.style, { left:rect.left + "px", top:rect.top + "px", width:rect.width + "px", height:rect.height + "px" });
    }
    function cleanup() {
      document.removeEventListener("mousemove", move, true);
      document.removeEventListener("click", choose, true);
      document.removeEventListener("keydown", keydown, true);
      overlay.remove();
      pickerCleanup = null;
    }
    function choose(event) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      if (target) {
        pickedHtml = target.outerHTML;
        cleanup();
        showPickerNotice("已选定内容区域，再次打开扩展即可预览");
      }
    }
    function keydown(event) { if (event.key === "Escape") { cleanup(); showPickerNotice("已取消选择"); } }
    pickerCleanup = cleanup;
    document.addEventListener("mousemove", move, true);
    document.addEventListener("click", choose, true);
    document.addEventListener("keydown", keydown, true);
    showPickerNotice("移动鼠标选择正文区域 · 点击确认 · Esc 取消");
  }

  api.runtime.onMessage.addListener(function (request, _sender, sendResponse) {
    if (request.type === "MDHTML_INSPECT") {
      sendResponse({ hasSelection: !!selectedRoot(), hasPicked: !!pickedHtml });
      return;
    }
    if (request.type === "MDHTML_PREPARE") {
      sendResponse(prepareMarkdown(request));
      return;
    }
    if (request.type === "MDHTML_EXPORT") {
      sendResponse(exportPage(request));
      return;
    }
    if (request.type === "MDHTML_COPY") {
      var copyResult = prepareMarkdown(request);
      if (!copyResult.ok) { sendResponse(copyResult); return; }
      navigator.clipboard.writeText(copyResult.markdown).then(function () { sendResponse({ ok: true }); }, function () { sendResponse({ ok: false, error: "复制失败，请打开扩展弹窗后重试。" }); });
      return true;
    }
    if (request.type === "MDHTML_START_PICKER") {
      startPicker();
      sendResponse({ ok: true });
    }
  });
})();
