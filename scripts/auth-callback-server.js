const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.AUTH_CALLBACK_PORT || 8789);
const publicDir = path.join(__dirname, "..", "public");
const pages = new Map([
  ["/auth-callback.html", path.join(publicDir, "auth-callback.html")],
  ["/reset-password.html", path.join(publicDir, "reset-password.html")],
]);

const server = http.createServer((request, response) => {
  const requestPath = request.url ? new URL(request.url, `http://localhost:${port}`).pathname : "";
  const pagePath = pages.get(requestPath);

  if (!pagePath) {
    response.writeHead(302, { Location: "/auth-callback.html" });
    response.end();
    return;
  }

  fs.readFile(pagePath, "utf8", (error, html) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("UniMatch confirmation page could not be loaded.");
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(injectSupabaseEnv(html));
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`UniMatch auth callback page: http://localhost:${port}/auth-callback.html`);
  console.log(`UniMatch password reset page: http://localhost:${port}/reset-password.html`);
});

function injectSupabaseEnv(html) {
  const env = readEnvFile(path.join(__dirname, "..", ".env"));
  return html
    .replaceAll("__SUPABASE_URL__", escapeHtml(env.EXPO_PUBLIC_SUPABASE_URL || ""))
    .replaceAll("__SUPABASE_KEY__", escapeHtml(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""));
}

function readEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .reduce((result, line) => {
        const match = line.match(/^([^#=\s]+)=(.*)$/);
        if (match) result[match[1]] = match[2].trim();
        return result;
      }, {});
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
