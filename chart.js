import * as astro from "../core/astro.js";
import { rag } from "../services/rag.js";
import { HttpError, Reply } from "../router.js";
import { Chart } from "../models/chart.js";
import { savedChartView } from "../views/presenters.js";
import { cfg } from "../config.js";

function compute(r) { // общая логика; формат ответа /api/chart не менялся (обратная совместимость)
  let { lat, lon, tz } = r;
  if (r.city) {
    const c = astro.CITIES[r.city];
    if (!c) throw new HttpError(404, "город не найден, укажите lat/lon/tz");
    [lat, lon, tz] = c;
  }
  if ([lat, lon, tz].some(v => v == null)) throw new HttpError(422, "нужен city или lat+lon+tz");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) throw new HttpError(422, "date: YYYY-MM-DD");
  let c;
  try { c = astro.natalChart(r.date, r.time || "12:00", +lat, +lon, tz, r.house_system || "whole"); }
  catch (e) { throw new HttpError(422, e.message); }
  c.arcana = astro.arcanaFor(r.date);
  c.interpretations = Object.fromEntries(Object.entries(c.planets).filter(([p]) => p !== "Юж. узел")
    .map(([p, v]) => [p, rag.search(`${p} в знаке ${v.sign} ${p} в ${v.house} доме`, 2)]));
  return c;
}

export const chartController = {
  calculate: ctx => compute(ctx.body),
  arcana: ctx => astro.arcanaFor(ctx.query.date || ""),
  cities: () => Object.fromEntries(Object.entries(astro.CITIES).map(([k, [lat, lon, tz]]) => [k, { lat, lon, tz }])),
  rag: ctx => rag.search(ctx.query.q || "", +ctx.query.k || 5),

  list: ctx => Chart.byUser(ctx.user.id).map(savedChartView),
  save(ctx) {
    if (ctx.user.plan !== "premium" && Chart.byUser(ctx.user.id).length >= cfg.freeChartLimit)
      throw new HttpError(402, `free plan is limited to ${cfg.freeChartLimit} saved charts, upgrade to premium`);
    const { name, ...input } = ctx.body, c = compute(input);
    const { city, lat, lon, tz, date, time, house_system } = input;
    return new Reply(201, savedChartView(Chart.create({
      userId: ctx.user.id, name: name || date, input: { city, lat, lon, tz, date, time, house_system },
      summary: { sun: c.planets["Солнце"].text, moon: c.planets["Луна"].text, asc: c.asc.text },
    })));
  },
  remove(ctx) {
    const c = Chart.byIdForUser(ctx.params.id, ctx.user.id);
    if (!c) throw new HttpError(404, "chart not found");
    Chart.remove(c.id);
    return new Reply(204, null);
  },
};
