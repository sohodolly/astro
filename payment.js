import crypto from "node:crypto";
import { HttpError } from "../router.js";
import { cfg } from "../config.js";
import { Payment } from "../models/payment.js";
import { User } from "../models/user.js";
import { stripeEnabled, createCheckout, verifyWebhook } from "../services/stripe.js";

function complete(sessionId) { // идемпотентно: повторный вебхук ничего не ломает
  const p = Payment.bySession(sessionId);
  if (p && p.status !== "paid") { Payment.markPaid(p.id); User.setPlan(p.userId, "premium"); }
  return !!p;
}

export const paymentController = {
  async checkout({ user }) {
    if (user.plan === "premium") throw new HttpError(409, "already premium");
    if (!stripeEnabled()) { // dev-режим без ключей Stripe
      const sessionId = "mock_" + crypto.randomUUID();
      Payment.create({ userId: user.id, provider: "mock", sessionId });
      return { provider: "mock", url: `${cfg.publicUrl}/account?mock_session=${sessionId}` };
    }
    try {
      const s = await createCheckout(user);
      Payment.create({ userId: user.id, provider: "stripe", sessionId: s.id });
      return { provider: "stripe", url: s.url };
    } catch (e) { throw new HttpError(502, e.message); }
  },
  mockComplete({ user, body }) { // только когда Stripe не настроен
    if (stripeEnabled()) throw new HttpError(404, "not found");
    const p = Payment.bySession(body.session);
    if (!p || p.userId !== user.id) throw new HttpError(404, "session not found");
    complete(p.sessionId);
    return { ok: true };
  },
  webhook({ req, raw }) {
    if (!cfg.stripeWebhookSecret) throw new HttpError(503, "webhook secret not configured");
    const ev = verifyWebhook(raw, req.headers["stripe-signature"]);
    if (!ev) throw new HttpError(400, "invalid signature");
    if (ev.type === "checkout.session.completed") complete(ev.data.object.id);
    return { received: true };
  },
};
