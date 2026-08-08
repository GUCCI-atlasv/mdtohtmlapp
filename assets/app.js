/* mdtohtml.app — main page logic */
(function () {
  "use strict";

  var SAMPLE = [
    '<img src="https://mdtohtml.app/assets/demo/landscape.jpg" alt="Tabby kitten on a desk beside a code-print mug, with the mdtohtml.app logo and a Markdown-to-HTML file icon" width="360" height="240">',
    '',
    '# Welcome to mdtohtml ✨',
    '',
    'Drop your own **.md file** here, paste from ChatGPT/Claude, or just start typing.',
    '',
    '## Why this tool',
    '> Markdown is for writing. **HTML is for reading & sharing.**',
    '',
    '| Feature | Included |',
    '|---|---|',
    '| Unlimited conversions | ✓ |',
    '| Themes + dark mode | ✓ |',
    '| Instant share links | ✓ |',
    '| Signup required | — |',
    '',
    '### Code just works',
    '```js',
    'const page = md2html(markdown, { theme: "github" });',
    '```',
    '',
    '## How to use',
    '1. Paste or drop markdown',
    '2. Pick a theme',
    '3. Share the link — done.'
  ].join('\n');

  var $ = function (id) { return document.getElementById(id); };
  var input = $('input'), previewFrame = $('previewFrame'), htmlcode = $('htmlcode'), stats = $('stats');
  var themeSel = $('theme');

  /* populate theme select */
  Object.keys(MDH.THEMES).forEach(function (k) {
    var o = document.createElement('option');
    o.value = k; o.textContent = 'Theme: ' + MDH.THEMES[k].label;
    themeSel.appendChild(o);
  });

  function currentMode() {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }

  /* The preview is the exported document itself, so the theme is always visible.
     Reloading srcdoc costs more than a DOM write, so typing debounces it while
     the HTML tab and counters stay instant. */
  var previewTimer;
  function renderPreview() {
    clearTimeout(previewTimer);
    previewFrame.srcdoc = fullDoc();
  }
  function renderSidePanels() {
    var r = MDH.renderMarkdown(input.value);
    htmlcode.textContent = r.html.trim();
    stats.textContent = input.value.length.toLocaleString() + ' chars · ' + input.value.split(/\n/).length + ' lines';
  }
  function render() {
    renderSidePanels();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 140);
  }
  input.addEventListener('input', render);
  themeSel.addEventListener('change', function () {
    renderPreview();
    toast('Theme: ' + MDH.THEMES[themeSel.value].label);
  });

  /* tabs */
  window.showTab = function (t) {
    var p = t === 'preview';
    previewFrame.style.display = p ? 'block' : 'none';
    htmlcode.style.display = p ? 'none' : 'block';
    $('tabPreview').classList.toggle('active', p);
    $('tabHtml').classList.toggle('active', !p);
  };

  /* file upload + drag&drop */
  $('file').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    f.text().then(function (t) { input.value = t; render(); toast('Loaded ' + f.name); });
    e.target.value = '';
  });
  var pane = $('inputPane');
  ['dragover', 'dragenter'].forEach(function (ev) {
    pane.addEventListener(ev, function (e) { e.preventDefault(); pane.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    pane.addEventListener(ev, function (e) { e.preventDefault(); pane.classList.remove('dragover'); });
  });
  pane.addEventListener('drop', function (e) {
    var f = e.dataTransfer.files[0]; if (!f) return;
    f.text().then(function (t) { input.value = t; render(); toast('Loaded ' + f.name); });
  });

  /* URL import */
  window.importUrl = function () {
    var url = prompt('Fetch a raw markdown URL (e.g. raw.githubusercontent.com/...):');
    if (!url) return;
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (t) {
      input.value = t; render(); toast('Imported from URL');
    }).catch(function () {
      toast('Could not fetch — check the URL allows cross-origin access');
    });
  };

  /* outputs */
  function fullDoc() {
    return MDH.buildFullDoc(input.value, { theme: themeSel.value, mode: currentMode() });
  }
  window.copyHtml = function () {
    navigator.clipboard.writeText(MDH.renderMarkdown(input.value).html.trim());
    toast('Clean HTML fragment copied');
  };
  window.copyFullPage = function () {
    navigator.clipboard.writeText(fullDoc());
    toast('Full styled page copied');
  };
  window.downloadHtml = function () {
    var blob = new Blob([fullDoc()], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'document.html';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    toast('Downloaded document.html');
  };
  window.previewFull = function () {
    var blob = new Blob([fullDoc()], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  /* share — content is compressed into the URL fragment, never uploaded */
  window.share = function () {
    var md = input.value;
    var over = md.length > MDH.FREE_SHARE_LIMIT;
    var box = $('freeLink'), note = $('freeNote'), btn = $('freeCopyBtn');
    if (over) {
      box.value = '';
      note.innerHTML = 'Document is <b>' + md.length.toLocaleString() + '</b> characters — too long to fit in a link (limit ' +
        MDH.FREE_SHARE_LIMIT.toLocaleString() + '). <span class="warn">Use “Download .html” instead</span> and share the file — it’s fully self-contained.';
      btn.disabled = true;
    } else {
      var packed = MDH.encodeShare(md, themeSel.value, currentMode());
      box.value = new URL('v/#' + packed, location.href).href;
      note.textContent = 'Your document is compressed into the link itself — nothing is uploaded. Works forever.';
      btn.disabled = false;
    }
    $('shareOverlay').classList.add('open');
  };
  window.copyLink = function () {
    navigator.clipboard.writeText($('freeLink').value);
    toast('Link copied — nothing was uploaded');
  };
  window.openShare = function () { $('shareOverlay').classList.add('open'); };
  window.closeShare = function () { $('shareOverlay').classList.remove('open'); };

  /* toast + dark mode */
  var tt;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  window.toast = toast;
  $('modeToggle').onclick = function () {
    var el = document.documentElement;
    el.dataset.theme = el.dataset.theme === 'dark' ? '' : 'dark';
    try { localStorage.setItem('mdh-mode', el.dataset.theme || 'light'); } catch (e) {}
    renderPreview(); /* light/dark is baked into the document, not inherited */
  };
  try {
    if (localStorage.getItem('mdh-mode') === 'dark') document.documentElement.dataset.theme = 'dark';
  } catch (e) {}

  /* restore draft — upgrade stock samples that hid the demo image below the fold */
  try {
    var draft = localStorage.getItem('mdh-draft');
    var stockNeedsRefresh = draft &&
      draft.indexOf('# Welcome to mdtohtml') !== -1 &&
      draft.indexOf('| Feature | Included |') !== -1 &&
      (draft.indexOf('landscape.') === -1 || draft.indexOf('# Welcome to mdtohtml') < draft.indexOf('landscape.') || draft.indexOf('width="360"') === -1);
    input.value = (!draft || stockNeedsRefresh) ? SAMPLE : draft;
  } catch (e) { input.value = SAMPLE; }
  input.addEventListener('input', function () {
    try { localStorage.setItem('mdh-draft', input.value); } catch (e) {}
  });

  renderSidePanels();
  renderPreview();
})();
