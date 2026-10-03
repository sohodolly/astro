// Расчётное ядро с нуля (Node.js, без зависимостей): JD, эфемериды, дома, аспекты, часовые пояса, арканы.
const rad = x => x * Math.PI / 180, deg = x => x * 180 / Math.PI;
const { sin, cos, tan, atan2, sqrt } = Math;
const norm = x => ((x % 360) + 360) % 360;

export const SIGNS = ["Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева", "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы"];

// Элементы Standish (1800–2050): a, da, e, de, I, dI, L, dL, peri, dperi, node, dnode (на столетие)
const ELEMENTS = {
  "Меркурий": [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  "Венера": [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  "Земля": [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  "Марс": [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  "Юпитер": [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  "Сатурн": [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  "Уран": [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589],
  "Нептун": [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664],
  "Плутон": [39.48211675, -0.00031596, 0.24882730, 0.00005170, 17.14001206, 0.00004818, 238.92903833, 145.20780515, 224.06891629, -0.04062942, 110.30393684, -0.01183482],
};

// Координатная таблица городов: [широта, долгота, IANA-пояс]
export const CITIES = {
  "Киев": [50.4501, 30.5234, "Europe/Kyiv"], "Харьков": [49.9935, 36.2304, "Europe/Kyiv"],
  "Одесса": [46.4825, 30.7233, "Europe/Kyiv"], "Львов": [49.8397, 24.0297, "Europe/Kyiv"],
  "Днепр": [48.4647, 35.0462, "Europe/Kyiv"], "Москва": [55.7558, 37.6173, "Europe/Moscow"],
  "Минск": [53.9006, 27.5590, "Europe/Minsk"], "Варшава": [52.2297, 21.0122, "Europe/Warsaw"],
  "Берлин": [52.52, 13.405, "Europe/Berlin"], "Лондон": [51.5074, -0.1278, "Europe/London"],
  "Париж": [48.8566, 2.3522, "Europe/Paris"], "Нью-Йорк": [40.7128, -74.006, "America/New_York"],
  "Тбилиси": [41.7151, 44.8271, "Asia/Tbilisi"], "Алматы": [43.2389, 76.8897, "Asia/Almaty"],
  "Стамбул": [41.0082, 28.9784, "Europe/Istanbul"], "Токио": [35.6762, 139.6503, "Asia/Tokyo"],
};

// ---------- Время ----------
function tzOffsetMs(utcMs, tz) { // смещение пояса в мс на момент utcMs (через ICU, с историей)
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(utcMs)).map(x => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}
export function localToUtc(date, time, tz) {
  const [y, m, d] = date.split("-").map(Number), [h, mi] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, mi);
  if (isNaN(naive)) throw new Error("неверная дата/время");
  let utc = naive - tzOffsetMs(naive, tz);
  utc = naive - tzOffsetMs(utc, tz); // уточнение у границ DST
  return new Date(utc);
}
export const julianDay = dt => dt.getTime() / 86400000 + 2440587.5;

// ---------- Эфемериды ----------
function helio(name, T) {
  const [a0, da, e0, de, i0, di, L0, dL, p0, dp, n0, dn] = ELEMENTS[name];
  const a = a0 + da * T, e = e0 + de * T, I = rad(i0 + di * T);
  const peri = p0 + dp * T, node = rad(n0 + dn * T);
  const M = rad(((L0 + dL * T - peri) % 360 + 540) % 360 - 180);
  let E = M + e * sin(M);
  for (let i = 0; i < 12; i++) E -= (E - e * sin(E) - M) / (1 - e * cos(E));
  const xv = a * (cos(E) - e), yv = a * sqrt(1 - e * e) * sin(E), w = rad(peri) - node;
  const [cw, sw, cO, sO, cI, sI] = [cos(w), sin(w), cos(node), sin(node), cos(I), sin(I)];
  return [(cw * cO - sw * sO * cI) * xv + (-sw * cO - cw * sO * cI) * yv,
          (cw * sO + sw * cO * cI) * xv + (-sw * sO + cw * cO * cI) * yv];
}
function moon(T) {
  const Lm = 218.3164477 + 481267.88123421 * T, D = rad(297.8501921 + 445267.1114034 * T),
    M = rad(357.5291092 + 35999.0502909 * T), Mp = rad(134.9633964 + 477198.8675055 * T),
    F = rad(93.272095 + 483202.0175233 * T);
  return norm(Lm + 6.288774 * sin(Mp) + 1.274027 * sin(2 * D - Mp) + 0.658314 * sin(2 * D) + 0.213618 * sin(2 * Mp)
    - 0.185116 * sin(M) - 0.114332 * sin(2 * F) + 0.058793 * sin(2 * D - 2 * Mp) + 0.057066 * sin(2 * D - M - Mp)
    + 0.053322 * sin(2 * D + Mp) + 0.045758 * sin(2 * D - M));
}
function lonsAt(jd) {
  const T = (jd - 2451545) / 36525, prec = 1.396971 * T, [ex, ey] = helio("Земля", T);
  const out = { "Солнце": norm(deg(atan2(-ey, -ex)) + prec), "Луна": moon(T) };
  for (const n in ELEMENTS) if (n !== "Земля") { const [x, y] = helio(n, T); out[n] = norm(deg(atan2(y - ey, x - ex)) + prec); }
  out["Сев. узел"] = norm(125.0445479 - 1934.1362891 * T);
  return out;
}
export function planets(jd) {
  const now = lonsAt(jd), nx = lonsAt(jd + 0.05), res = {};
  for (const k in now) {
    const spd = (((nx[k] - now[k] + 540) % 360) - 180) / 0.05;
    res[k] = { lon: now[k], speed: spd, retro: spd < 0 && k !== "Солнце" && k !== "Луна" };
  }
  res["Юж. узел"] = { lon: norm(now["Сев. узел"] + 180), speed: 0, retro: false };
  return res;
}

// ---------- Углы, дома, аспекты ----------
export function angles(jd, lat, lon) {
  const T = (jd - 2451545) / 36525, eps = rad(23.4392911 - 0.0130042 * T);
  const th = rad(norm(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T + lon));
  return [norm(deg(atan2(cos(th), -(sin(th) * cos(eps) + tan(rad(lat)) * sin(eps))))),
          norm(deg(atan2(sin(th), cos(th) * cos(eps))))];
}
const houses = (asc, sys) => Array.from({ length: 12 }, (_, i) => norm((sys === "whole" ? Math.floor(asc / 30) * 30 : asc) + 30 * i));
function houseOf(lon, c) {
  for (let i = 0; i < 12; i++) if (norm(lon - c[i]) < norm(c[(i + 1) % 12] - c[i])) return i + 1;
  return 1;
}
const ASPECTS = [["соединение", 0, 8], ["секстиль", 60, 4], ["квадратура", 90, 6], ["трин", 120, 7], ["оппозиция", 180, 8]];
function aspects(pl) {
  const names = Object.keys(pl).filter(n => n !== "Юж. узел"), out = [];
  names.forEach((a, i) => names.slice(i + 1).forEach(b => {
    let d = Math.abs(pl[a].lon - pl[b].lon) % 360; d = Math.min(d, 360 - d);
    for (const [aspect, ang, orb] of ASPECTS) if (Math.abs(d - ang) <= orb) out.push({ a, b, aspect, orb: +Math.abs(d - ang).toFixed(2) });
  }));
  return out;
}
const fmt = lon => {
  const s = Math.floor(lon / 30), d = lon % 30, deg_ = Math.floor(d), min = Math.floor((d % 1) * 60);
  return { sign: SIGNS[s], deg: deg_, min, text: `${deg_}°${String(min).padStart(2, "0")}' ${SIGNS[s]}` };
};

export function natalChart(date, time, lat, lon, tz, hs = "whole") {
  const utc = localToUtc(date, time, tz), jd = julianDay(utc), pl = planets(jd);
  const [asc, mc] = angles(jd, lat, lon), cusps = houses(asc, hs);
  for (const k in pl) { const v = pl[k]; Object.assign(v, fmt(v.lon), { house: houseOf(v.lon, cusps) }); v.lon = +v.lon.toFixed(4); v.speed = +v.speed.toFixed(4); }
  return { utc: utc.toISOString(), jd: +jd.toFixed(5), tz, asc: { lon: +asc.toFixed(4), ...fmt(asc) },
    mc: { lon: +mc.toFixed(4), ...fmt(mc) }, cusps: cusps.map(c => +c.toFixed(3)), planets: pl, aspects: aspects(pl) };
}

// ---------- Арканы ----------
export const ARCANA = ["Шут", "Маг", "Верховная Жрица", "Императрица", "Император", "Иерофант", "Влюблённые", "Колесница", "Сила",
  "Отшельник", "Колесо Фортуны", "Справедливость", "Повешенный", "Смерть", "Умеренность", "Дьявол", "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир"];
const digits = n => [...String(n)].reduce((s, c) => s + +c, 0);
const red = n => { while (n > 22) n = n <= 44 ? n - 22 : digits(n); return n; };
export function arcanaFor(date) {
  const [y, m, d] = date.split("-").map(Number);
  const A = red(d), B = m, C = red(digits(y)), D = red(A + B + C), E = red(A + B + C + D);
  const nm = n => ({ n, name: ARCANA[n % 22] });
  return { day: nm(A), month: nm(B), year: nm(C), destiny: nm(D), center: nm(E) };
}
