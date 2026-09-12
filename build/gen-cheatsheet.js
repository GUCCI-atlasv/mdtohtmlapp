"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { measuredCompatibility, renderMarkdown } = require("./cheatsheet-engine");

const root = path.resolve(__dirname, "..");
const contentPath = path.join(root, "content", "cheatsheet.json");
const outputPath = path.join(root, "markdown-cheatsheet", "index.html");
const content = JSON.parse(fs.readFileSync(contentPath, "utf8"));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function syntaxMarkup(markdown) {
  return escapeHtml(markdown).replace(
    /(&lt;\/?|\/?&gt;|```+|~~~+|\\[\\*_#`[\]()|~\\]|[*_~#>`[\]()|\\-]{1,3})/g,
    '<span class="syntax-mark">$1</span>'
  );
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function copyButton(label, target, className = "btn btn-ghost copy-btn") {
  return `<button class="${className}" type="button" data-copy-target="${target}">${escapeHtml(label)}</button>`;
}

const quickRows = content.quickReference.map((row, index) => `
          <tr>
            <th scope="row"><a href="#${escapeHtml(row.target)}">${escapeHtml(row.element)}</a></th>
            <td><code class="syntax">${escapeHtml(row.markdown)}</code></td>
            <td><code>${escapeHtml(row.html)}</code></td>
            <td><span class="spec-badge">${escapeHtml(row.spec)}</span></td>
            <td>${copyButton("Copy", `quick-${index}`)}<span id="quick-${index}" class="copy-source">${escapeHtml(row.markdown)}</span></td>
          </tr>`).join("");

const elementSections = content.elements.map((element, index) => {
  const rendered = renderMarkdown(element.markdown);
  const gotchas = element.gotchas.map((gotcha) => `<li>${escapeHtml(gotcha)}</li>`).join("");
  return `
      <article class="element-card" id="${escapeHtml(element.id)}" data-example-id="${escapeHtml(element.id)}">
        <header class="element-head">
          <div><span class="section-number">${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(element.name)}</h3></div>
          <span class="spec-badge">${escapeHtml(element.spec)}</span>
        </header>
        <p>${escapeHtml(element.summary)}</p>
        <div class="example-grid">
          <section>
            <div class="sample-head"><h4>Syntax</h4>${copyButton("Copy", `syntax-${element.id}`)}</div>
            <pre class="syntax-block"><code id="syntax-${escapeHtml(element.id)}">${syntaxMarkup(element.markdown)}</code></pre>
          </section>
          <section>
            <div class="sample-head"><h4>Static preview</h4>${copyButton("Copy text", `preview-${element.id}`)}</div>
            <div class="static-preview" id="preview-${escapeHtml(element.id)}">${rendered}</div>
          </section>
          <section class="exact-panel">
            <div class="sample-head"><h4>Exact HTML</h4>${copyButton("Copy", `html-${element.id}`)}</div>
            <pre class="exact-output"><code id="html-${escapeHtml(element.id)}" data-exact-for="${escapeHtml(element.id)}">${escapeHtml(rendered)}</code></pre>
          </section>
        </div>
        <div class="reference-notes">
          <section><h4>Gotchas</h4><ul>${gotchas}</ul></section>
          <section><h4>Compatibility</h4><p>${escapeHtml(element.compatibility)}</p></section>
        </div>
        <div class="try-actions">
          <button class="btn btn-primary try-btn" type="button" data-example="${escapeHtml(element.id)}">Try it in the playground</button>
          <a class="btn btn-ghost converter-btn" href="/#converter" data-converter-example="${escapeHtml(element.id)}">Open in the full converter</a>
        </div>
      </article>`;
}).join("");

const troubleshooting = content.troubleshooting.map((item, index) => `
        <article class="trouble-card">
          <div class="trouble-number">${String(index + 1).padStart(2, "0")}</div>
          <div>
            <h3>${escapeHtml(item.symptom)}</h3>
            <p><strong>Cause:</strong> ${escapeHtml(item.cause)}</p>
            <p><strong>Fix:</strong> ${escapeHtml(item.fix)}</p>
            <button class="text-link trouble-try" type="button" data-trouble="${index}">Test this fix in the playground →</button>
          </div>
        </article>`).join("");

function plannedGfmLabel(value, measured) {
  if (value === true) return measured ? "Yes" : "No";
  if (value === false) return "No";
  if (value === "partial") return `Partial / platform-dependent (engine: ${measured ? "Yes" : "No"})`;
  if (value === "platform") return `Platform feature (engine: ${measured ? "Yes" : "No"})`;
  if (value === "context") return `Context-dependent (engine: ${measured ? "Yes" : "No"})`;
  return String(value);
}

const compatibilityRows = content.compatibility.map((row) => {
  const measured = measuredCompatibility(row.id);
  return `
          <tr data-compat-id="${escapeHtml(row.id)}" data-commonmark="${measured.commonmark}" data-gfm-engine="${measured.gfm}" data-site="${measured.site}">
            <th scope="row">${escapeHtml(row.syntax)}</th>
            <td>${measured.commonmark ? "✅ Yes" : "❌ No"}</td>
            <td>${escapeHtml(plannedGfmLabel(row.gfm, measured.gfm))}</td>
            <td>${measured.site ? "✅ Yes" : "❌ No"}</td>
          </tr>`;
}).join("");

const faqs = content.faq.map((faq) => `
        <details>
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>`).join("");

const playgroundHtml = renderMarkdown(content.playgroundDefault);
const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://mdtohtml.app/" },
        { "@type": "ListItem", position: 2, name: "Markdown Cheat Sheet", item: content.meta.canonical }
      ]
    },
    {
      "@type": "TechArticle",
      headline: content.meta.h1,
      description: content.meta.description,
      url: content.meta.canonical,
      datePublished: content.meta.datePublished,
      dateModified: content.meta.dateModified,
      image: content.meta.socialImage,
      author: { "@type": "Organization", name: "mdtohtml.app", url: "https://mdtohtml.app/" },
      publisher: { "@type": "Organization", name: "mdtohtml.app", url: "https://mdtohtml.app/" },
      mainEntityOfPage: content.meta.canonical,
      proficiencyLevel: "Beginner to advanced"
    }
  ]
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(content.meta.title)}</title>
<meta name="description" content="${escapeHtml(content.meta.description)}">
<link rel="canonical" href="${escapeHtml(content.meta.canonical)}">
<link rel="icon" href="../favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="../favicon.svg">
<meta property="og:title" content="${escapeHtml(content.meta.title)}">
<meta property="og:description" content="${escapeHtml(content.meta.description)}">
<meta property="og:url" content="${escapeHtml(content.meta.canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="mdtohtml.app">
<meta property="article:published_time" content="${content.meta.datePublished}">
<meta property="article:modified_time" content="${content.meta.dateModified}">
<meta property="og:image" content="${escapeHtml(content.meta.socialImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${escapeHtml(content.meta.socialImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(content.meta.title)}">
<meta name="twitter:description" content="${escapeHtml(content.meta.description)}">
<meta name="twitter:image" content="${escapeHtml(content.meta.socialImage)}">
<meta name="twitter:image:alt" content="${escapeHtml(content.meta.socialImageAlt)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/site.css">
<link rel="stylesheet" href="../assets/cheatsheet.css">
<script defer src="https://ccc-monitor.583079497.workers.dev/beacon.js" data-site="mdtohtml.app"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.0/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.4.13/dist/purify.min.js"></script>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<nav>
  <a class="logo" href="../"><span class="mark">HTML</span>mdtohtml</a>
  <div class="nav-right">
    <a class="nav-text-link" href="../">Markdown → HTML</a>
    <a class="nav-text-link" href="../html-to-markdown/">HTML → Markdown</a>
    <a class="nav-text-link" href="../pdf-to-markdown/">PDF → Markdown</a>
    <a class="nav-text-link" href="../markdown-to-pdf/">Markdown → PDF</a>
    <a class="nav-text-link" href="../html-to-pdf/">HTML → PDF</a>
    <button class="mode-toggle" id="modeToggle" title="Toggle dark mode" aria-label="Toggle dark mode"><svg class="icon" viewBox="0 0 24 24"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg></button>
  </div>
</nav>

<main>
  <div class="cheat-shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="../">Home</a><span aria-hidden="true">›</span><span>Markdown Cheat Sheet</span></nav>
    <header class="cheat-hero">
      <p class="eyebrow">Syntax · rendered result · exact output · fixes</p>
      <h1>${escapeHtml(content.meta.h1)}</h1>
      <p>See what Markdown becomes, why a snippet breaks, and how CommonMark differs from GFM. Every HTML sample below is generated by the same sanitized engine as the converter.</p>
    </header>

    <section class="cheat-section" id="quick-reference">
      <div class="section-intro"><div><span class="eyebrow">10-second lookup</span><h2>Quick reference</h2></div><p>All 17 common forms. Copy syntax or jump to the detailed reference.</p></div>
      <div class="table-scroll" role="region" aria-label="Markdown quick reference" tabindex="0">
        <table class="cheat-table">
          <thead><tr><th>Element</th><th>Markdown</th><th>HTML</th><th>Spec</th><th><span class="sr-only">Action</span></th></tr></thead>
          <tbody>${quickRows}
          </tbody>
        </table>
      </div>
    </section>

    <section class="cheat-section" id="playground">
      <div class="section-intro"><div><span class="eyebrow">Shared live tool</span><h2>Live playground</h2></div><p>Edit Markdown once; compare the rendered preview and the exact sanitized HTML.</p></div>
      <div class="playground-grid">
        <section class="play-pane">
          <div class="sample-head"><h3>Markdown</h3>${copyButton("Copy", "playgroundInput")}</div>
          <textarea id="playgroundInput" spellcheck="false" aria-label="Playground Markdown">${escapeHtml(content.playgroundDefault)}</textarea>
        </section>
        <section class="play-pane">
          <div class="sample-head"><h3>Preview</h3><button class="btn btn-ghost copy-btn" type="button" data-copy-preview="playgroundPreview">Copy text</button></div>
          <div id="playgroundPreview" class="static-preview">${playgroundHtml}</div>
        </section>
        <section class="play-pane">
          <div class="sample-head"><h3>Exact HTML</h3>${copyButton("Copy", "playgroundHtml")}</div>
          <pre><code id="playgroundHtml">${escapeHtml(playgroundHtml)}</code></pre>
        </section>
      </div>
      <noscript><p class="noscript-note">JavaScript is off. The initial Markdown, preview, and exact generated HTML remain fully readable; live editing and copy shortcuts require JavaScript.</p></noscript>
    </section>

    <section class="cheat-section" id="reference">
      <div class="section-intro"><div><span class="eyebrow">14 tested elements</span><h2>Element reference</h2></div><p>Each section uses the same sequence: syntax, static preview, exact HTML, gotchas, compatibility, and a live test.</p></div>
      <div class="element-list">${elementSections}
      </div>
    </section>

    <section class="cheat-section" id="troubleshooting">
      <div class="section-intro"><div><span class="eyebrow">Symptom → cause → fix</span><h2>Markdown troubleshooting</h2></div><p>Fourteen frequent conversion failures, named the way they appear when you are debugging.</p></div>
      <div class="trouble-grid">${troubleshooting}
      </div>
    </section>

    <section class="cheat-section" id="compatibility">
      <div class="section-intro"><div><span class="eyebrow">Measured, not assumed</span><h2>CommonMark vs GFM</h2></div><p>The CommonMark and converter columns are generated from executable probes. Platform-only GFM behavior is called out explicitly.</p></div>
      <div class="table-scroll" role="region" aria-label="CommonMark and GFM compatibility" tabindex="0">
        <table class="compat-table">
          <thead><tr><th>Syntax</th><th>CommonMark</th><th>GFM ecosystem</th><th>This converter</th></tr></thead>
          <tbody>${compatibilityRows}
          </tbody>
        </table>
      </div>
      <p class="verified">${escapeHtml(content.meta.verified)}</p>
    </section>

    <section class="cheat-section faq-section" id="faq">
      <div class="section-intro"><div><span class="eyebrow">Practical answers</span><h2>Frequently asked questions</h2></div><p>Content for readers only; this page intentionally does not use FAQPage or HowTo structured data.</p></div>
      ${faqs}
    </section>

    <section class="tool-cta" id="tools">
      <span class="eyebrow">Keep working</span>
      <h2>Turn the syntax into a finished file</h2>
      <p>Convert, reverse, export, or capture a page with the same free, private browser tools.</p>
      <div class="tool-grid">
        <a href="../"><strong>Markdown → HTML</strong><span>Live preview and self-contained pages</span></a>
        <a href="../html-to-markdown/"><strong>HTML → Markdown</strong><span>Clean pages and pasted HTML</span></a>
        <a href="../markdown-to-pdf/"><strong>Markdown → PDF</strong><span>Themed PDF with math and diagrams</span></a>
        <a href="../html-to-pdf/"><strong>HTML → PDF</strong><span>URL or HTML to a clean, themed PDF</span></a>
      </div>
    </section>
  </div>
</main>

<footer>
  <span>© 2026 mdtohtml.app · ${escapeHtml(content.meta.verified)}</span>
  <span><a href="mailto:support@mdtohtml.app">support@mdtohtml.app</a><a href="/feedback/">Feedback</a><a href="../">Markdown to HTML</a><a href="../html-to-markdown/">HTML to Markdown</a><a href="../pdf-to-markdown/">PDF to Markdown</a><a href="../markdown-to-pdf/">Markdown to PDF</a><a href="../html-to-pdf/">HTML to PDF</a><a href="../extension.zip?v=1.4.0" download>Browser Extension</a><a href="/privacy/">Privacy</a></span>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>window.CHEATSHEET_DATA=${jsonForScript({
  examples: Object.fromEntries(content.elements.map((element) => [element.id, element.markdown])),
  troubleshooting: content.troubleshooting.map((item) => item.example)
})};</script>
<script src="../assets/render.js"></script>
<script src="../assets/cheatsheet.js"></script>
</body>
</html>
`;

fs.writeFileSync(outputPath, html);
console.log(`Generated ${path.relative(root, outputPath)} (${Buffer.byteLength(html).toLocaleString()} bytes)`);
