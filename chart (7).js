import { Collection } from "../db.js";
const charts = new Collection("charts");
export const Chart = {
  byUser: uid => charts.find(c => c.userId === uid),
  create: row => charts.insert(row),
  byIdForUser: (id, uid) => charts.findOne(c => c.id === id && c.userId === uid),
  remove: id => charts.remove(id),
};
