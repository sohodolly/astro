import { Collection } from "../db.js";
const users = new Collection("users");
export const User = {
  byEmail: e => users.findOne(u => u.email === e.toLowerCase()),
  byId: id => users.findOne(u => u.id === id),
  create: ({ email, passwordHash }) => users.insert({ email: email.toLowerCase(), passwordHash, plan: "free" }),
  setPlan: (id, plan) => users.update(id, { plan }),
};
