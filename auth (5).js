import { HttpError, Reply } from "../router.js";
import { hashPassword, verifyPassword, signToken } from "../lib/auth.js";
import { User } from "../models/user.js";
import { userView } from "../views/presenters.js";

const session = u => ({ token: signToken({ sub: u.id }), user: userView(u) });

export const authController = {
  register({ body: { email, password } }) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || "")) throw new HttpError(422, "invalid email");
    if (typeof password !== "string" || password.length < 8) throw new HttpError(422, "password must be at least 8 characters");
    if (User.byEmail(email)) throw new HttpError(409, "email already registered");
    return new Reply(201, session(User.create({ email, passwordHash: hashPassword(password) })));
  },
  login({ body: { email, password } }) {
    const u = User.byEmail(email || "");
    if (!u || !verifyPassword(password || "", u.passwordHash)) throw new HttpError(401, "invalid credentials");
    return session(u);
  },
  me: ctx => ({ user: userView(ctx.user) }),
};
