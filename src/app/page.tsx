import UploadForm from "./upload-form";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 grid gap-12 lg:grid-cols-[1.1fr_1fr] items-start">
      <section>
        <p className="inline-block rounded-full bg-accent/10 text-accent-ink text-xs font-semibold px-3 py-1 mb-5">
          Para vendedores do TikTok Shop
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
          Grave 3 ganchos, 3 corpos e 3 CTAs.
          <br />
          Receba <span className="text-brand-ink">27 vídeos</span> prontos para vender.
        </h1>
        <p className="mt-5 text-foreground/70 text-lg max-w-xl">
          Todo vídeo de TikTok Shop tem três blocos. Trocando um bloco por vez, cada gravação vira dezenas de
          criativos diferentes para testar. Nós montamos todas as combinações em 9:16, com texto de gancho, chamada
          para o carrinho e legenda.
        </p>
        <div className="mt-8 grid grid-cols-3 gap-3 max-w-md text-center text-sm font-semibold">
          <div className="rounded-lg border border-brand/50 bg-brand/10 py-3 text-brand-ink">Gancho</div>
          <div className="rounded-lg border border-foreground/20 bg-foreground/5 py-3 text-foreground/70">Corpo</div>
          <div className="rounded-lg border border-accent/50 bg-accent/10 py-3 text-accent-ink">CTA</div>
        </div>
        <p className="mt-3 text-foreground/50 text-sm">3 × 3 × 3 = 27 variações · 5 × 5 × 5 = 125</p>
        <ul className="mt-8 grid gap-3 text-foreground/80">
          {[
            "Sempre na ordem certa: gancho, corpo e CTA",
            "Texto de gancho na tela e chamada para o carrinho no final",
            "Legenda e hashtags para cada vídeo",
            "Música de fundo opcional e download de tudo em ZIP",
            "Teste grátis: gere 2 vídeos antes de pagar",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="text-brand-ink font-bold">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </section>
      <UploadForm />
    </div>
  );
}
