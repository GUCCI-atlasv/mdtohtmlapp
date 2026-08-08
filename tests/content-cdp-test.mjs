const endpoint = process.env.CDP_URL || "http://127.0.0.1:9222";
const fixtureUrl = process.env.FIXTURE_URL || "http://127.0.0.1:8765/tests/extension-smoke.html";
const target = await fetch(`${endpoint}/json/new?${encodeURIComponent(fixtureUrl)}`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
let sequence = 0;
const pending = new Map();

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
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  };
});

await call("Runtime.enable");
await new Promise((resolve) => setTimeout(resolve, 700));
const evaluated = await call("Runtime.evaluate", {
  expression: `JSON.stringify({ pass:document.documentElement.dataset.pass, output:document.getElementById("result")?.textContent })`,
  returnByValue: true
});
const state = JSON.parse(evaluated.result.value);
const details = state.output ? JSON.parse(state.output) : null;
console.log(JSON.stringify({
  pass: state.pass,
  checks: details?.checks,
  htmlChecks: details?.htmlChecks,
  readabilityChecks: details?.readabilityChecks,
  fallbackChecks: details?.fallbackChecks,
  fallbackQuality: details?.fallbackQuality,
  selectionChecks: details?.selectionChecks,
  pickerChecks: details?.pickerChecks
}, null, 2));
socket.close();
if (state.pass !== "true") process.exit(1);
