"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Botão "Início" do topo: aparece em todas as páginas, menos na própria página inicial (pedido do Andre).
// No celular mostra só o ícone da casinha.
export default function HomeLink() {
  if (usePathname() === "/") return null;
  return (
    <Link
      href="/"
      aria-label="Início"
      title="Início"
      className="flex items-center gap-1 rounded-lg px-1.5 py-1.5 sm:px-2 font-semibold text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
      </svg>
      <span className="hidden sm:inline">Início</span>
    </Link>
  );
}
