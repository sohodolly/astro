import { HttpError } from "./router.js";
import { verifyToken } from "./lib/auth.js";
import { User } from "./models/user.js";

export function requireAuth(ctx) {
  const p = verifyToken((ctx.req.headers.authorization || "").replace(/^Bearer /, ""));
  const u = p && User.byId(p.sub);
  if (!u) throw new HttpError(401, "unauthorized");
  ctx.user = u;
}
