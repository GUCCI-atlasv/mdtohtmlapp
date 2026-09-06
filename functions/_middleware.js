/**
 * Single canonical:
 *   https://mdtohtml.app/terms/
 *   https://mdtohtml.app/privacy/
 *
 * Everything else (www, http handled at edge, .html, no trailing slash)
 * collapses in one 301. Verification files keep their exact .html path.
 */

const VERIFY_HTML = {
  "/yandex_4938b0a4a7c6d0f5.html": `<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    </head>
    <body>Verification: 4938b0a4a7c6d0f5</body>
</html>
`,
};

const CANONICAL_DIRS = new Set(["/terms/", "/privacy/", "/feedback/", "/markdown-cheatsheet/"]);
const PATH_ALIASES = new Map([
  ["/markdown-cheat-sheet", "/markdown-cheatsheet/"],
  ["/markdown-cheat-sheet/", "/markdown-cheatsheet/"],
  ["/cheatsheet", "/markdown-cheatsheet/"],
  ["/cheatsheet/", "/markdown-cheatsheet/"],
  ["/markdown-syntax", "/markdown-cheatsheet/"],
  ["/markdown-syntax/", "/markdown-cheatsheet/"],
]);

function redirect(to) {
  return new Response(null, {
    status: 301,
    headers: {
      Location: to,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function onRequest(context) {
  const reqUrl = new URL(context.request.url);
  const url = new URL(context.request.url);

  // Exact verification file — never strip .html
  const verifyBody = VERIFY_HTML[url.pathname];
  if (verifyBody) {
    if (url.hostname === "www.mdtohtml.app") {
      url.hostname = "mdtohtml.app";
      url.protocol = "https:";
      return redirect(url.toString());
    }
    return new Response(verifyBody, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  url.hostname = "mdtohtml.app";
  url.protocol = "https:";

  let path = url.pathname;

  if (path.toLowerCase().endsWith(".html")) {
    path = path.slice(0, -5) || "/";
  }

  // /index.html → /, /dir/index.html → /dir/ (stripping .html alone would 404)
  if (path === "/index") {
    path = "/";
  } else if (path.endsWith("/index")) {
    path = path.slice(0, -"index".length);
  }

  path = PATH_ALIASES.get(path.toLowerCase()) || path;

  // Legal pages: always trailing slash (CF Pages directory index)
  if (path === "/terms" || path === "/privacy" || path === "/feedback" || path === "/markdown-cheatsheet") {
    path = `${path}/`;
  }

  url.pathname = path;

  if (
    url.protocol !== reqUrl.protocol ||
    url.hostname !== reqUrl.hostname ||
    url.pathname !== reqUrl.pathname
  ) {
    return redirect(url.toString());
  }

  // Strengthen canonical signal on the live legal pages
  if (CANONICAL_DIRS.has(path)) {
    const res = await context.next();
    const headers = new Headers(res.headers);
    headers.set("Link", `<https://mdtohtml.app${path}>; rel="canonical"`);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  return context.next();
}
