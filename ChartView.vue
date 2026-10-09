<script setup>
import { ref, reactive, onMounted } from "vue";
import { api, auth } from "../auth.js";
const cities = ref([]), chart = ref(null), err = ref(""), msg = ref(""), name = ref("");
const f = reactive({ date: "1990-05-15", time: "14:30", city: "Киев", house_system: "whole" });
onMounted(async () => { cities.value = Object.keys(await api("/cities")); });
async function calc() { err.value = msg.value = ""; try { chart.value = await api("/chart", { method: "POST", body: f }); } catch (e) { err.value = e.message; } }
async function save() {
  err.value = msg.value = "";
  try { await api("/charts", { method: "POST", body: { ...f, name: name.value } }); msg.value = "Сохранено в кабинете"; }
  catch (e) { err.value = e.message; }
}
</script>
<template>
  <form class="card row" @submit.prevent="calc">
    <input v-model="f.date" type="date" required><input v-model="f.time" type="time">
    <select v-model="f.city"><option v-for="c in cities" :key="c">{{ c }}</option></select>
    <select v-model="f.house_system"><option value="whole">Целые знаки</option><option value="equal">Равные дома</option></select>
    <button>Рассчитать</button>
  </form>
  <div class="err">{{ err }}</div>
  <template v-if="chart">
    <div class="card">
      <div class="mut">UTC {{ chart.utc }} · {{ chart.tz }}</div>
      <table>
        <tr><th>Тело</th><th>Позиция</th><th>Дом</th></tr>
        <tr><td>ASC</td><td>{{ chart.asc.text }}</td><td></td></tr>
        <tr><td>MC</td><td>{{ chart.mc.text }}</td><td></td></tr>
        <tr v-for="(p, n) in chart.planets" :key="n"><td>{{ n }}{{ p.retro ? " ℞" : "" }}</td><td>{{ p.text }}</td><td>{{ p.house }}</td></tr>
      </table>
    </div>
    <div class="card"><b>Арканы</b>
      <div v-for="(a, k) in chart.arcana" :key="k">{{ k }}: {{ a.n }} {{ a.name }}</div>
    </div>
    <div class="card"><b>Интерпретации (RAG)</b>
      <p v-for="(l, p) in chart.interpretations" :key="p"><b>{{ p }}</b><br>{{ l.map(x => x.text).join(" ") }}</p>
    </div>
    <div class="card row" v-if="auth.user">
      <input v-model="name" placeholder="Название карты"><button @click="save">Сохранить карту</button>
      <span class="ok">{{ msg }}</span>
    </div>
    <div class="card mut" v-else><RouterLink to="/login">Войдите</RouterLink>, чтобы сохранять карты.</div>
  </template>
</template>
