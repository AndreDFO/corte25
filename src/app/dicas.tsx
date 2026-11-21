"use client";

import { useEffect, useState } from "react";

type Exemplo = { angulo: string; tela: string; cena: string; acao: string };
type Bloco = {
  id: string;
  titulo: string;
  tempo: string;
  cor: string;
  fundo: string;
  exemplos: Exemplo[];
  dicas: string[];
};

const BLOCOS: Bloco[] = [
  {
    id: "dica-ganchos",
    titulo: "Ganchos",
    tempo: "2 a 4 s",
    cor: "var(--color-brand-ink)",
    fundo: "linear-gradient(160deg, #e9fbb0, #c8f135)",
    exemplos: [
      { angulo: "Dor", tela: "Cansada de cabelo armado?", cena: "😩", acao: "Mostre o problema" },
      { angulo: "Curiosidade", tela: "Ninguém me contou isso antes", cena: "🤫", acao: "Fale direto pra câmera" },
      { angulo: "Resultado", tela: "Olha o antes e depois", cena: "✨", acao: "Mostre a mudança" },
    ],
    dicas: [
      "Cada gancho com um início diferente: dor, curiosidade, resultado.",
      "O produto ou o problema aparece já no 1º segundo.",
      "Frase curta, falada com energia, celular em pé.",
    ],
  },
  {
    id: "dica-corpos",
    titulo: "Corpos",
    tempo: "8 a 15 s",
    cor: "var(--color-muted)",
    fundo: "linear-gradient(160deg, #3a3b2e, #16170f)",
    exemplos: [
      { angulo: "Demonstração", tela: "Olha como funciona", cena: "🙌", acao: "Produto na mão, em uso" },
      { angulo: "Benefícios", tela: "3 motivos pra ter", cena: "✅", acao: "Um benefício por corte" },
      { angulo: "Unboxing", tela: "Chegou assim", cena: "📦", acao: "Abra a caixa ao vivo" },
    ],
    dicas: [
      "Mostre o produto funcionando, de perto e com boa luz.",
      "Use um ângulo diferente em cada corpo.",
      "Sem pressa: aqui a pessoa decide se quer o produto.",
    ],
  },
  {
    id: "dica-ctas",
    titulo: "CTAs",
    tempo: "3 a 5 s",
    cor: "var(--color-accent-ink)",
    fundo: "linear-gradient(160deg, #b7adff, #8b7bff)",
    exemplos: [
      { angulo: "Carrinho", tela: "Toca no carrinho laranja", cena: "👇", acao: "Aponte para baixo" },
      { angulo: "Oferta", tela: "De R$ 89 por R$ 39", cena: "🏷️", acao: "Mostre o preço" },
      { angulo: "Urgência", tela: "Corre que tá acabando", cena: "⏰", acao: "Fale rápido e animado" },
    ],
    dicas: [
      "Diga o que fazer: tocar no carrinho, garantir o seu.",
      "Mostre a oferta ou o preço, se tiver.",
      "Termine com o produto bem visível.",
    ],
  },
];

function Celular({ bloco }: { bloco: Bloco }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % bloco.exemplos.length), 2000);
    return () => clearInterval(t);
  }, [bloco.exemplos.length]);
  const ex = bloco.exemplos[i];
  const escuro = bloco.id === "dica-corpos";

  return (
    <div className="relative mx-auto aspect-[9/16] w-28 shrink-0 overflow-hidden rounded-[18px] border-4 border-foreground shadow-lg">
      <div key={i} className="dica-cena absolute inset-0 grid grid-rows-[auto_1fr_auto]" style={{ background: bloco.fundo }}>
        <div className="mx-1.5 mt-3 rounded-md bg-white px-1 py-1 text-center text-[9px] font-black leading-tight text-[#16170f]">
          {ex.tela}
        </div>
        <div className="grid place-items-center text-4xl">
          <span className="dica-emoji">{ex.cena}</span>
        </div>
        <div className={`pb-2 text-center text-[9px] font-semibold ${escuro ? "text-white/80" : "text-[#16170f]/70"}`}>
          {ex.acao}
        </div>
      </div>
      <div className="absolute inset-x-0 top-0 flex gap-0.5 p-1">
        {bloco.exemplos.map((_, j) => (
          <span key={j} className="h-0.5 flex-1 overflow-hidden rounded bg-white/40">
            {j === i && <span key={i} className="dica-barra block h-full bg-white" />}
            {j < i && <span className="block h-full bg-white" />}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Dicas() {
  return (
    <section id="dicas" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-10">
      <h2 className="text-2xl font-black tracking-tight">Como gravar cada bloco</h2>
      <p className="mt-1 text-sm text-foreground/60">
        Grave 3 versões diferentes de cada bloco. Quanto mais diferentes, mais combinações boas para testar.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {BLOCOS.map((b) => (
          <div
            key={b.id}
            id={b.id}
            className="scroll-mt-20 flex gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-foreground/10"
          >
            <Celular bloco={b} />
            <div className="grid content-start gap-1.5">
              <span className="text-base font-black" style={{ color: b.cor }}>
                {b.titulo} <span className="text-xs font-semibold text-foreground/50">{b.tempo}</span>
              </span>
              <div className="flex flex-wrap gap-1">
                {b.exemplos.map((e, j) => (
                  <span key={e.angulo} className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold">
                    {j + 1}. {e.angulo}
                  </span>
                ))}
              </div>
              <ul className="grid gap-1 text-xs text-foreground/75">
                {b.dicas.map((d) => (
                  <li key={d} className="flex gap-1.5">
                    <span className="font-black" style={{ color: b.cor }}>•</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
