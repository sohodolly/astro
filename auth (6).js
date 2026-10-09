// Пароли: scrypt. Токены: JWT HS256, реализованы вручную на node:crypto.
import crypto from "node:crypto";
import { cfg } from "../config.js";

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString("hex") + ":" + crypto.scryptSync(pw, salt, 64).toString("hex");
}
export function verifyPassword(pw, stored) {
  const [s, h] = stored.split(":"), x = crypto.scryptSync(pw, Buffer.from(s, "hex"), 64);
  return crypto.timingSafeEqual(x, Buffer.from(h, "hex"));
}
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const mac = d => crypto.createHmac("sha256", cfg.secret).update(d).digest();
export function signToken(payload, ttl = 7 * 86400) {
  const d = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl });
  return d + "." + mac(d).toString("base64url");
}
export function verifyToken(t) {
  try {
    const [h, b, s] = t.split("."), got = Buffer.from(s, "base64url"), exp = mac(h + "." + b);
    if (got.length !== exp.length || !crypto.timingSafeEqual(got, exp)) return null;
    const p = JSON.parse(Buffer.from(b, "base64url"));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}
