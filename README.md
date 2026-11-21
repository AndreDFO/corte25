# Corte25

Site onde o vendedor envia cerca de 5 vídeos de um produto e recebe 25 vídeos 9:16 prontos para o TikTok Shop.

Cada um dos 25 vídeos sai diferente:

- **Hook** diferente na tela nos 3 primeiros segundos (criado pelo Claude, ou de modelos prontos sem chave).
- **Ordem das cenas**, trechos usados, duração (15, 30 ou 60 s; no modo "Misturar" saem 10 de 15 s, 10 de 30 s e 5 de 60 s), zoom, velocidade e cor diferentes.
- **Chamada para o carrinho** no final ("Toca no carrinho laranja").
- **Legenda e hashtags** para colar no post.
- **Música de fundo** opcional (enviada pelo usuário) misturada ao áudio original.

Download de cada vídeo, de todos em ZIP e das legendas em .txt.

## Como rodar

Precisa de **Node.js 20+** e **FFmpeg 6.1+** instalados.

- Windows: `winget install Gyan.FFmpeg`
- Mac: `brew install ffmpeg`

```bash
npm install
cp .env.example .env.local   # e coloque sua ANTHROPIC_API_KEY (opcional)
npm run build
npm start                    # abre em http://localhost:3000
```

Para desenvolver: `npm run dev`.

## Como funciona

| Parte | Arquivo |
| --- | --- |
| Tela de envio | `src/app/page.tsx`, `src/app/upload-form.tsx` |
| Progresso e galeria | `src/app/tarefa/[id]/job-view.tsx` |
| API (envio, status, arquivos, ZIP) | `src/app/api/jobs/**` |
| Motor de vídeo (FFmpeg) | `src/lib/engine.ts` |
| Hooks e legendas (Claude) | `src/lib/copy.ts` |
| Tarefas salvas em disco | `src/lib/jobs.ts` (pasta `data/`) |

O processamento roda no próprio servidor Node, 2 vídeos por vez. Com 5 vídeos de entrada, as 25 variações levam alguns minutos.

## Próximas etapas

- Login de usuários e limite de vídeos por plano.
- Assinatura e pagamento.
- Armazenamento na nuvem e fila de processamento separada para escalar.
- Legendas faladas automáticas (transcrição) e mais estilos de texto.

Fonte Inter (licença SIL OFL) em `assets/fonts`.
