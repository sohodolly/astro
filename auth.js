import { reactive } from "vue";
export const auth = reactive({ token: localStorage.getItem("token") || "", user: null });

export async function api(path, { method = "GET", body } = {}) {
  const r = await fetch("/api" + path, {
    method, body: body && JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...(auth.token && { Authorization: "Bearer " + auth.token }) },
  });
  const d = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (r.status === 401 && auth.token) logout();
  if (!r.ok) throw new Error(d?.detail || r.statusText);
  return d;
}
export async function refresh() { if (auth.token) try { auth.user = (await api("/auth/me")).user; } catch {} }
export async function enter(mode, email, password) { // mode: login | register
  const d = await api("/auth/" + mode, { method: "POST", body: { email, password } });
  auth.token = d.token; auth.user = d.user; localStorage.setItem("token", d.token);
}
export function logout() { auth.token = ""; auth.user = null; localStorage.removeItem("token"); }
