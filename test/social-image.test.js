"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const CARD = "https://mdtohtml.app/assets/og-card.jpg";
const CARD_FILE = path.join(root, "assets", "og-card.jpg");

const SHARED_PAGES = [
  "index.html",
  "html-to-markdown/index.html",
  "markdown-to-pdf/index.html",
  "html-to-pdf/index.html",
  "markdown-cheatsheet/index.html"
];

const PDF_PAGE = "pdf-to-markdown/index.html";
const PDF_CARD = "https://mdtohtml.app/assets/og-pdf-to-markdown.png";
const PDF_CARD_FILE = path.join(root, "assets", "og-pdf-to-markdown.png");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("the social card exists at 1200x630 and stays a reasonable size", () => {
  assert.ok(fs.existsSync(CARD_FILE), "assets/og-card.jpg is missing");
  const bytes = fs.readFileSync(CARD_FILE);
  assert.ok(bytes.length < 300 * 1024, `og-card.jpg is ${bytes.length} bytes`);

  // Read the dimensions straight out of the JPEG SOF marker.
  let offset = 2;
  let dimensions = null;
  while (offset < bytes.length - 9) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      dimensions = { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      break;
    }
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  assert.deepEqual(dimensions, { width: 1200, height: 630 });
});

test("every shared page advertises the social card with matching dimensions", () => {
  for (const page of SHARED_PAGES) {
    const source = read(page);
    assert.ok(source.includes(`<meta property="og:image" content="${CARD}">`), `og:image missing in ${page}`);
    assert.ok(source.includes('<meta property="og:image:width" content="1200">'), `og:image:width missing in ${page}`);
    assert.ok(source.includes('<meta property="og:image:height" content="630">'), `og:image:height missing in ${page}`);
    assert.ok(source.includes(`<meta name="twitter:image" content="${CARD}">`), `twitter:image missing in ${page}`);
    assert.ok(source.includes('name="twitter:card" content="summary_large_image"'), `twitter:card must be summary_large_image in ${page}`);
    assert.match(source, /<meta property="og:image:alt" content="[^"]{20,}">/, `og:image:alt missing or too short in ${page}`);
  }
});

test("PDF to Markdown uses its own social card PNG", () => {
  assert.ok(fs.existsSync(PDF_CARD_FILE), "assets/og-pdf-to-markdown.png is missing");
  const bytes = fs.readFileSync(PDF_CARD_FILE);
  assert.ok(bytes.length < 300 * 1024, `og-pdf-to-markdown.png is ${bytes.length} bytes`);
  // PNG IHDR width/height at bytes 16..23
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 630);

  const source = read(PDF_PAGE);
  assert.ok(source.includes(`<meta property="og:image" content="${PDF_CARD}">`), "og:image missing on PDF page");
  assert.ok(source.includes('<meta property="og:image:width" content="1200">'), "og:image:width missing on PDF page");
  assert.ok(source.includes('<meta property="og:image:height" content="630">'), "og:image:height missing on PDF page");
  assert.ok(source.includes('<meta property="og:image:type" content="image/png">'), "og:image:type should be image/png on PDF page");
  assert.ok(source.includes(`<meta name="twitter:image" content="${PDF_CARD}">`), "twitter:image missing on PDF page");
  assert.ok(source.includes('name="twitter:card" content="summary_large_image"'), "twitter:card must be summary_large_image on PDF page");
  assert.match(source, /<meta property="og:image:alt" content="[^"]{20,}">/, "og:image:alt missing or too short on PDF page");
  assert.ok(!source.includes("tabby kitten"), "PDF page should not keep kitten OG alt copy");
  assert.ok(source.includes('src="../assets/pdf-to-markdown-hero.png"'), "hero image missing on PDF page");
  assert.ok(source.includes('src="../assets/pdf-to-markdown-demo.png"'), "demo image missing on PDF page");
  assert.ok(!/<video\b/i.test(source), "PDF page must not embed video");
});

test("the cheat sheet card comes from the content source, not hardcoded markup", () => {
  const content = JSON.parse(read("content/cheatsheet.json"));
  assert.equal(content.meta.socialImage, CARD);
  assert.ok(content.meta.socialImageAlt.length > 20);
  const generator = read("build/gen-cheatsheet.js");
  assert.match(generator, /content\.meta\.socialImage/);
  assert.ok(!generator.includes(CARD), "generator should not hardcode the card URL");
});
