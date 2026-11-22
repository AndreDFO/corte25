import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderAccount, HeaderAccountFallback } from "./header-account";
import RefBanner from "./ref-banner";
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
          <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
            <Link href="/" className="font-extrabold text-xl tracking-tight">
              Corte<span className="ml-0.5 rounded-md bg-brand px-1.5 text-on-brand">25</span>
            </Link>
            <nav className="flex items-center gap-2 sm:gap-4 text-sm">
              <span className="hidden lg:inline text-foreground/60">25 vídeos + 2 grátis</span>
              <Link href="/" className="hidden sm:inline-block rounded-lg px-2 py-1.5 font-semibold text-foreground/70 hover:bg-foreground/5 hover:text-foreground">
                Início
              </Link>
              <Link href="/meus-videos" className="whitespace-nowrap rounded-lg bg-foreground/5 px-3 py-1.5 font-semibold hover:bg-foreground/10">
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
