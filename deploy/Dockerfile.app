# Build the app image: static PWA + API worker in one process.
#   docker build -f deploy/Dockerfile.app -t pakdossier-app .
# Build context is the repo root.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=8080 DIST_DIR=/app/dist WORKER_ENTRY=/app/dist-server/index.js
WORKDIR /app
COPY package.json package-lock.json ./
# only runtime deps (libphonenumber-js is external in the worker bundle)
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY server ./server
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/app.mjs"]
