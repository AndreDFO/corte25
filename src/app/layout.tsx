import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Corte25 · 25 vídeos para o TikTok Shop",
  description: "Envie ganchos, corpos e CTAs e receba todas as combinações prontas para o TikTok Shop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-white/10">
          <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
            <Link href="/" className="font-extrabold text-xl tracking-tight">
              Corte<span className="text-[#FE2C55]">25</span>
            </Link>
            <span className="text-sm text-white/60">3 × 3 × 3 = 27 vídeos</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/10 py-6 text-center text-xs text-white/40">
          Corte25 · versão de teste
        </footer>
      </body>
    </html>
  );
}
