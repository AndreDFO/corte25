import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderAccount, HeaderAccountFallback } from "./header-account";
import RefBanner from "./ref-banner";
import HomeLink from "./home-link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corte25 · 25 vídeos para o TikTok Shop",
  description: "Envie ganchos, corpos e CTAs e receba todas as combinações prontas para o TikTok Shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="claro" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <RefBanner />
        <header className="border-b border-foreground/10 bg-surface/70 backdrop-blur">
          <div className="mx-auto max-w-6xl px-3 sm:px-5 h-16 flex items-center justify-between gap-2">
            <Link href="/" aria-label="Corte25, página inicial" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG pequeno, não precisa de otimização */}
              <img src="/logo-corte25.svg" alt="Corte25" width={143} height={40} className="h-7 w-auto min-[400px]:h-8 sm:h-9" />
            </Link>
            <nav className="flex items-center gap-1 text-sm max-[360px]:text-xs min-[361px]:gap-1.5 sm:gap-4">
              <span className="hidden lg:inline text-foreground/60">25 vídeos + 2 grátis</span>
              <Suspense fallback={null}>
                <HomeLink />
              </Suspense>
              <Link href="/meus-videos" className="whitespace-nowrap rounded-lg bg-foreground/5 px-2 py-1.5 font-semibold hover:bg-foreground/10 sm:px-3">
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
      </body>
    </html>
  );
}
