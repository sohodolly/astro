import crypto from "node:crypto";
import { cfg } from "../config.js";

export const stripeEnabled = () => !!cfg.stripeKey;

async function api(path, params) {
  const r = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.stripeKey, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "stripe error");
  return j;
}

export const createCheckout = user => api("/checkout/sessions", {
  mode: cfg.stripeMode,
  "line_items[0][price]": cfg.stripePrice,
  "line_items[0][quantity]": "1",
  client_reference_id: user.id,
  customer_email: user.email,
  success_url: `${cfg.publicUrl}/account?paid=1`,
  cancel_url: `${cfg.publicUrl}/account`,
});

/** Подпись вебхука: Stripe-Signature = t=<ts>,v1=<hmac_sha256("ts.payload")> */
export function verifyWebhook(raw, header = "") {
  const parts = header.split(",").map(x => x.split("="));
  const t = parts.find(p => p[0] === "t")?.[1];
  const sigs = parts.filter(p => p[0] === "v1").map(p => p[1]);
  if (!t || Math.abs(Date.now() / 1000 - +t) > 300) return null;
  const exp = crypto.createHmac("sha256", cfg.stripeWebhookSecret).update(`${t}.${raw}`).digest("hex");
  const ok = sigs.some(s => s.length === exp.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp)));
  return ok ? JSON.parse(raw) : null;
}
