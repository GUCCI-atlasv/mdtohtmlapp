"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "site.css"), "utf8");

test("the converter preview is an iframe holding the exported document", () => {
  assert.match(home, /<iframe id="previewFrame"[^>]*sandbox="allow-same-origin"><\/iframe>/);
  assert.doesNotMatch(home, /<div id="preview">/, "the old non-themed preview div is still there");
  assert.match(app, /previewFrame\.srcdoc\s*=\s*fullDoc\(\)/);
  assert.doesNotMatch(app, /\.innerHTML\s*=\s*r\.html/, "preview must not bypass the theme with a raw DOM write");
});

test("changing the theme re-renders the preview instead of only toasting", () => {
  const handler = app.match(/themeSel\.addEventListener\('change',[\s\S]*?\}\);/);
  assert.ok(handler, "theme change handler missing");
  assert.match(handler[0], /renderPreview\(\)/, "theme change must re-render the preview");
  assert.doesNotMatch(app, /Theme applies to downloaded page/, "stale copy claiming the theme is export-only");
});

test("toggling light/dark re-renders the preview because the mode is baked in", () => {
  const handler = app.match(/\$\('modeToggle'\)\.onclick[\s\S]*?\n  \};/);
  assert.ok(handler, "mode toggle handler missing");
  assert.match(handler[0], /renderPreview\(\)/);
});

test("the preview theme comes only from the iframe, never from site.css", () => {
  assert.match(css, /#previewFrame\{[^}]*border:none/);
  assert.doesNotMatch(css, /#preview\s+(h1|h2|h3|p|code|pre|table|blockquote)/, "dead in-page preview typography is back");
});

test("typing debounces the preview but keeps the HTML tab instant", () => {
  assert.match(app, /previewTimer\s*=\s*setTimeout\(renderPreview,\s*\d+\)/);
  const render = app.match(/function render\(\)\s*\{[\s\S]*?\n  \}/);
  assert.ok(render);
  assert.match(render[0], /renderSidePanels\(\)/);
  assert.doesNotMatch(render[0], /srcdoc/, "render() should not write srcdoc synchronously");
});
