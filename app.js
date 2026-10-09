import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRouter } from "./routes.js";

const PUBLIC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".json": "application/json", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };

function serveStatic(req, res) {
  const p = new URL(req.url, "http://x").pathname;
  const app = path.join(PUBLIC, "app"), hasApp = fs.existsSync(path.join(app, "index.html"));
  let file = p === "/legacy" ? path.join(PUBLIC, "legacy.html") : null;
  if (!file && hasApp) {
    const f = path.normalize(path.join(app, p));
    file = f.startsWith(app) && fs.existsSync(f) && fs.statSync(f).isFile() ? f : path.join(app, "index.html"); // SPA fallback для Vue Router
  }
  if (!file) file = path.join(PUBLIC, "legacy.html"); // фронт ещё не собран → старая страница
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

export function createApp() {
  const router = buildRouter();
  return http.createServer(async (req, res) => { if (!(await router.handle(req, res))) serveStatic(req, res); });
}
