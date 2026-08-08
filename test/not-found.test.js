"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "404.html"), "utf8");

test("the 404 page exists and is kept out of the index", () => {
  assert.match(source, /<meta name="robots" content="noindex, follow">/);
  assert.match(source, /<title>Page not found \| mdtohtml<\/title>/);
  assert.doesNotMatch(source, /<link rel="canonical"/, "a 404 page must not claim a canonical URL");
});

test("the 404 page links to every tool and the cheat sheet", () => {
  for (const target of ["/", "/html-to-markdown/", "/markdown-to-pdf/", "/html-to-pdf/", "/markdown-cheatsheet/"]) {
    assert.ok(source.includes(`href="${target}"`), `missing link to ${target}`);
  }
});

test("every 404 page reference is root-relative so it survives at any depth", () => {
  // Pages serves this document for /a, /a/b/c … so "assets/site.css" would resolve wrongly.
  for (const match of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (/^(https?:|mailto:|#)/.test(url)) continue;
    assert.ok(url.startsWith("/"), `relative reference would break at depth: ${url}`);
  }
});

test("the 404 page adds no CSS of its own", () => {
  const stylesheets = [...source.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  const local = stylesheets.filter((href) => !href.startsWith("http"));
  assert.deepEqual(local.map((href) => href.split("?")[0]), ["/assets/site.css"]);
});
