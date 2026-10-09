<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { enter } from "../auth.js";
const route = useRoute(), router = useRouter();
const mode = ref("login"), email = ref(""), password = ref(""), err = ref("");
async function submit() {
  err.value = "";
  try { await enter(mode.value, email.value, password.value); router.push(route.query.next || "/account"); }
  catch (e) { err.value = e.message; }
}
</script>
<template>
  <form class="card" style="max-width:380px;margin:30px auto;display:grid;gap:10px" @submit.prevent="submit">
    <h3 style="margin:0">{{ mode === "login" ? "Вход" : "Регистрация" }}</h3>
    <input v-model="email" type="email" placeholder="Email" required>
    <input v-model="password" type="password" placeholder="Пароль (мин. 8 символов)" minlength="8" required>
    <button>{{ mode === "login" ? "Войти" : "Создать аккаунт" }}</button>
    <button type="button" class="ghost" @click="mode = mode === 'login' ? 'register' : 'login'">
      {{ mode === "login" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти" }}
    </button>
    <div class="err">{{ err }}</div>
  </form>
</template>
