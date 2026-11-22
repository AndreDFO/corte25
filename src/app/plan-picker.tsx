"use client";

import { useState } from "react";

// Escolha de pacote compacta: um seletor "Avulso | Mensal" mostra um grupo por vez, em cartões pequenos.
// Na conta (onChoose) seleciona o plano; na janela "Compre créditos" (sem onChoose) cada cartão é um link.
export interface PlanItem {
  id: string;
  videos: number;
  price: string;
  full?: string; // preço cheio riscado (desconto de indicação)
  per: string; // "R$ 0,12 por vídeo"
  tag?: string; // "para testar", "mais econômico"
  highlight?: boolean;
}

export default function PlanPicker({
  avulsos,
  mensais,
  chosen,
  onChoose,
}: {
  avulsos: PlanItem[];
  mensais: PlanItem[];
  chosen?: string | null;
  onChoose?: (id: string) => void;
}) {
  const [tab, setTab] = useState<"avulso" | "mensal">(chosen?.startsWith("assinatura") ? "mensal" : "avulso");
  const list = tab === "avulso" ? avulsos : mensais;
  const tabBtn = (t: "avulso" | "mensal", label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold ${tab === t ? "bg-surface shadow-sm ring-1 ring-foreground/10" : "text-foreground/60"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="grid gap-2">
      <div className="flex gap-1 rounded-xl bg-foreground/5 p-1">
        {tabBtn("avulso", "Avulso")}
        {tabBtn("mensal", "Assinatura mensal")}
      </div>
      <p className="text-[11px] text-foreground/50">
        {tab === "avulso" ? "Paga uma vez, sem mensalidade." : "Vídeos novos todo mês, com o menor preço por vídeo."}
      </p>
      <div className={`grid grid-cols-2 gap-2 ${list.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {list.map((o) => {
          const active = chosen === o.id;
          const cls = `relative block rounded-xl border px-2.5 py-2 text-left leading-tight ${
            active ? "border-brand bg-brand/15 ring-2 ring-brand/40" : o.highlight ? "border-accent bg-accent/10" : "border-foreground/15 hover:bg-foreground/5"
          }`;
          const body = (
            <>
              {o.tag && (
                <span className="absolute -top-2 right-2 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-black uppercase text-white">{o.tag}</span>
              )}
              <span className="block text-sm font-bold">
                {o.videos.toLocaleString("pt-BR")} vídeos{tab === "mensal" ? "/mês" : ""}
              </span>
              <span className="block whitespace-nowrap text-base font-extrabold">
                {o.full && <s className="mr-1 text-[10px] font-semibold text-foreground/40">{o.full}</s>}
                {o.price}
              </span>
              <span className="block text-[10px] text-foreground/55">{o.per}</span>
            </>
          );
          return onChoose ? (
            <button key={o.id} type="button" onClick={() => onChoose(o.id)} className={cls}>
              {body}
            </button>
          ) : (
            <a key={o.id} href={`/conta?comprar=${o.id}`} className={cls}>
              {body}
            </a>
          );
        })}
      </div>
    </div>
  );
}
