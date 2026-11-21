import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corte25 · 25 vídeos para o TikTok Shop",
  description: "Envie ganchos, corpos e CTAs e receba todas as combinações prontas para o TikTok Shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-theme="claro" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-foreground/10 bg-surface/70 backdrop-blur">
          <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
            <Link href="/" className="font-extrabold text-xl tracking-tight">
              Corte<span className="ml-0.5 rounded-md bg-brand px-1.5 text-on-brand">25</span>
            </Link>
            <span className="text-sm text-foreground/60">5 ganchos × 5 corpos = 25 vídeos</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-foreground/10 py-6 text-center text-xs text-foreground/40">
          Corte25 · versão de teste
        </footer>
      </body>
    </html>
  );
}
