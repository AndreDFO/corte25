// Dicas de postagem para os vídeos não parecerem repetidos ou spam (pedido do Andre, 23/11).
// Aparece no plano da área Criadores e na página do lote. Não promete evitar banimento.

const DICAS: [string, string][] = [
  ["🗓️", "Espalhe ao longo do dia: com 20 vídeos por dia, poste um a cada 45 minutos, das 7h30 às 21h45. Nada de postar vários de uma vez."],
  ["🔀", "Não poste seguidos dois vídeos que começam com o mesmo gancho. O Corte25 já entrega o lote misturado, mas confira antes de postar o próximo."],
  ["🛍️", "Intercale produtos: poste um de cada vez e só volte ao mesmo produto depois de passar pelos outros (veja o exemplo com 7 produtos abaixo)."],
  ["⏰", "Varie os horários: os picos costumam ser no fim da tarde e à noite (17h às 22h). Evite a madrugada."],
  ["✍️", "Mude um pouco a legenda e as hashtags a cada post. Não copie o mesmo texto em todos."],
  ["🚫", "Não apague e poste de novo o mesmo vídeo. Se um não foi bem, poste outra combinação."],
];

// Ritmo de 20 vídeos por dia (pedido do Andre, 23/11): um a cada 45 minutos, das 7h30 às 21h45 (Brasília, sem madrugada).
// O pico de visualizações é no fim da tarde e à noite (estudos de 2026 da Buffer, 7,1 mi de posts, e da Metricool);
// a grade cobre esse pico inteiro. Pesquisado em 23/11/2026:
// buffer.com/pt/resources/melhor-horario-para-postar-no-tiktok e metricool.com/pt/melhor-horario-postar-tiktok
const POR_DIA = 20;
const INICIO_MIN = 7 * 60 + 30;
const INTERVALO_MIN = 45;
const PRODUTOS = "ABCDEFG";
const CORES = ["bg-brand/30", "bg-accent/20", "bg-sky-200/70", "bg-amber-200/70", "bg-rose-200/70", "bg-emerald-200/70", "bg-foreground/10"];
const hora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
// 7 produtos girando (A, B, C... G, A...): nunca o mesmo produto em seguida, ~3 vídeos de cada por dia,
// e cada vez que o produto volta ele usa outro gancho (G1, G2, G3).
const DIA = Array.from({ length: POR_DIA }, (_, i) => ({ h: hora(INICIO_MIN + i * INTERVALO_MIN), p: i % 7, g: Math.floor(i / 7) + 1 }));

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
      <p className="mt-3 text-xs font-bold text-foreground/60">Exemplo de dia com 20 vídeos e 7 produtos (A a G)</p>
      <div className="mt-1 grid grid-cols-4 gap-1 text-xs sm:grid-cols-5">
        {DIA.map(({ h, p, g }) => (
          <span key={h} className={`whitespace-nowrap rounded-md px-1.5 py-1 ${CORES[p]}`}>
            <b className="tabular-nums">{h}</b> {PRODUTOS[p]}
            <span className="text-foreground/55">·G{g}</span>
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-foreground/60">
        Letra = produto · G1, G2, G3 = gancho diferente cada vez que o produto volta. No dia seguinte, comece pelo produto que vem depois do último
        e use outras combinações do lote.
      </p>
      <p className="mt-2 text-[11px] text-foreground/50">
        Horários de Brasília, sem madrugada. Os estudos de 2026 da Buffer (7 milhões de posts) e da Metricool mostram o pico no fim da tarde e à noite
        (17h às 22h). Confira no TikTok Studio quando os seus seguidores estão mais ativos.
      </p>
      <p className="mt-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
        ⚠️ 20 vídeos por dia é bem acima do que os estudos medem (cerca de 2 por dia, no máximo), então não há dados de como o TikTok trata
        tanto vídeo numa conta só. Com muitos vídeos parecidos a conta pode parecer repetitiva: se puder, divida entre 2 ou 3 contas e capriche na
        variação.
      </p>
    </details>
  );
}
