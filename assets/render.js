/* mdtohtml.app — shared rendering engine (used by index & viewer)
   Depends on: marked (required), DOMPurify (optional, used if present) */
(function (global) {
  "use strict";

  /* ---------- Document themes (inline CSS, self-contained output) ---------- */
  var BASE_CSS = [
    ':root{--bg:#ffffff;--text:#1a1a1a;--muted:#666;--border:#eaeaea;--accent:#D97757;--code-bg:#f6f6f6;--link:#0969da}',
    'body[data-mode="dark"]{--bg:#0a0a0a;--text:#ededed;--muted:#999;--border:#2a2a2a;--code-bg:#161616;--link:#58a6ff}',
    '*{box-sizing:border-box}',
    'body{margin:0;background:var(--bg);color:var(--text);line-height:1.65;-webkit-font-smoothing:antialiased}',
    '.doc{max-width:760px;margin:0 auto;padding:48px 24px}',
    'img{max-width:100%;border-radius:6px}',
    'a{color:var(--link)}',
    'code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:var(--code-bg);padding:2px 5px;border-radius:5px}',
    'pre{background:#0a0a0a;color:#ededed;border:1px solid #2a2a2a;padding:14px 16px;border-radius:8px;overflow:auto}',
    'pre code{background:none;padding:0;color:inherit}',
    'table{border-collapse:collapse;width:100%;margin:1em 0}',
    'th,td{border:1px solid var(--border);padding:7px 11px;text-align:left}',
    'th{background:var(--code-bg)}',
    'blockquote{border-left:3px solid var(--accent);margin:1em 0;padding:0 0 0 14px;color:var(--muted)}',
    'hr{border:none;border-top:1px solid var(--border);margin:2em 0}',
    'input[type=checkbox]{margin-right:6px}',
    '.toc{border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:32px;font-size:14px}',
    '.toc-title{font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:8px}',
    '.toc ul{list-style:none;margin:0;padding:0}',
    '.toc li{margin:4px 0}.toc li.lvl-2{padding-left:16px}.toc li.lvl-3{padding-left:32px}',
    '.toc a{color:var(--text);text-decoration:none}.toc a:hover{color:var(--accent)}',
    '.made-with{margin-top:56px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}',
    '.made-with a{color:var(--accent);text-decoration:none}'
  ].join('\n');

  var THEMES = {
    github: {
      label: 'GitHub',
      css: [
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}',
        'h1,h2{border-bottom:1px solid var(--border);padding-bottom:.3em}',
        'h1,h2,h3,h4{letter-spacing:-.01em;line-height:1.3;margin:1.4em 0 .5em}',
        'h1{font-size:2em;margin-top:0}h2{font-size:1.5em}h3{font-size:1.2em}'
      ].join('\n')
    },
    docs: {
      label: 'Docs',
      css: [
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}',
        '.doc{max-width:820px}',
        'h1{font-size:2.1em;letter-spacing:-.02em;margin:0 0 .3em}',
        'h1:after{content:"";display:block;width:44px;height:3px;background:var(--accent);margin-top:12px;border-radius:2px}',
        'h2{font-size:1.4em;margin:1.8em 0 .5em;letter-spacing:-.01em}',
        'h3{font-size:1.1em;margin:1.4em 0 .4em;color:var(--accent)}',
        'a{color:var(--accent)}'
      ].join('\n')
    },
    magazine: {
      label: 'Magazine',
      css: [
        'body{font-family:Georgia,"Times New Roman",serif;line-height:1.75}',
        '.doc{max-width:680px}',
        'h1{font-size:2.6em;line-height:1.15;letter-spacing:-.02em;text-align:center;margin:0 0 .8em}',
        'h2{font-size:1.6em;margin:1.8em 0 .5em}h3{font-size:1.25em;font-style:italic}',
        'blockquote{font-style:italic;font-size:1.1em;border-left-width:2px}',
        'code,pre{font-size:.85em}'
      ].join('\n')
    },
    minimal: {
      label: 'Minimal',
      css: [
        'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;line-height:1.8}',
        '.doc{max-width:620px;padding:72px 24px}',
        'h1,h2,h3{font-weight:600;letter-spacing:-.01em;margin:2em 0 .4em}',
        'h1{font-size:1.6em;margin-top:0}h2{font-size:1.25em}h3{font-size:1.05em}',
        'a{color:var(--text);text-decoration:underline;text-underline-offset:3px}',
        'blockquote{border-left-color:var(--border)}'
      ].join('\n')
    }
  };

  /* ---------- Markdown → HTML ---------- */
  function configure() {
    if (global.marked && global.marked.setOptions) {
      global.marked.setOptions({ gfm: true, breaks: false });
    }
  }

  function sanitize(html) {
    if (global.DOMPurify) {
      return global.DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] });
    }
    return html;
  }

  function slugify(text, used) {
    var s = String(text).toLowerCase().trim()
      .replace(/[^\w一-龥\- ]+/g, '')
      .replace(/\s+/g, '-') || 'section';
    var base = s, i = 2;
    while (used[s]) { s = base + '-' + i++; }
    used[s] = true;
    return s;
  }

  /* Returns { html, headings:[{level,text,id}], title } */
  function renderMarkdown(md) {
    configure();
    var raw = global.marked.parse(md || '');
    var clean = sanitize(raw);
    var tpl = document.createElement('template');
    tpl.innerHTML = clean;
    var used = {}, headings = [];
    tpl.content.querySelectorAll('h1,h2,h3').forEach(function (h) {
      var id = slugify(h.textContent, used);
      h.id = id;
      headings.push({ level: +h.tagName[1], text: h.textContent, id: id });
    });
    var title = '';
    var h1 = tpl.content.querySelector('h1');
    if (h1) title = h1.textContent;
    var div = document.createElement('div');
    div.appendChild(tpl.content.cloneNode(true));
    return { html: div.innerHTML, headings: headings, title: title };
  }

  function buildToc(headings) {
    if (!headings || headings.length < 4) return '';
    var items = headings.map(function (h) {
      return '<li class="lvl-' + h.level + '"><a href="#' + h.id + '">' + escapeHtml(h.text) + '</a></li>';
    }).join('');
    return '<nav class="toc"><div class="toc-title">Contents</div><ul>' + items + '</ul></nav>';
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- Math protection (keeps $...$ / $$...$$ away from the md parser) ---------- */
  function protectMath(md) {
    var store = [];
    var parts = String(md).split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/);
    for (var i = 0; i < parts.length; i += 2) { // even indexes = prose, odd = code (untouched)
      if (parts[i] === undefined) continue;
      parts[i] = parts[i]
        .replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
          store.push({ t: tex.trim(), d: 1 });
          return '<span class="katex-src" data-i="' + (store.length - 1) + '"></span>';
        })
        .replace(/(^|[^\\$])\$([^\s$][^$\n]*?)\$(?!\$)/g, function (m, pre, tex) {
          store.push({ t: tex, d: 0 });
          return pre + '<span class="katex-src" data-i="' + (store.length - 1) + '"></span>';
        });
    }
    return { md: parts.join(''), math: store };
  }

  var KATEX_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
  var KATEX_JS = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
  var MERMAID_JS = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js';

  function richGlue(mathStore, autoPrint) {
    var json = JSON.stringify(mathStore).replace(/</g, '\\u003c');
    return '<script src="' + KATEX_JS + '"><\/script>\n' +
      '<script src="' + MERMAID_JS + '"><\/script>\n' +
      '<script>\n(function(){\n' +
      'var MATH=' + json + ';\n' +
      'function done(){' + (autoPrint ? 'setTimeout(function(){window.print()},400);' : '') + '}\n' +
      'addEventListener("load",function(){\n' +
      '  document.querySelectorAll(".katex-src").forEach(function(el){\n' +
      '    var m=MATH[+el.dataset.i];if(!m)return;\n' +
      '    try{katex.render(m.t,el,{displayMode:!!m.d,throwOnError:false});}catch(e){el.textContent=m.t;}\n' +
      '    if(m.d){el.style.display="block";el.style.textAlign="center";el.style.margin="1em 0";}\n' +
      '  });\n' +
      '  var pr=Promise.resolve();\n' +
      '  var codes=document.querySelectorAll("pre code.language-mermaid, pre code.lang-mermaid");\n' +
      '  if(codes.length&&window.mermaid){\n' +
      '    codes.forEach(function(c){var d=document.createElement("div");d.className="mermaid";d.textContent=c.textContent;var p=c.closest("pre")||c.parentNode;p.parentNode.replaceChild(d,p);});\n' +
      '    mermaid.initialize({startOnLoad:false,theme:"neutral"});\n' +
      '    pr=mermaid.run({querySelector:".mermaid"}).catch(function(){});\n' +
      '  }\n' +
      '  pr.then(function(){setTimeout(done,300);});\n' +
      '});\n})();\n<\/script>';
  }

  /* ---------- Full self-contained document ---------- */
  function buildFullDoc(md, opts) {
    opts = opts || {};
    var theme = THEMES[opts.theme] ? opts.theme : 'github';
    var mode = opts.mode === 'dark' ? 'dark' : 'light';
    var mathStore = [];
    var source = md;
    if (opts.rich) {
      var prot = protectMath(md);
      source = prot.md;
      mathStore = prot.math;
    }
    var r = renderMarkdown(source);
    var title = opts.title || r.title || 'Document';
    var toc = opts.toc === false ? '' : buildToc(r.headings);
    var credit = opts.credit === false ? '' :
      '<div class="made-with">Made with <a href="https://mdtohtml.app">mdtohtml.app</a> — markdown in, a beautiful page out.</div>';
    var richCss = opts.rich ? '<link rel="stylesheet" href="' + KATEX_CSS + '">\n' +
      '<style>.mermaid{display:flex;justify-content:center;margin:1em 0}.mermaid svg{max-width:100%}</style>\n' : '';
    var scripts = opts.rich ? richGlue(mathStore, opts.autoPrint) :
      (opts.autoPrint ? '<scr' + 'ipt>addEventListener("load",function(){setTimeout(function(){window.print()},400)})</scr' + 'ipt>' : '');
    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
      '<title>' + escapeHtml(title) + '</title>\n' +
      richCss +
      '<style>\n' + BASE_CSS + '\n' + THEMES[theme].css + '\n' + (opts.extraCss || '') + '\n</style>\n' +
      '</head>\n<body data-mode="' + mode + '">\n<main class="doc">\n' +
      toc + r.html + credit +
      '\n</main>\n' + scripts + '\n</body>\n</html>';
  }

  /* ---------- Share payload (Free plan: content lives in the URL) ---------- */
  function encodeShare(md, theme, mode) {
    var payload = JSON.stringify({ v: 1, t: theme, m: mode, md: md });
    return global.LZString.compressToEncodedURIComponent(payload);
  }

  function decodeShare(hash) {
    if (!hash) return null;
    var raw = global.LZString.decompressFromEncodedURIComponent(hash.replace(/^#/, ''));
    if (!raw) return null;
    try {
      var p = JSON.parse(raw);
      if (p && typeof p.md === 'string') return p;
    } catch (e) { /* fall through: legacy plain-markdown payload */ }
    return { v: 0, t: 'github', m: 'light', md: raw };
  }

  global.MDH = {
    THEMES: THEMES,
    FREE_SHARE_LIMIT: 30000,
    renderMarkdown: renderMarkdown,
    buildFullDoc: buildFullDoc,
    encodeShare: encodeShare,
    decodeShare: decodeShare
  };
})(window);
