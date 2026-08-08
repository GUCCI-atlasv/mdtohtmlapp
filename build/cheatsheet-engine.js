"use strict";

const { marked } = require("marked");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

const window = new JSDOM("<!doctype html><body></body>").window;
const DOMPurify = createDOMPurify(window);

function slugify(text, used) {
  let slug = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w一-龥\- ]+/g, "")
    .replace(/\s+/g, "-") || "section";
  const base = slug;
  let suffix = 2;
  while (used[slug]) slug = `${base}-${suffix++}`;
  used[slug] = true;
  return slug;
}

function renderMarkdown(markdown, options = {}) {
  marked.setOptions({
    gfm: options.gfm !== false,
    breaks: options.breaks === true
  });
  const raw = marked.parse(markdown || "");
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ["target", "rel"] });
  const template = window.document.createElement("template");
  template.innerHTML = clean;
  const used = {};
  template.content.querySelectorAll("h1,h2,h3").forEach((heading) => {
    heading.id = slugify(heading.textContent, used);
  });
  const container = window.document.createElement("div");
  container.appendChild(template.content.cloneNode(true));
  return container.innerHTML;
}

const compatibilityProbes = {
  core: {
    markdown: "# H\n\n**bold**\n\n- item\n\n[link](https://example.com)\n\n![alt](x.png)\n\n`code`\n\n> quote",
    detects: (html) => /<h1/.test(html) && /<strong>/.test(html) && /<ul>/.test(html) && /<a href/.test(html) && /<img\b/.test(html) && /<code>/.test(html) && /<blockquote>/.test(html)
  },
  tables: { markdown: "| a |\n|---|\n| b |", detects: (html) => /<table>/.test(html) },
  tasks: { markdown: "- [x] done", detects: (html) => /type="checkbox"/.test(html) },
  strike: { markdown: "~~gone~~", detects: (html) => /<del>/.test(html) },
  url: { markdown: "https://example.com", detects: (html) => /<a href="https:\/\/example\.com"/.test(html) },
  footnotes: { markdown: "Note[^1]\n\n[^1]: Footnote", detects: (html) => /role="doc-noteref"|class="footnote/i.test(html) },
  emoji: { markdown: ":smile:", detects: (html) => !/:smile:/.test(html) },
  breaks: { markdown: "one\ntwo", detects: (html) => /<br\s*\/?>/.test(html) }
};

function measuredCompatibility(id) {
  const probe = compatibilityProbes[id];
  if (!probe) throw new Error(`Missing compatibility probe: ${id}`);
  return {
    commonmark: probe.detects(renderMarkdown(probe.markdown, { gfm: false, breaks: false })),
    gfm: probe.detects(renderMarkdown(probe.markdown, { gfm: true, breaks: false })),
    site: probe.detects(renderMarkdown(probe.markdown, { gfm: true, breaks: false }))
  };
}

module.exports = {
  compatibilityProbes,
  measuredCompatibility,
  renderMarkdown
};
