// Dicas de postagem para os vídeos não parecerem repetidos ou spam (pedido do Andre, 23/11).
// Aparece no plano da área Criadores e na página do lote. Não promete evitar banimento.

const DICAS: [string, string][] = [
  ["🗓️", "Espalhe ao longo dos dias: 2 ou 3 vídeos por dia, com pelo menos 3 horas entre um e outro. 25 vídeos rendem de 8 a 12 dias."],
  ["🔀", "Não poste seguidos dois vídeos que começam com o mesmo gancho. O Corte25 já entrega o lote misturado, mas confira antes de postar o próximo."],
  ["🛍️", "Intercale produtos: poste um de cada vez e só volte ao mesmo produto depois de passar pelos outros (veja o exemplo com 7 produtos abaixo)."],
  ["⏰", "Varie os horários: os picos costumam ser no fim da tarde e à noite (17h às 22h). Evite a madrugada."],
  ["✍️", "Mude um pouco a legenda e as hashtags a cada post. Não copie o mesmo texto em todos."],
  ["🚫", "Não apague e poste de novo o mesmo vídeo. Se um não foi bem, poste outra combinação."],
];

// Horários (Brasília, sem madrugada) a partir dos estudos de 2026 da Buffer (7,1 milhões de posts) e da
// Metricool: picos no fim da tarde e à noite (17h-22h), com bons horários de manhã e no almoço em alguns dias.
// Pesquisado em 23/11/2026: buffer.com/pt/resources/melhor-horario-para-postar-no-tiktok e metricool.com/pt/melhor-horario-postar-tiktok
const HORARIOS: [string, string[]][] = [
  ["Seg", ["08h", "13h", "19h"]],
  ["Ter", ["09h", "16h", "22h"]],
  ["Qua", ["09h", "17h", "21h"]],
  ["Qui", ["13h", "17h", "22h"]],
  ["Sex", ["12h", "18h", "20h"]],
  ["Sáb", ["15h", "17h", "20h"]],
  ["Dom", ["09h", "13h", "20h"]],
];
const PRODUTOS = "ABCDEFG";
const CORES = ["bg-brand/30", "bg-accent/20", "bg-sky-200/70", "bg-amber-200/70", "bg-rose-200/70", "bg-emerald-200/70", "bg-foreground/10"];
// 7 produtos girando: nunca o mesmo produto duas vezes seguidas, e cada um aparece 3 vezes na semana.
const SEMANA = HORARIOS.map(([dia, horas], d) => ({ dia, posts: horas.map((h, i) => ({ h, p: (d * 3 + i) % 7 })) }));

export default function DicasPostagem({ aberto = false, className = "" }: { aberto?: boolean; className?: string }) {
  return (
    <details open={aberto} className={`group rounded-xl bg-surface p-3 text-sm shadow-sm ring-1 ring-foreground/10 ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-black">
        📅 Como postar seus vídeos sem parecer repetido
        <span className="ml-auto text-xs font-bold text-accent-ink group-open:hidden">ver dicas ▾</span>
      </summary>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {DICAS.map(([e, t]) => (
          <li key={t} className="flex gap-2">
            <span>{e}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-bold text-foreground/60">Exemplo de semana com 7 produtos (A a G), 3 posts por dia</p>
      <div className="mt-1 grid gap-1 text-xs">
        {SEMANA.map(({ dia, posts }) => (
          <div key={dia} className="grid grid-cols-[2.4rem_1fr_1fr_1fr] gap-1">
            <b className="self-center">{dia}</b>
            {posts.map(({ h, p }) => (
              <span key={h} className={`whitespace-nowrap rounded-md px-1.5 py-1 ${CORES[p]}`}>
                <b className="tabular-nums">{h}</b> · <span className="hidden sm:inline">Produto </span>
                <span className="sm:hidden">Prod. </span>
                {PRODUTOS[p]}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-foreground/50">
        Horários de Brasília, sem madrugada, baseados nos estudos de 2026 da Buffer (7 milhões de posts) e da Metricool: os melhores resultados ficam no fim da tarde e à
        noite (17h às 22h). Use como ponto de partida e confira no TikTok Studio quando os seus seguidores estão mais ativos.
      </p>
    </details>
  );
}
