import UploadForm from "./upload-form";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-6 lg:py-8 grid gap-6 lg:gap-10 lg:grid-cols-[1.1fr_1fr] items-start">
      <section>
        <p className="inline-block rounded-full bg-accent text-white text-xs font-bold px-3 py-1.5 mb-3 shadow-sm">
          Para vendedores do TikTok Shop
        </p>
        <h1 className="text-[30px] sm:text-[42px] font-black leading-[1.05] tracking-tight">
          Grave 3 ganchos, 3 corpos e 3 CTAs.
          <br />
          Receba{" "}
          <span className="inline-block -rotate-2 rounded-xl bg-brand px-3 text-on-brand shadow-[4px_4px_0_0_var(--accent)]">
            27 vídeos
          </span>
          , e <span className="text-accent-ink">2 são grátis</span>.
        </h1>
        <a
          href="#criar"
          className="mt-4 flex w-full sm:w-auto sm:inline-flex items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-3 text-base font-black text-white shadow-[4px_4px_0_0_var(--brand)] hover:translate-y-[-1px] transition lg:hidden"
        >
          Testar grátis agora
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-bold">2 vídeos</span>
        </a>
        <p className="mt-2 text-sm text-foreground/50 lg:hidden">Sem cartão, sem cadastro.</p>
        <p className="mt-4 text-sm sm:text-base text-foreground/70 max-w-xl">
          O Corte25 combina seus blocos e entrega cada vídeo em 9:16, com texto de gancho, chamada para o carrinho e
          legenda prontos.
        </p>

        <div className="mt-5 flex items-center gap-3 max-w-md">
          <div className="flex-1 grid gap-1.5 text-center text-sm font-bold">
            <div className="rounded-xl bg-brand text-on-brand py-2 shadow-sm">Gancho ×3</div>
            <div className="rounded-xl bg-foreground text-background py-2 shadow-sm">Corpo ×3</div>
            <div className="rounded-xl bg-accent text-white py-2 shadow-sm">CTA ×3</div>
          </div>
          <span className="text-3xl font-black text-foreground/30">→</span>
          <div className="rounded-2xl bg-surface px-5 py-3 text-center shadow-lg ring-1 ring-foreground/10">
            <div className="text-5xl font-black leading-none">27</div>
            <div className="mt-1 text-xs font-semibold text-foreground/60">vídeos prontos</div>
            <div className="mt-2 grid gap-1 text-[11px] font-bold">
              <span className="rounded-full bg-accent px-2 py-0.5 text-white">2 grátis</span>
              <span className="rounded-full bg-brand px-2 py-0.5 text-on-brand">25 no lote</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-foreground/50 text-xs">3 × 3 × 3 = 27 combinações: você testa 2 de graça e libera as outras 25 com 1 crédito.</p>

        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-foreground/80">
          {[
            "Ordem certa: gancho, corpo e CTA",
            "Texto na tela e chamada final",
            "Legenda e hashtags prontas",
            "Música opcional e ZIP com tudo",
          ].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-on-brand text-xs font-black">
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
