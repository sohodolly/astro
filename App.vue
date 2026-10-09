<script setup>
import { useRouter } from "vue-router";
import { auth, logout } from "./auth.js";
const router = useRouter();
const out = () => { logout(); router.push("/"); };
</script>
<template>
  <header>
    <b>✦ Astro Local</b>
    <nav>
      <RouterLink to="/">Карта</RouterLink>
      <template v-if="auth.user">
        <RouterLink to="/account">Кабинет <span v-if="auth.user.plan === 'premium'">★</span></RouterLink>
        <a href="#" @click.prevent="out">Выйти</a>
      </template>
      <RouterLink v-else to="/login">Войти</RouterLink>
    </nav>
  </header>
  <main><RouterView /></main>
</template>
<style>
:root{--bg:#0f1020;--fg:#e8e6f5;--card:#191a33;--ac:#c9a0ff;--mut:#8b89a8}
@media(prefers-color-scheme:light){:root{--bg:#f6f4fb;--fg:#201d33;--card:#fff;--ac:#6b3fc0;--mut:#6d6a85}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px system-ui,sans-serif}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;color:var(--ac)}
nav a{margin-left:16px;color:var(--fg);text-decoration:none}nav a.router-link-exact-active{color:var(--ac)}
main{max-width:980px;margin:auto;padding:0 20px 30px}
.card{background:var(--card);border-radius:12px;padding:16px;margin:14px 0}
input,select,button{padding:9px;border-radius:8px;border:1px solid var(--mut);background:var(--bg);color:var(--fg);font:inherit}
button{background:var(--ac);color:#fff;border:0;cursor:pointer}button.ghost{background:none;color:var(--fg);border:1px solid var(--mut)}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
table{width:100%;border-collapse:collapse}td,th{padding:5px 8px;text-align:left;border-bottom:1px solid #8883}
.mut{color:var(--mut)}.err{color:#e5484d}.ok{color:#30a46c}
</style>
