// Запуск: node server.js → http://127.0.0.1:8000   (Node 18+, без зависимостей)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as astro from "./astro.js";

const BASE = path.dirname(fileURLToPath(import.meta.url)), PORT = process.env.PORT || 8000;

// ---------- Самодельный RAG: BM25 ----------
const PLANET_KEY = { "Солнце": "ядро личности, воля", "Луна": "эмоции, потребность в безопасности", "Меркурий": "мышление, речь",
  "Венера": "любовь, ценности", "Марс": "действие, энергия", "Юпитер": "рост, удача", "Сатурн": "дисциплина, границы",
  "Уран": "свобода, перемены", "Нептун": "интуиция, иллюзии", "Плутон": "трансформация, власть", "Сев. узел": "направление развития" };
const SIGN_KEY = ["инициатива", "устойчивость", "любопытство", "забота", "яркость", "анализ", "гармония", "глубина", "поиск смысла", "структура", "независимость", "чувствительность"];
const HOUSE_KEY = ["личность", "ресурсы", "общение", "дом", "творчество", "здоровье", "партнёрство", "кризисы", "философия", "карьера", "друзья", "подсознание"];
const ARC_KEY = ["начало, свобода", "воля, мастерство", "интуиция, тайна", "плодородие, забота", "власть, порядок", "традиция, учение", "выбор, любовь",
  "движение, победа", "внутренняя сила", "мудрость, уединение", "цикл, судьба", "баланс, закон", "жертва, новый взгляд", "завершение, обновление",
  "мера, исцеление", "зависимость, соблазн", "обрушение иллюзий", "надежда, вдохновение", "страхи, подсознание", "радость, успех", "возрождение, призвание", "целостность, итог"];

function buildDocs() {
  const docs = [];
  for (const [p, pk] of Object.entries(PLANET_KEY)) {
    astro.SIGNS.forEach((s, i) => docs.push([`${p} в знаке ${s}`, `${p} в знаке ${s}: ${pk} проявляются через ${SIGN_KEY[i]}.`]));
    HOUSE_KEY.forEach((h, i) => docs.push([`${p} в ${i + 1} доме`, `${p} в ${i + 1} доме: ${pk} направлены на сферу «${h}».`]));
  }
  ARC_KEY.forEach((k, i) => docs.push([`Аркан ${i || 22} ${astro.ARCANA[i]}`, `Аркан ${astro.ARCANA[i]} (${i || 22}): ${k}.`]));
  const kb = path.join(BASE, "kb");  // свои тексты: kb/*.md, чанки по абзацам
  if (fs.existsSync(kb)) for (const f of fs.readdirSync(kb).filter(f => f.endsWith(".md")))
    fs.readFileSync(path.join(kb, f), "utf8").split(/\n\s*\n/).forEach((p, j) => p.trim() && docs.push([`${f.slice(0, -3)}#${j}`, p.trim()]));
  return docs;
}
const tok = t => (t.toLowerCase().match(/[а-яёa-z0-9]+/g) || []).map(w => (w.length > 3 ? w.replace(/(ами|ями|ов|ев|ом|ем|ой|ей|ах|ях|ы|и|а|я|е|у|ю|о)$/, "") : w).slice(0, 6)); // лёгкий стемминг

class BM25 {
  constructor(docs, k1 = 1.5, b = 0.75) {
    this.docs = docs; this.k1 = k1; this.b = b;
    this.tf = docs.map(([t, x]) => { const m = new Map(); tok(t + " " + x).forEach(w => m.set(w, (m.get(w) || 0) + 1)); return m; });
    this.len = this.tf.map(m => [...m.values()].reduce((a, c) => a + c, 0));
    this.avg = this.len.reduce((a, c) => a + c, 0) / docs.length;
    const df = new Map(); this.tf.forEach(m => m.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)));
    this.idf = new Map([...df].map(([w, n]) => [w, Math.log(1 + (docs.length - n + 0.5) / (n + 0.5))]));
  }
  search(q, k = 5) {
    const qs = tok(q), sc = [];
    this.tf.forEach((m, i) => {
      let s = 0;
      for (const w of qs) { const f = m.get(w); if (f) s += this.idf.get(w) * f * (this.k1 + 1) / (f + this.k1 * (1 - this.b + this.b * this.len[i] / this.avg)); }
      if (s > 0) sc.push([s, i]);
    });
    return sc.sort((a, b) => b[0] - a[0]).slice(0, k).map(([s, i]) => ({ title: this.docs[i][0], text: this.docs[i][1], score: +s.toFixed(3) }));
  }
}
const rag = new BM25(buildDocs());

// ---------- API ----------
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }

function chart(r) {
  let { lat, lon, tz } = r;
  if (r.city) {
    const c = astro.CITIES[r.city];
    if (!c) throw new HttpError(404, "город не найден, укажите lat/lon/tz");
    [lat, lon, tz] = c;
  }
  if ([lat, lon, tz].some(v => v == null)) throw new HttpError(422, "нужен city или lat+lon+tz");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) throw new HttpError(422, "date: YYYY-MM-DD");
  let c;
  try { c = astro.natalChart(r.date, r.time || "12:00", +lat, +lon, tz, r.house_system || "whole"); }
  catch (e) { throw new HttpError(422, e.message); }
  c.arcana = astro.arcanaFor(r.date);
  c.interpretations = Object.fromEntries(Object.entries(c.planets).filter(([p]) => p !== "Юж. узел")
    .map(([p, v]) => [p, rag.search(`${p} в знаке ${v.sign} ${p} в ${v.house} доме`, 2)]));
  return c;
}

const readBody = req => new Promise((ok, no) => { let b = ""; req.on("data", d => b += d); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch { no(new HttpError(400, "неверный JSON")); } }); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x"), q = url.searchParams;
  const send = (code, data, type = "application/json; charset=utf-8") => {
    res.writeHead(code, { "Content-Type": type, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
    res.end(typeof data === "string" ? data : JSON.stringify(data));
  };
  try {
    if (req.method === "OPTIONS") return send(204, "");
    if (req.method === "GET" && url.pathname === "/") return send(200, fs.readFileSync(path.join(BASE, "index.html")), "text/html; charset=utf-8");
    if (req.method === "POST" && url.pathname === "/api/chart") return send(200, chart(await readBody(req)));
    if (req.method === "GET" && url.pathname === "/api/arcana") return send(200, astro.arcanaFor(q.get("date") || ""));
    if (req.method === "GET" && url.pathname === "/api/rag") return send(200, rag.search(q.get("q") || "", +q.get("k") || 5));
    if (req.method === "GET" && url.pathname === "/api/cities")
      return send(200, Object.fromEntries(Object.entries(astro.CITIES).map(([k, [lat, lon, tz]]) => [k, { lat, lon, tz }])));
    send(404, { detail: "not found" });
  } catch (e) { send(e.code || 500, { detail: e.message }); }
});
server.listen(PORT, "127.0.0.1", () => console.log(`Astro Local → http://127.0.0.1:${PORT}`));
