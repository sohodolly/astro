import { createApp } from "./src/app.js";
import { cfg } from "./src/config.js";
if (cfg.secret === "dev-secret-change-me" && process.env.NODE_ENV === "production") { console.error("Set JWT_SECRET in production"); process.exit(1); }
createApp().listen(cfg.port, cfg.host, () => console.log(`Astro Local → http://${cfg.host}:${cfg.port}`));
