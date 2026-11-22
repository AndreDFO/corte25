import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderAccount, HeaderAccountFallback } from "./header-account";
import RefBanner from "./ref-banner";
import InAppBanner from "./in-app-banner";
import HomeLink from "./home-link";
import RelatarProblema from "./relatar-problema";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corte25 · 25 vídeos para o TikTok Shop",
  description: "Envie ganchos, corpos e CTAs e receba todas as combinações prontas para o TikTok Shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="claro" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <InAppBanner />
        <RefBanner />
        <header className="border-b border-foreground/10 bg-surface/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-3 py-2 sm:h-16 sm:flex-row sm:justify-between sm:gap-2 sm:px-5 sm:py-0">
            <Link href="/" aria-label="Corte25, página inicial" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG pequeno, não precisa de otimização */}
              <img src="/logo-corte25.svg" alt="Corte25" width={143} height={40} className="h-11 w-auto sm:h-11" />
            </Link>
            {/* Celular: logo em cima e botões embaixo, todos do mesmo tamanho e centralizados (pedido do Andre). */}
            <nav className="flex w-full flex-wrap items-center justify-center gap-1.5 text-sm sm:w-auto sm:flex-nowrap sm:gap-4">
              <span className="hidden lg:inline text-foreground/60">25 vídeos + 2 grátis</span>
              <Suspense fallback={null}>
                <HomeLink />
              </Suspense>
              <Link href="/meus-videos" className="flex-1 whitespace-nowrap rounded-lg bg-foreground/5 px-2 py-2 text-center font-semibold hover:bg-foreground/10 max-[350px]:px-1 max-[350px]:text-xs sm:flex-none sm:px-3 sm:py-1.5">
                Meus vídeos
              </Link>
              <Suspense fallback={<HeaderAccountFallback />}>
                <HeaderAccount />
              </Suspense>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-foreground/10 py-6 text-center text-xs text-foreground/40">
          Corte25 · 25 vídeos + 2 grátis para o TikTok Shop
        </footer>
        <RelatarProblema />
      </body>
    </html>
  );
}
