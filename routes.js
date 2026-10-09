import { Router } from "./router.js";
import { requireAuth } from "./middleware.js";
import { authController as auth } from "./controllers/auth.js";
import { chartController as chart } from "./controllers/chart.js";
import { paymentController as pay } from "./controllers/payment.js";

export function buildRouter() {
  const r = new Router();
  r.get("/api/health", () => ({ ok: true }));
  // публичные (обратная совместимость с v1)
  r.post("/api/chart", chart.calculate);
  r.get("/api/arcana", chart.arcana);
  r.get("/api/rag", chart.rag);
  r.get("/api/cities", chart.cities);
  // аутентификация
  r.post("/api/auth/register", auth.register);
  r.post("/api/auth/login", auth.login);
  r.get("/api/auth/me", requireAuth, auth.me);
  // сохранённые карты (нужен вход)
  r.get("/api/charts", requireAuth, chart.list);
  r.post("/api/charts", requireAuth, chart.save);
  r.delete("/api/charts/:id", requireAuth, chart.remove);
  // платежи
  r.post("/api/payments/checkout", requireAuth, pay.checkout);
  r.post("/api/payments/mock-complete", requireAuth, pay.mockComplete);
  r.post("/api/payments/webhook", pay.webhook);
  return r;
}
