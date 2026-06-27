const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.AUTH_CALLBACK_PORT || 8789);
const pagePath = path.join(__dirname, "..", "public", "auth-callback.html");

const server = http.createServer((request, response) => {
  if (!request.url || !request.url.startsWith("/auth-callback.html")) {
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
    response.end(html);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`UniMatch auth callback page: http://localhost:${port}/auth-callback.html`);
});
