const endpoint = process.env.CDP_URL || "http://127.0.0.1:9222";
const feedbackUrl = process.env.FEEDBACK_URL || "http://127.0.0.1:8765/extension/feedback.html?title=%E6%B5%8B%E8%AF%95%E6%96%87%E7%AB%A0&url=https%3A%2F%2Fexample.com%2Farticle";

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
  source: `Object.defineProperty(navigator, "clipboard", { value: { writeText: async (text) => { globalThis.__copiedFeedback = text; } }, configurable: true });`
});
await call("Page.navigate", { url: feedbackUrl });
await new Promise((resolve) => setTimeout(resolve, 300));
await call("Runtime.evaluate", {
  expression: `
    document.getElementById("category").value = "导出问题";
    document.getElementById("email").value = "user@example.com";
    document.getElementById("message").value = "导出的图片没有正常显示，请协助排查。";
    document.getElementById("message").dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("copyFeedback").click();
  `
});
await new Promise((resolve) => setTimeout(resolve, 100));

const evaluated = await call("Runtime.evaluate", {
  expression: `JSON.stringify({
    heading: document.querySelector("h1")?.textContent,
    destinationShown: document.body.textContent.includes("support@mdtohtml.app"),
    pageContextShown: !document.getElementById("pageContext")?.hidden,
    contextTitle: document.getElementById("contextTitle")?.textContent,
    contextUrl: document.getElementById("contextUrl")?.textContent,
    counter: document.getElementById("counter")?.textContent,
    status: document.getElementById("status")?.textContent,
    copied: globalThis.__copiedFeedback
  })`,
  returnByValue: true
});
const state = JSON.parse(evaluated.result.value);
const checks = {
  noRuntimeException: !runtimeException,
  correctHeading: state.heading === "问题反馈",
  destinationShown: state.destinationShown,
  pageContextShown: state.pageContextShown,
  pageContextCorrect: state.contextTitle === "测试文章" && state.contextUrl === "https://example.com/article",
  counterUpdated: /^\d+ \/ 3000$/.test(state.counter),
  copySucceeded: state.status.includes("反馈内容已复制"),
  destinationCopied: state.copied.includes("收件人：support@mdtohtml.app"),
  descriptionCopied: state.copied.includes("导出的图片没有正常显示")
};

console.log(JSON.stringify({ checks, state }, null, 2));
socket.close();
if (!Object.values(checks).every(Boolean)) process.exit(1);
