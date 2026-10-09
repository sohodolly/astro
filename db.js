// Мини-хранилище: JSON-файл на коллекцию, атомарная запись. Для продакшна замените на SQL (интерфейс тот же).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { cfg } from "./config.js";

export class Collection {
  constructor(name) {
    fs.mkdirSync(cfg.dataDir, { recursive: true });
    this.file = path.join(cfg.dataDir, name + ".json");
    this.rows = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, "utf8")) : [];
  }
  save() { const t = this.file + ".tmp"; fs.writeFileSync(t, JSON.stringify(this.rows, null, 1)); fs.renameSync(t, this.file); }
  insert(r) { r = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...r }; this.rows.push(r); this.save(); return r; }
  find(fn) { return this.rows.filter(fn); }
  findOne(fn) { return this.rows.find(fn); }
  update(id, patch) { const r = this.rows.find(x => x.id === id); if (r) { Object.assign(r, patch); this.save(); } return r; }
  remove(id) { this.rows = this.rows.filter(r => r.id !== id); this.save(); }
}
