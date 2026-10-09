import { Collection } from "../db.js";
const payments = new Collection("payments");
export const Payment = {
  create: row => payments.insert({ status: "pending", ...row }),
  bySession: sid => payments.findOne(p => p.sessionId === sid),
  markPaid: id => payments.update(id, { status: "paid", paidAt: new Date().toISOString() }),
};
