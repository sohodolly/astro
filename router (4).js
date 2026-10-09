// Маршрутизатор с параметрами (/api/charts/:id), цепочками middleware и единым обработчиком ошибок.
export class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
export class Reply { constructor(status, data) { this.status = status; this.data = data; } }
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS" };

const readRaw = req => new Promise((ok, no) => {
  let b = ""; req.on("data", d => { b += d; if (b.length > 1e6) { no(new HttpError(413, "body too large")); req.destroy(); } });
  req.on("end", () => ok(b)); req.on("error", no);
});

export class Router {
  routes = [];
  add(method, path, ...handlers) {
    const keys = [];
    const re = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$");
    this.routes.push({ method, re, keys, handlers });
    return this;
  }
  get(p, ...h) { return this.add("GET", p, ...h); }
  post(p, ...h) { return this.add("POST", p, ...h); }
  delete(p, ...h) { return this.add("DELETE", p, ...h); }

  /** Возвращает false, если путь не /api/ (тогда сервер отдаёт статику). */
  async handle(req, res) {
    const url = new URL(req.url, "http://x");
    if (!url.pathname.startsWith("/api/")) return false;
    const send = (code, data) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", ...CORS }); res.end(code === 204 ? "" : JSON.stringify(data)); };
    try {
      if (req.method === "OPTIONS") return send(204), true;
      let m, route;
      for (const r of this.routes) if (r.method === req.method && (m = r.re.exec(url.pathname))) { route = r; break; }
      if (!route) throw new HttpError(404, "not found");
      const raw = await readRaw(req);
      let body = {};
      if (raw) try { body = JSON.parse(raw); } catch { throw new HttpError(400, "invalid JSON"); }
      const ctx = { req, raw, body, user: null, query: Object.fromEntries(url.searchParams),
        params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      for (const h of route.handlers) {
        const out = await h(ctx);
        if (out !== undefined) return out instanceof Reply ? send(out.status, out.data) : send(200, out), true;
      }
      throw new HttpError(500, "handler returned nothing");
    } catch (e) {
      if (!e.code || e.code >= 500) console.error(e);
      send(e.code || 500, { detail: e.code ? e.message : "internal error" });
    }
    return true;
  }
}
