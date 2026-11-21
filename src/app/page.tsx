import UploadForm from "./upload-form";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 grid gap-12 lg:grid-cols-[1.1fr_1fr] items-start">
      <section>
        <p className="inline-block rounded-full bg-accent text-white text-xs font-bold px-3 py-1.5 mb-4 sm:mb-6 shadow-sm">
          Para vendedores do TikTok Shop
        </p>
        <h1 className="text-[34px] sm:text-[52px] font-black leading-[1.05] tracking-tight">
          Grave 5 ganchos e 5 corpos.
          <br />
          Receba{" "}
          <span className="inline-block -rotate-2 rounded-xl bg-brand px-3 text-on-brand shadow-[4px_4px_0_0_var(--accent)]">
            25 vídeos
          </span>{" "}
          prontos para vender.
        </h1>
        <a
          href="#criar"
          className="mt-6 flex w-full sm:w-auto sm:inline-flex items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-4 text-lg font-black text-white shadow-[4px_4px_0_0_var(--brand)] hover:translate-y-[-1px] transition lg:hidden"
        >
          Testar grátis agora
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-bold">2 vídeos</span>
        </a>
        <p className="mt-2 text-sm text-foreground/50 lg:hidden">Sem cartão, sem cadastro.</p>
        <p className="mt-6 lg:mt-6 text-foreground/70 text-lg max-w-xl">
          Todo vídeo de TikTok Shop tem três blocos. Trocando um bloco por vez, cada gravação vira dezenas de
          criativos diferentes para testar. O Corte25 monta 25 combinações em 9:16, com texto de gancho, chamada
          para o carrinho e legenda.
        </p>

        <div className="mt-8 flex items-center gap-3 max-w-lg">
          <div className="flex-1 grid gap-2 text-center text-sm font-bold">
            <div className="rounded-xl bg-brand text-on-brand py-3 shadow-sm">Gancho ×5</div>
            <div className="rounded-xl bg-foreground text-background py-3 shadow-sm">Corpo ×5</div>
            <div className="rounded-xl bg-accent text-white py-3 shadow-sm">CTA ×1</div>
          </div>
          <span className="text-3xl font-black text-foreground/30">→</span>
          <div className="rounded-2xl bg-surface px-6 py-5 text-center shadow-lg ring-1 ring-foreground/10">
            <div className="text-5xl font-black leading-none">25</div>
            <div className="mt-1 text-xs font-semibold text-foreground/60">vídeos prontos</div>
          </div>
        </div>
        <p className="mt-3 text-foreground/50 text-sm">5 × 5 × 1 = 25 vídeos por lote</p>

        <ul className="mt-8 grid gap-3 text-foreground/80">
          {[
            "Sempre na ordem certa: gancho, corpo e CTA",
            "Texto de gancho na tela e chamada para o carrinho no final",
            "Legenda e hashtags para cada vídeo",
            "Música de fundo opcional e download de tudo em ZIP",
            "Teste grátis: gere 2 vídeos antes de pagar",
          ].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-on-brand text-xs font-black">
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
      </section>
      <UploadForm />
    </div>
  );
}
