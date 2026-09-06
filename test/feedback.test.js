"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const feedback = fs.readFileSync(path.join(root, "feedback", "index.html"), "utf8");
const feedbackJs = fs.readFileSync(path.join(root, "assets", "feedback.js"), "utf8");

test("feedback page exposes a complete, accessible support form", () => {
  assert.match(feedback, /<link rel="canonical" href="https:\/\/mdtohtml\.app\/feedback\/">/);
  assert.match(feedback, /id="feedbackForm"/);
  assert.match(feedback, /id="product"/);
  assert.match(feedback, /id="category"/);
  assert.match(feedback, /id="email" type="email"/);
  assert.match(feedback, /id="message" required minlength="5" maxlength="3000"/);
  assert.match(feedback, /role="status" aria-live="polite"/);
  assert.doesNotMatch(feedback, /beacon\.js|ccc-monitor/, "feedback form must not load analytics");
});

test("feedback is addressed to the support mailbox with a copy fallback", () => {
  assert.match(feedback, /mailto:support@mdtohtml\.app/);
  assert.match(feedbackJs, /SUPPORT_EMAIL = "support@mdtohtml\.app"/);
  assert.match(feedbackJs, /navigator\.clipboard\.writeText/);
  assert.match(feedbackJs, /location\.href = "mailto:"/);
});

test("public pages expose feedback and the support email", () => {
  for (const htmlFile of [
    "index.html",
    "404.html",
    "html-to-markdown/index.html",
    "html-to-pdf/index.html",
    "markdown-to-pdf/index.html",
    "markdown-cheatsheet/index.html",
    "privacy/index.html",
    "terms/index.html"
  ]) {
    const source = fs.readFileSync(path.join(root, htmlFile), "utf8");
    assert.match(source, /support@mdtohtml\.app/, `${htmlFile} is missing the support email`);
    assert.match(source, /href="(?:\.\.\/|\/|)feedback\/"/, `${htmlFile} is missing the feedback link`);
  }
});

test("feedback route is discoverable and canonicalized", () => {
  const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
  const middleware = fs.readFileSync(path.join(root, "functions", "_middleware.js"), "utf8");
  assert.match(sitemap, /https:\/\/mdtohtml\.app\/feedback\//);
  assert.match(headers, /\/feedback\/\s+Link: <https:\/\/mdtohtml\.app\/feedback\/>; rel="canonical"/);
  assert.match(middleware, /"\/feedback\/"/);
});
