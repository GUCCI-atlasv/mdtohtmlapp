"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { ASSET_REF, HTML_FILES, stampSource } = require("../build/stamp-assets");

const root = path.resolve(__dirname, "..");

test("every local CSS/JS reference carries its current content hash", () => {
  for (const htmlFile of HTML_FILES) {
    const source = fs.readFileSync(path.join(root, htmlFile), "utf8");
    const { stamped, references } = stampSource(htmlFile, source);
    assert.ok(references > 0, `no local asset references found in ${htmlFile}`);
    assert.equal(stamped, source, `stale or missing ?v= hash in ${htmlFile} — run npm run build`);
  }
});

test("no page references an unversioned stylesheet or script", () => {
  for (const htmlFile of HTML_FILES) {
    const source = fs.readFileSync(path.join(root, htmlFile), "utf8");
    for (const match of source.matchAll(ASSET_REF)) {
      assert.match(match[0], /\?v=[0-9a-f]{10}"$/, `unversioned asset in ${htmlFile}: ${match[0]}`);
    }
  }
});

test("versioned assets are served with a long immutable cache", () => {
  const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
  for (const pattern of ["/assets/*.css", "/assets/*.js"]) {
    assert.ok(headers.includes(pattern), `missing cache rule for ${pattern}`);
  }
  assert.match(headers, /max-age=31536000, immutable/);
  assert.match(headers, /rel="canonical"/);
});

test("the removed free-tier section leaves no dead markup, styles or anchors", () => {
  const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "site.css"), "utf8");

  assert.doesNotMatch(home, /Free\. All of it\. Forever\./);
  assert.doesNotMatch(home, /class="pricing"|free-grid|free-item/);

  for (const selector of [".free-grid", ".free-item", ".pricing", ".plans", ".plan{"]) {
    assert.ok(!css.includes(selector), `dead CSS left behind: ${selector}`);
  }

  for (const htmlFile of HTML_FILES) {
    const source = fs.readFileSync(path.join(root, htmlFile), "utf8");
    assert.doesNotMatch(source, /href="[^"]*#free"/, `dead #free anchor in ${htmlFile}`);
  }
});
