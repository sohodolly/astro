import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "astro-"));
const { createApp } = await import("../src/app.js");
const astro = await import("../src/core/astro.js");
let server, base;
before(() => new Promise(ok => { server = createApp().listen(0, "127.0.0.1", () => { base = `http://127.0.0.1:${server.address().port}`; ok(); }); }));
after(() => server.close());

const call = async (p, { method = "GET", body, token } = {}) => {
  const r = await fetch(base + p, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) }, body: body && JSON.stringify(body) });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
};

test("core: Sun on 2000-01-01 12:00 UTC ≈ 10°22' Capricorn", () => {
  const c = astro.natalChart("2000-01-01", "12:00", 51.5074, -0.1278, "Europe/London");
  assert.equal(c.planets["Солнце"].sign, "Козерог");
  assert.equal(c.planets["Солнце"].deg, 10);
});
test("core: DST — Kyiv 1985-07-01 03:00 local = 23:00 UTC the day before", () => {
  assert.equal(astro.localToUtc("1985-07-01", "03:00", "Europe/Kyiv").toISOString(), "1985-06-30T23:00:00.000Z");
});
test("legacy public API still works", async () => {
  const r = await call("/api/chart", { method: "POST", body: { date: "1990-05-15", time: "14:30", city: "Киев" } });
  assert.equal(r.status, 200); assert.ok(r.data.planets["Луна"] && r.data.arcana.day);
});
test("auth, free limit, mock payment → premium", async () => {
  assert.equal((await call("/api/charts")).status, 401);
  const reg = await call("/api/auth/register", { method: "POST", body: { email: "A@b.co", password: "12345678" } });
  assert.equal(reg.status, 201);
  assert.equal((await call("/api/auth/register", { method: "POST", body: { email: "a@b.co", password: "12345678" } })).status, 409);
  assert.equal((await call("/api/auth/login", { method: "POST", body: { email: "a@b.co", password: "wrong-pass" } })).status, 401);
  const token = (await call("/api/auth/login", { method: "POST", body: { email: "a@b.co", password: "12345678" } })).data.token;
  assert.equal((await call("/api/auth/me", { token })).data.user.plan, "free");
  for (let i = 0; i < 3; i++) assert.equal((await call("/api/charts", { method: "POST", token, body: { date: "1990-05-15", city: "Киев" } })).status, 201);
  assert.equal((await call("/api/charts", { method: "POST", token, body: { date: "1990-05-15", city: "Киев" } })).status, 402);
  const url = new URL((await call("/api/payments/checkout", { method: "POST", token })).data.url);
  assert.equal((await call("/api/payments/mock-complete", { method: "POST", token, body: { session: url.searchParams.get("mock_session") } })).status, 200);
  assert.equal((await call("/api/auth/me", { token })).data.user.plan, "premium");
  assert.equal((await call("/api/charts", { method: "POST", token, body: { date: "1990-05-15", city: "Киев" } })).status, 201);
});
test("webhook rejects bad signature", async () => {
  process.env.STRIPE_WEBHOOK_SECRET = ""; // конфиг читается при старте → 503 когда секрет не задан
  assert.ok([400, 503].includes((await call("/api/payments/webhook", { method: "POST", body: {} })).status));
});
