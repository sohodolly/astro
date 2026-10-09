import { createRouter, createWebHistory } from "vue-router";
import { auth, refresh } from "./auth.js";
import ChartView from "./views/ChartView.vue";
import LoginView from "./views/LoginView.vue";
import AccountView from "./views/AccountView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "chart", component: ChartView },
    { path: "/login", name: "login", component: LoginView },
    { path: "/account", name: "account", component: AccountView, meta: { auth: true } },
    { path: "/:rest(.*)*", redirect: "/" },
  ],
});
router.beforeEach(async to => { // навигационный guard: защита маршрутов
  if (auth.token && !auth.user) await refresh();
  if (to.meta.auth && !auth.user) return { name: "login", query: { next: to.fullPath } };
  if (to.name === "login" && auth.user) return "/account";
});
export default router;
