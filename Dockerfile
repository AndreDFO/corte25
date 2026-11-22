# Imagem de produção do Corte25 (Railway, Render ou servidor próprio).
# Debian trixie traz FFmpeg 7, que tem o text_align usado nos textos dos vídeos (precisa de 6.1+).
FROM node:22-trixie-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Legenda automática (VIP): whisper.cpp compilado aqui + modelo "small" (q5_1, ~190 MB) que entende português.
# Instruções para CPUs de servidor atuais (AVX2), sem depender da máquina onde o build roda.
FROM debian:trixie-slim AS whisper
RUN apt-get update && apt-get install -y --no-install-recommends git cmake build-essential ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*
# Se algo falhar aqui (ex.: download), o site sobe mesmo assim, só sem a legenda automática.
RUN ( git clone --depth 1 --branch v1.8.7 https://github.com/ggml-org/whisper.cpp /src \
  && cmake -S /src -B /src/build -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_NATIVE=OFF -DGGML_OPENMP=OFF \
     -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_SERVER=OFF \
  && cmake --build /src/build --target whisper-cli -j"$(nproc)" \
  && mkdir -p /opt/whisper && cp /src/build/bin/whisper-cli /opt/whisper/ \
  && curl -fL --retry 3 -o /opt/whisper/ggml-small-q5_1.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin ) \
  || (echo "AVISO: whisper indisponível, legenda automática desligada" && rm -f /opt/whisper/ggml-small-q5_1.bin && mkdir -p /opt/whisper) \
  && rm -rf /src

FROM node:22-trixie-slim
COPY --from=whisper /opt/whisper /opt/whisper
ENV WHISPER_CLI=/opt/whisper/whisper-cli \
    WHISPER_MODEL=/opt/whisper/ggml-small-q5_1.bin
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
