# Imagem de produção do Corte25 (Railway, Render ou servidor próprio).
# Debian trixie traz FFmpeg 7, que tem o text_align usado nos textos dos vídeos (precisa de 6.1+).
FROM node:22-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/assets ./assets
COPY --from=build /app/next.config.ts ./
# Pasta dos vídeos (24 h). No Railway, ligue um volume em /data pelo painel
# (o Railway não aceita a instrução VOLUME no Dockerfile).
RUN mkdir -p /data
EXPOSE 3000
# O Railway informa a porta em $PORT.
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
