# Corte25

Site onde o vendedor envia cerca de 5 vídeos de um produto e recebe 25 vídeos 9:16 prontos para o TikTok Shop.

O vendedor grava os vídeos em três blocos e o site monta todas as combinações, sempre na ordem **gancho → corpo → CTA**:

- **Ganchos** (até 5): os primeiros segundos, que fazem a pessoa parar de rolar.
- **Corpos** (até 5): o produto em uso, benefícios, demonstração.
- **CTAs** (até 5): o fechamento, com chamada para o carrinho.

Cada lote entrega sempre **25 vídeos** (5 ganchos × 5 corpos × 1 CTA = 25). Com mais combinações, escolhemos as 25 mais diferentes; com menos, as combinações se repetem com hooks e legendas diferentes até fechar 25. Em cada vídeo:

- Texto de **hook** na tela durante o gancho (criado pelo Claude, ou de modelos prontos sem chave).
- Texto de **chamada para o carrinho** durante o CTA.
- **Legenda e hashtags** para colar no post.
- **Duração máxima** opcional (15, 20, 25 ou 30 s): o corpo é encurtado, gancho e CTA ficam inteiros.
- **Música de fundo** opcional, misturada ao áudio original.

Download de cada vídeo, de todos em ZIP e das legendas em .txt.

## Planos

- **Teste grátis:** gera 2 combinações com marca d'água "Corte25 · teste grátis". Limite de 1 teste por pessoa (contado pelo endereço de internet e pelo navegador; fica em `data/trials.json`).
- **Lote completo (1 crédito):** 25 vídeos. Créditos em pacotes: 10 lotes por R$ 29,90 e 40 lotes por R$ 89,99. O botão fica travado até o pagamento ser configurado. Para testar sem pagar, coloque `UNLOCK_FULL=true` no `.env.local`.
- Preços e limites ficam em `src/lib/pricing.ts`.

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
