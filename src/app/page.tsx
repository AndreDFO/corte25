import UploadForm from "./upload-form";

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12 grid gap-12 lg:grid-cols-[1.1fr_1fr] items-start">
      <section>
        <p className="inline-block rounded-full bg-[#25F4EE]/10 text-[#25F4EE] text-xs font-semibold px-3 py-1 mb-5">
          Para vendedores do TikTok Shop
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
          Suba 5 vídeos do seu produto.
          <br />
          Receba <span className="text-[#FE2C55]">25 vídeos</span> prontos para vender.
        </h1>
        <p className="mt-5 text-white/70 text-lg max-w-xl">
          Nosso agente corta, reordena as cenas, cria hooks diferentes para os 3 primeiros segundos,
          escreve legendas e chamadas para o carrinho. Tudo em 9:16, pronto para postar.
        </p>
        <ul className="mt-8 grid gap-3 text-white/80">
          {[
            "25 hooks com ângulos diferentes (dor, curiosidade, prova social, oferta…)",
            "Vídeos de 15, 20, 25 ou 30 segundos, com cenas, cortes, zoom e ritmo diferentes",
            "Chamada para o carrinho no final e legenda com hashtags",
            "Música de fundo opcional e download de tudo em ZIP",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <span className="text-[#FE2C55] font-bold">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </section>
      <UploadForm />
    </div>
  );
}
