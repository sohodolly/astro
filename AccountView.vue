<script setup>
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, auth, refresh } from "../auth.js";
const route = useRoute(), router = useRouter();
const charts = ref([]), err = ref(""), info = ref("");
const load = async () => { charts.value = await api("/charts"); };
async function upgrade() {
  err.value = "";
  try { location.href = (await api("/payments/checkout", { method: "POST" })).url; } catch (e) { err.value = e.message; }
}
async function del(id) { await api("/charts/" + id, { method: "DELETE" }); await load(); }
onMounted(async () => {
  try {
    if (route.query.mock_session) await api("/payments/mock-complete", { method: "POST", body: { session: route.query.mock_session } });
    if (route.query.mock_session || route.query.paid) { await refresh(); info.value = "Оплата получена, premium активен ★"; router.replace("/account"); }
    await load();
  } catch (e) { err.value = e.message; }
});
</script>
<template>
  <div class="card">
    <b>{{ auth.user.email }}</b> — план: <b>{{ auth.user.plan }}</b>
    <div v-if="auth.user.plan !== 'premium'" style="margin-top:10px">
      <span class="mut">Free: до 3 сохранённых карт.</span> <button @click="upgrade">Купить premium</button>
    </div>
    <div class="ok">{{ info }}</div><div class="err">{{ err }}</div>
  </div>
  <div class="card"><b>Сохранённые карты</b>
    <p v-if="!charts.length" class="mut">Пока пусто — рассчитайте карту на главной.</p>
    <table v-else>
      <tr v-for="c in charts" :key="c.id">
        <td>{{ c.name }}</td><td class="mut">{{ c.input.date }} {{ c.input.time }} {{ c.input.city }}</td>
        <td>☉ {{ c.summary.sun }}</td><td>☽ {{ c.summary.moon }}</td><td>ASC {{ c.summary.asc }}</td>
        <td><button class="ghost" @click="del(c.id)">✕</button></td>
      </tr>
    </table>
  </div>
</template>
