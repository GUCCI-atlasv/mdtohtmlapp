"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const createDOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const { marked } = require("marked");
const { measuredCompatibility, renderMarkdown } = require("../build/cheatsheet-engine");

const root = path.resolve(__dirname, "..");
const content = JSON.parse(fs.readFileSync(path.join(root, "content", "cheatsheet.json"), "utf8"));
const outputPath = path.join(root, "markdown-cheatsheet", "index.html");

function loadPage() {
  const source = fs.readFileSync(outputPath, "utf8");
  return { source, document: new JSDOM(source).window.document };
}

test("content source stores no handwritten HTML output", () => {
  function visit(value, keyPath = []) {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, keyPath.concat(index)));
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.notEqual(key.toLowerCase(), "htmloutput", `forbidden key at ${keyPath.concat(key).join(".")}`);
      assert.notEqual(key.toLowerCase(), "renderedhtml", `forbidden key at ${keyPath.concat(key).join(".")}`);
      visit(child, keyPath.concat(key));
    }
  }
  visit(content);
});

test("page has all quick-reference rows and element sections", () => {
  const { document } = loadPage();
  assert.equal(document.querySelectorAll(".cheat-table tbody tr").length, 17);
  assert.equal(document.querySelectorAll(".element-card").length, 14);
  assert.equal(document.querySelectorAll(".trouble-card").length, 14);
  assert.equal(document.querySelectorAll(".element-card .try-btn").length, 14);
});

test("every displayed exact HTML and static preview matches the engine", () => {
  const { document } = loadPage();
  for (const element of content.elements) {
    const expected = renderMarkdown(element.markdown);
    const card = document.querySelector(`[data-example-id="${element.id}"]`);
    assert.ok(card, `missing element card: ${element.id}`);
    assert.equal(card.querySelector("[data-exact-for]").textContent, expected, `exact output drift: ${element.id}`);
    assert.equal(card.querySelector(".static-preview").innerHTML, expected, `preview drift: ${element.id}`);
  }
  assert.equal(document.getElementById("playgroundHtml").textContent, renderMarkdown(content.playgroundDefault));
  assert.equal(document.getElementById("playgroundPreview").innerHTML, renderMarkdown(content.playgroundDefault));
});

test("compatibility table values come from executable probes", () => {
  const { document } = loadPage();
  const expectedCommonMark = {
    core: true,
    tables: false,
    tasks: false,
    strike: false,
    url: false,
    footnotes: false,
    emoji: false,
    breaks: false
  };
  for (const row of content.compatibility) {
    const measured = measuredCompatibility(row.id);
    const tableRow = document.querySelector(`[data-compat-id="${row.id}"]`);
    assert.ok(tableRow, `missing compatibility row: ${row.id}`);
    assert.equal(measured.commonmark, expectedCommonMark[row.id], `CommonMark probe changed: ${row.id}`);
    assert.equal(tableRow.dataset.commonmark, String(measured.commonmark));
    assert.equal(tableRow.dataset.gfmEngine, String(measured.gfm));
    assert.equal(tableRow.dataset.site, String(measured.site));
  }
});

test("SEO metadata and structured data follow the plan", () => {
  const { source, document } = loadPage();
  assert.equal(document.title, content.meta.title);
  assert.equal(document.querySelector("h1").textContent, content.meta.h1);
  assert.equal(document.querySelector('meta[name="description"]').content, content.meta.description);
  assert.equal(document.querySelector('link[rel="canonical"]').href, content.meta.canonical);
  const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((node) => JSON.parse(node.textContent));
  const schemaText = JSON.stringify(schemas);
  assert.match(schemaText, /BreadcrumbList/);
  assert.match(schemaText, /TechArticle/);
  assert.match(schemaText, /2026-08-08/);
  assert.doesNotMatch(schemaText, /FAQPage|HowTo/);
  assert.doesNotMatch(source, /"@type"\s*:\s*"(FAQPage|HowTo)"/);
});

test("self-hosted image is stable and explicitly sized", () => {
  const { document } = loadPage();
  const image = document.querySelector('#images .static-preview img[src="/assets/demo/landscape.jpg"]');
  assert.ok(image);
  assert.equal(image.getAttribute("width"), "600");
  assert.equal(image.getAttribute("height"), "400");
  assert.equal(image.getAttribute("loading"), "lazy");
  assert.ok(image.alt.length > 20, "demo image needs descriptive alt text");
  assert.doesNotMatch(image.alt, /sunset|hills/i, "alt text must describe the current image");

  const source = document.querySelector('#images .static-preview picture source[type="image/webp"]');
  assert.ok(source, "WebP source missing");
  assert.equal(source.getAttribute("srcset"), "/assets/demo/landscape.webp");

  assert.equal(document.querySelectorAll("#images .broken-demo").length, 0, "intentional broken-image demo should not appear in preview");
  assert.doesNotMatch(fs.readFileSync(outputPath, "utf8"), /missing-landscape\.svg/);

  for (const file of ["landscape.jpg", "landscape.webp"]) {
    const filePath = path.join(root, "assets", "demo", file);
    assert.ok(fs.existsSync(filePath), `missing ${file}`);
    assert.ok(fs.statSync(filePath).size < 60 * 1024, `${file} is ${fs.statSync(filePath).size} bytes`);
  }
  assert.ok(!fs.existsSync(path.join(root, "assets", "demo", "landscape.svg")), "stale placeholder SVG still present");
});

test("static document stays readable and first-party page assets stay under 150KB", () => {
  const { source, document } = loadPage();
  document.querySelectorAll("script").forEach((script) => script.remove());
  assert.equal(document.querySelectorAll(".element-card").length, 14);
  assert.equal(document.querySelectorAll(".exact-output").length, 14);
  assert.equal(document.querySelectorAll(".trouble-card").length, 14);
  assert.ok(document.body.textContent.includes("Frequently asked questions"));

  const firstPartyBytes = [
    outputPath,
    path.join(root, "assets", "cheatsheet.css"),
    path.join(root, "assets", "cheatsheet.js")
  ].reduce((total, file) => total + fs.statSync(file).size, 0);
  assert.ok(Buffer.byteLength(source) < 150 * 1024, `HTML is ${Buffer.byteLength(source)} bytes`);
  assert.ok(firstPartyBytes < 150 * 1024, `page HTML/CSS/JS total is ${firstPartyBytes} bytes`);
});

test("browser playground uses the shared MDH renderMarkdown API", () => {
  const renderSource = fs.readFileSync(path.join(root, "assets", "render.js"), "utf8");
  const pageSource = fs.readFileSync(path.join(root, "assets", "cheatsheet.js"), "utf8");
  assert.match(renderSource, /global\.MDH\s*=/);
  assert.match(renderSource, /renderMarkdown:\s*renderMarkdown/);
  assert.match(pageSource, /MDH\.renderMarkdown\(input\.value\)/);

  const runtime = new JSDOM("<!doctype html><body></body>", { runScripts: "outside-only" });
  runtime.window.marked = marked;
  runtime.window.DOMPurify = createDOMPurify(runtime.window);
  runtime.window.eval(renderSource);
  for (const element of content.elements) {
    assert.equal(runtime.window.MDH.renderMarkdown(element.markdown).html, renderMarkdown(element.markdown), `browser/build engine drift: ${element.id}`);
  }
});

test("sitemap, redirects, middleware, and required inbound links are wired", () => {
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const redirects = fs.readFileSync(path.join(root, "_redirects"), "utf8");
  const middleware = fs.readFileSync(path.join(root, "functions", "_middleware.js"), "utf8");
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const htmlToMarkdown = fs.readFileSync(path.join(root, "html-to-markdown", "index.html"), "utf8");
  const markdownToPdf = fs.readFileSync(path.join(root, "markdown-to-pdf", "index.html"), "utf8");

  assert.match(sitemap, /https:\/\/mdtohtml\.app\/markdown-cheatsheet\//);
  assert.match(sitemap, /https:\/\/mdtohtml\.app\/html-to-pdf\//);
  for (const alias of ["/markdown-cheat-sheet", "/cheatsheet", "/markdown-syntax"]) {
    assert.ok(redirects.includes(`${alias}`), `missing static redirect: ${alias}`);
    assert.ok(middleware.includes(`"${alias}"`), `missing middleware redirect: ${alias}`);
  }
  assert.match(middleware, /yandex_4938b0a4a7c6d0f5\.html/);
  assert.equal((home.match(/<div class="syntax-strip-grid">[\s\S]*?<\/div>/) || [""])[0].match(/<span>/g).length, 8);
  assert.ok((htmlToMarkdown.match(/markdown-cheatsheet\//g) || []).length >= 2);
  assert.ok((markdownToPdf.match(/markdown-cheatsheet\//g) || []).length >= 2);
  assert.ok(home.includes('href="html-to-pdf/"'), "home nav/tools must link to HTML → PDF");
  assert.doesNotMatch(fs.readFileSync(path.join(root, "assets", "site.css"), "utf8"), /\.nav-text-link\{display:none/, "tool nav links must stay visible");
});
