# mdtohtml.app

**Markdown in. A beautiful page out.**

[![mdtohtml.app — Markdown, HTML and PDF tools](assets/og-card.jpg)](https://mdtohtml.app)

Free browser-based converters for Markdown, HTML and PDF — no signup, no watermark, nothing uploaded.

**Live site:** [https://mdtohtml.app](https://mdtohtml.app)

## Tools

| Tool | URL | What it does |
|------|-----|----------------|
| Markdown → HTML | [/](https://mdtohtml.app/) | Paste or drop `.md`, live themed preview, copy/download/share |
| HTML → Markdown | [/html-to-markdown/](https://mdtohtml.app/html-to-markdown/) | URL or raw HTML → clean GFM Markdown |
| Markdown → PDF | [/markdown-to-pdf/](https://mdtohtml.app/markdown-to-pdf/) | Themed PDF with KaTeX math & Mermaid diagrams |
| HTML → PDF | [/html-to-pdf/](https://mdtohtml.app/html-to-pdf/) | URL or HTML → themed preview → Save as PDF |
| Cheat sheet | [/markdown-cheatsheet/](https://mdtohtml.app/markdown-cheatsheet/) | Syntax, exact HTML output, playground & fixes |

Also included: a browser extension to save the page you’re viewing as HTML/Markdown.

## Why this exists

- **100% free forever** — no Pro tier, no accounts, no usage limits
- **Private by design** — conversion runs in your browser; share links pack the doc into the URL `#fragment`
- **Actually useful output** — not just tags: themed, self-contained HTML pages and print-ready PDFs
- **GFM support** — tables, task lists, strikethrough, fenced code, autolinks

## Themes

GitHub · Docs · Magazine · Minimal — each with light/dark. The homepage preview is WYSIWYG: what you see is what download / share / PDF export produce.

## Stack

Static site (no app server):

- [marked](https://github.com/markedjs/marked) 12 + [DOMPurify](https://github.com/cure53/DOMPurify)
- [Turndown](https://github.com/mixmark-io/turndown) (+ GFM) for HTML → Markdown
- KaTeX + Mermaid on the PDF tools
- Cloudflare Pages (`_headers`, `_redirects`, Functions middleware for canonical URLs)

## Develop

```bash
npm install
npm run check          # build cheatsheet + stamp asset hashes + run tests
npx serve .            # or: python3 -m http.server 8080
```

| Script | Purpose |
|--------|---------|
| `npm run build:cheatsheet` | Generate `markdown-cheatsheet/index.html` from `content/cheatsheet.json` |
| `npm run build:assets` | Append content hashes to local CSS/JS refs |
| `npm run build` | Both of the above |
| `npm test` | Node test suite |
| `npm run check` | Build + test (run before every deploy) |

Edit `content/cheatsheet.json` for cheatsheet copy — never hand-edit the generated HTML examples.

## Deploy

```bash
npm run check
npx wrangler pages deploy . --project-name=mdtohtml --branch=main --commit-dirty=true
```

Or connect the repo to Cloudflare Pages / Vercel / Netlify and set the build command to `npm run build`.

## Repo layout

```
index.html                 Markdown → HTML converter
html-to-markdown/          HTML → Markdown
markdown-to-pdf/           Markdown → PDF
html-to-pdf/               HTML → PDF
markdown-cheatsheet/       Generated reference page
v/                         Share-link viewer (noindex)
content/cheatsheet.json    Cheatsheet source of truth
build/                     Generators (cheatsheet, asset hashing)
assets/                    CSS, JS, step SVGs, demo & OG images
functions/_middleware.js   www/.html/trailing-slash canonicalization
extension/                 Browser extension source (HTML-first export + feedback form)
test/                      Automated checks
```

## License

Source code is released under the [MIT License](LICENSE).

The live service at [mdtohtml.app](https://mdtohtml.app) is free for personal and commercial use. See [Terms](https://mdtohtml.app/terms/) and [Privacy](https://mdtohtml.app/privacy/).
