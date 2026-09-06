"use strict";

/**
 * Guards the canonicalisation contract that Search Console reports on:
 * every non-canonical host/path variant must collapse to the canonical URL
 * in exactly ONE 301, and canonical URLs must never redirect.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadMiddleware() {
  const src = fs
    .readFileSync(path.join(root, "functions/_middleware.js"), "utf8")
    .replace(/export\s+async\s+function/, "async function");
  const sandbox = { URL, Response, Headers, module: { exports: {} } };
  vm.createContext(sandbox);
  vm.runInContext(`${src}\nmodule.exports = { onRequest };`, sandbox);
  return sandbox.module.exports.onRequest;
}

const onRequest = loadMiddleware();
const served = async () => new Response("ok", { status: 200, headers: {} });

async function visit(url) {
  return onRequest({ request: { url }, next: served });
}

/* Reported by Search Console as "Page with redirect" — all six must 301 once. */
const REDIRECTS = [
  ["https://mdtohtml.app/terms.html", "https://mdtohtml.app/terms/"],
  ["http://mdtohtml.app/", "https://mdtohtml.app/"],
  ["https://www.mdtohtml.app/", "https://mdtohtml.app/"],
  ["https://www.mdtohtml.app/terms", "https://mdtohtml.app/terms/"],
  ["https://www.mdtohtml.app/terms.html", "https://mdtohtml.app/terms/"],
  ["http://www.mdtohtml.app/", "https://mdtohtml.app/"],
  ["https://mdtohtml.app/privacy.html", "https://mdtohtml.app/privacy/"],
  ["https://mdtohtml.app/index.html", "https://mdtohtml.app/"],
  ["https://mdtohtml.app/html-to-pdf/index.html", "https://mdtohtml.app/html-to-pdf/"],
  ["https://mdtohtml.app/cheatsheet", "https://mdtohtml.app/markdown-cheatsheet/"],
  ["https://mdtohtml.app/markdown-syntax", "https://mdtohtml.app/markdown-cheatsheet/"],
];

test("every non-canonical variant redirects to its canonical URL", async () => {
  for (const [from, to] of REDIRECTS) {
    const res = await visit(from);
    assert.equal(res.status, 301, `${from} should 301`);
    assert.equal(res.headers.get("Location"), to, `${from} landed on the wrong target`);
  }
});

test("redirects never chain — the target itself is already canonical", async () => {
  for (const [from, to] of REDIRECTS) {
    const res = await visit(to);
    assert.equal(res.status, 200, `${from} redirects to ${to}, which itself redirects (chain)`);
  }
});

test("sitemap URLs are all canonical and serve directly", async () => {
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0, "sitemap has no <loc> entries");
  for (const loc of locs) {
    const res = await visit(loc);
    assert.equal(res.status, 200, `sitemap lists ${loc}, which redirects — sitemaps must list final URLs only`);
  }
});

test("sitemap never lists a www, http or .html URL", () => {
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    assert.ok(loc.startsWith("https://mdtohtml.app/"), `non-canonical host in sitemap: ${loc}`);
    assert.ok(!loc.endsWith(".html"), `legacy .html URL in sitemap: ${loc}`);
  }
});

test("no page links internally to a redirecting URL", () => {
  const pages = fs
    .readdirSync(root, { recursive: true })
    .filter((p) => typeof p === "string" && p.endsWith(".html"))
    .filter((p) => !p.startsWith("node_modules") && !p.startsWith("extension") && !p.startsWith("tests"));
  const offenders = [];
  for (const page of pages) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      if (/^https?:\/\/www\.mdtohtml\.app/.test(href)) offenders.push(`${page} → ${href}`);
      if (/^http:\/\/mdtohtml\.app/.test(href)) offenders.push(`${page} → ${href}`);
      if (/^(https:\/\/mdtohtml\.app)?\/(terms|privacy)\.html/.test(href)) offenders.push(`${page} → ${href}`);
    }
  }
  assert.deepEqual(offenders, [], `internal links point at redirecting URLs:\n${offenders.join("\n")}`);
});
