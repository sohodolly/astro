# --- 1) сборка Vue-фронтенда ---
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package.json ./
RUN npm install
COPY frontend ./
RUN npx vite build --outDir /out --emptyOutDir

# --- 2) рантайм: Node без зависимостей ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 DATA_DIR=/data
COPY package.json server.js ./
COPY src ./src
COPY kb ./kb
COPY public ./public
COPY --from=web /out ./public/app
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s CMD wget -qO- http://127.0.0.1:8000/api/health || exit 1
CMD ["node", "server.js"]
