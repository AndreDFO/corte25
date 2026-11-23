// Dicas de postagem para os vídeos não parecerem repetidos ou spam (pedido do Andre, 23/11).
// Aparece no plano da área Criadores e na página do lote. Não promete evitar banimento.

const DICAS: [string, string][] = [
  ["🗓️", "Espalhe ao longo dos dias: 2 ou 3 vídeos por dia, com pelo menos 3 horas entre um e outro. 25 vídeos rendem de 8 a 12 dias."],
  ["🔀", "Não poste seguidos dois vídeos que começam com o mesmo gancho. O Corte25 já entrega o lote misturado, mas confira antes de postar o próximo."],
  ["🛍️", "Intercale produtos: se você vende mais de um, poste um de cada vez (garrafa de manhã, fone à tarde, garrafa à noite)."],
  ["⏰", "Varie os horários (manhã, almoço e noite) e veja nas análises do TikTok quais horários dão mais visualizações."],
  ["✍️", "Mude um pouco a legenda e as hashtags a cada post. Não copie o mesmo texto em todos."],
  ["🚫", "Não apague e poste de novo o mesmo vídeo. Se um não foi bem, poste outra combinação."],
];

const SEMANA = [
  ["Dia 1", "Produto A · vídeo 1", "Produto B · vídeo 1", "Produto A · vídeo 2"],
  ["Dia 2", "Produto B · vídeo 2", "Produto A · vídeo 3", "Produto B · vídeo 3"],
  ["Dia 3", "Produto A · vídeo 4", "Produto B · vídeo 4", "Produto A · vídeo 5"],
];

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
      <p className="mt-3 text-xs font-bold text-foreground/60">Exemplo de calendário (manhã · almoço · noite)</p>
      <div className="mt-1 grid gap-1 text-xs">
        {SEMANA.map(([dia, ...posts]) => (
          <div key={dia} className="grid grid-cols-[3.2rem_1fr_1fr_1fr] gap-1">
            <b className="self-center">{dia}</b>
            {posts.map((p) => (
              <span key={p} className={`rounded-md px-1.5 py-1 ${p.startsWith("Produto A") ? "bg-brand/25" : "bg-accent/15"}`}>
                {p}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-foreground/50">Com um produto só, poste 2 por dia em horários diferentes e use o tempo entre eles para o público ver o anterior.</p>
    </details>
  );
}
