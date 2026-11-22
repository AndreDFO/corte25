import { Suspense } from "react";
import { isAdmin } from "@/lib/admin";
import { listLeads } from "@/lib/leads";

export const metadata = { title: "Contatos do teste grátis · Corte25", robots: { index: false } };

// Página só do dono (veja src/lib/admin.ts).
function fmtPhone(n: string) {
  const d = n.slice(2);
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

async function Contatos({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await isAdmin())) {
    const erro = (await searchParams).erro;
    return (
      <form method="post" action="/api/admin" className="mx-auto grid max-w-sm gap-3 px-5 py-16">
        <h1 className="text-2xl font-black tracking-tight">Contatos do teste grátis</h1>
        <p className="text-sm text-foreground/60">Página só do dono. Digite a senha que você colocou em ADMIN_KEY no Railway.</p>
        <input
          name="chave"
          type="password"
          required
          autoComplete="current-password"
          aria-label="Senha"
          placeholder="Senha"
          className="rounded-lg border border-foreground/15 bg-field px-3 py-2"
        />
        {erro && (
          <p className="text-sm font-semibold text-brand-ink">
            Senha não confere. Confira se é igual à do Railway (com 12 caracteres ou mais) e se o deploy já terminou.
          </p>
        )}
        <button className="rounded-xl bg-brand py-2.5 font-black text-on-brand hover:bg-brand-dark">Entrar</button>
      </form>
    );
  }
  const all = await listLeads();
  // Um por número, o mais recente primeiro.
  const seen = new Set<string>();
  const leads = all
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter((l) => (seen.has(l.whatsapp) ? false : (seen.add(l.whatsapp), true)));

  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-5 py-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Contatos do teste grátis</h1>
        <p className="text-sm text-foreground/60">
          {leads.length} contato{leads.length === 1 ? "" : "s"}. O botão abre a conversa no seu WhatsApp com uma mensagem pronta, que você pode editar antes de enviar.
        </p>
      </div>
      {leads.length === 0 && <p className="text-foreground/60">Ninguém fez o teste grátis ainda.</p>}
      <ul className="grid gap-2">
        {leads.map((l) => {
          const msg = `Oi! Aqui é do Corte25. Vi que você testou os vídeos do produto "${l.product}". O que achou? Se quiser, te ajudo a gerar o lote completo com 25 vídeos + 2 de bônus.`;
          return (
            <li key={l.whatsapp} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-foreground/10">
              <div className="min-w-0">
                <p className="font-bold">{fmtPhone(l.whatsapp)}</p>
                <p className="truncate text-sm text-foreground/60">
                  {l.product} · {new Date(l.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <a
                href={`https://wa.me/${l.whatsapp}?text=${encodeURIComponent(msg)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-black text-on-brand hover:bg-brand-dark"
              >
                Chamar no WhatsApp
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Page(props: PageProps<"/contatos">) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-foreground/60">Carregando…</p>}>
      <Contatos searchParams={props.searchParams} />
    </Suspense>
  );
}
