const endpoint = process.env.CDP_URL || "http://127.0.0.1:9222";
const popupUrl = process.env.POPUP_URL || "http://127.0.0.1:8765/extension/popup.html";

const target = await fetch(`${endpoint}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let sequence = 0;
let runtimeException = null;

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") runtimeException = message.params.exceptionDetails;
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
});

await call("Runtime.enable");
await call("Page.enable");
await call("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    globalThis.browser = {
      tabs: {
        query: async () => [{ id: 7, title: "测试文章", url: "https://example.com/article", favIconUrl: "" }],
        sendMessage: async (_id, message) => {
          if (message.type === "MDHTML_INSPECT") return { hasSelection: false, hasPicked: false };
          if (message.type === "MDHTML_PREPARE") return {
            ok: true,
            markdown: "---\\ntitle: \\\"测试文章\\\"\\n---\\n# 测试文章\\n\\n正文内容。\\n",
            filename: "测试文章",
            quality: "Readability 正文",
            qualityLevel: "good"
          };
          if (message.type === "MDHTML_EXPORT" && message.format === "markdown") return { ok: true, content: "# 测试文章\\n\\n正文内容。\\n", filename: "测试文章.md", mime: "text/markdown" };
          if (message.type === "MDHTML_EXPORT") return { ok: true, content: "<!doctype html><p>正文</p>", filename: "测试文章.html", mime: "text/html" };
          if (message.type === "MDHTML_START_PICKER") return { ok: true };
          return { ok: false };
        }
      },
      scripting: { executeScript: async () => [] },
      storage: { local: { get: async () => ({}), set: async () => {} } },
      downloads: { download: async (options) => { globalThis.__download = options; return 1; } }
    };
  `
});
await call("Page.navigate", { url: popupUrl });
await new Promise((resolve) => setTimeout(resolve, 800));

await call("Runtime.evaluate", { expression: `document.getElementById("saveHtml").click()` });
await new Promise((resolve) => setTimeout(resolve, 200));

const evaluated = await call("Runtime.evaluate", {
  expression: `JSON.stringify({
    pageTitle: document.getElementById("pageTitle")?.textContent,
    filename: document.getElementById("filename")?.value,
    noPreview: !document.getElementById("preview"),
    extensionLabel: document.querySelector(".extension-label")?.textContent,
    summary: document.getElementById("summaryTitle")?.textContent,
    primaryLabel: document.getElementById("saveHtml")?.textContent,
    quality: document.getElementById("quality")?.textContent,
    saveDisabled: document.getElementById("saveHtml")?.disabled,
    status: document.getElementById("status")?.textContent,
    downloadedFilename: globalThis.__download?.filename
  })`,
  returnByValue: true
});
const state = JSON.parse(evaluated.result.value);
const checks = {
  noRuntimeException: !runtimeException,
  correctPage: state.pageTitle === "测试文章",
  filenameReady: state.filename === "测试文章",
  previewRemoved: state.noPreview,
  htmlExtensionShown: state.extensionLabel === ".html",
  htmlSummaryReady: state.summary === "HTML 文件已准备好",
  htmlIsPrimary: state.primaryLabel.includes("保存为 HTML"),
  qualityShown: state.quality === "Readability 正文",
  saveEnabled: state.saveDisabled === false,
  htmlDownloaded: state.downloadedFilename === "测试文章.html",
  successStatus: state.status === "已保存 测试文章.html"
};

console.log(JSON.stringify({ checks, state }, null, 2));
socket.close();
if (!Object.values(checks).every(Boolean)) process.exit(1);
