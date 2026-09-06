"use strict";

/**
 * Appends a content hash to every local CSS/JS reference so a deploy can never
 * pair fresh HTML with a stale cached stylesheet.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const HTML_FILES = [
  "index.html",
  "404.html",
  "v/index.html",
  "terms/index.html",
  "privacy/index.html",
  "feedback/index.html",
  "html-to-markdown/index.html",
  "markdown-to-pdf/index.html",
  "html-to-pdf/index.html",
  "markdown-cheatsheet/index.html"
];

const ASSET_REF = /(href|src)="((?:\.{1,2}\/|\/)?assets\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g;

const versions = new Map();

function resolveAsset(htmlFile, ref) {
  return ref.startsWith("/")
    ? path.join(root, ref.slice(1))
    : path.resolve(root, path.dirname(htmlFile), ref);
}

function assetVersion(htmlFile, ref) {
  const target = resolveAsset(htmlFile, ref);
  if (!versions.has(target)) {
    if (!fs.existsSync(target)) {
      throw new Error(`Missing asset ${ref} referenced by ${htmlFile}`);
    }
    const hash = crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
    versions.set(target, hash.slice(0, 10));
  }
  return versions.get(target);
}

function stampSource(htmlFile, source) {
  let references = 0;
  const stamped = source.replace(ASSET_REF, (match, attr, ref) => {
    references += 1;
    return `${attr}="${ref}?v=${assetVersion(htmlFile, ref)}"`;
  });
  return { stamped, references };
}

function stampFile(htmlFile) {
  const filePath = path.join(root, htmlFile);
  const source = fs.readFileSync(filePath, "utf8");
  const { stamped, references } = stampSource(htmlFile, source);
  if (stamped !== source) fs.writeFileSync(filePath, stamped);
  return { references, changed: stamped !== source };
}

function stampAll() {
  return HTML_FILES.map((htmlFile) => ({ htmlFile, ...stampFile(htmlFile) }));
}

if (require.main === module) {
  const results = stampAll();
  const total = results.reduce((sum, result) => sum + result.references, 0);
  const changed = results.filter((result) => result.changed).length;
  console.log(`Stamped ${total} asset references across ${results.length} pages (${changed} updated)`);
}

module.exports = { ASSET_REF, HTML_FILES, assetVersion, stampAll, stampSource };
