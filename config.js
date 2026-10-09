const e = process.env;
export const cfg = {
  port: +e.PORT || 8000,
  host: e.HOST || "127.0.0.1",
  secret: e.JWT_SECRET || "dev-secret-change-me",
  dataDir: e.DATA_DIR || "./data",
  publicUrl: e.PUBLIC_URL || "http://localhost:8000",
  stripeKey: e.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: e.STRIPE_WEBHOOK_SECRET || "",
  stripePrice: e.STRIPE_PRICE_ID || "",
  stripeMode: e.STRIPE_MODE || "payment", // payment | subscription
  freeChartLimit: 3,
};
