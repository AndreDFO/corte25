import Link from "next/link";
import { currentUser, getProfile } from "@/lib/auth";
import { balance } from "@/lib/credits";
import LogoutButton from "./logout-button";

// No celular os botões dividem a linha por igual (flex-1); no computador ficam do tamanho do texto.
const size = "flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-center font-bold max-[350px]:px-1 max-[350px]:text-xs sm:flex-none sm:px-3 sm:py-1.5";
const btn = `${size} bg-brand text-on-brand hover:bg-brand-dark`;
// Botão Sair: discreto, com borda, dentro da tela.
const out = "rounded-lg border border-foreground/20 px-2.5 py-1 text-xs font-bold text-foreground/70 hover:bg-foreground/5 sm:py-1.5 sm:text-sm";


// Topo do site: sem login mostra "Entrar"; com login mostra "Olá, nome", o saldo em vídeos e "Sair".
export async function HeaderAccount() {
  const user = await currentUser().catch(() => null);
  if (!user) {
    return (
      <Link href="/entrar" className={btn}>
        Entrar
      </Link>
    );
  }
  const [credits, profile] = await Promise.all([balance(user.id).catch(() => null), getProfile(user.id).catch(() => null)]);
  const first = (profile?.name || "").trim().split(/\s/)[0];
  // No celular o "Olá, nome" fica numa linha só dele, acima dos botões, para a pessoa ver que está logada.
  return (
    <>
      {/* Celular: "Olá, nome" e o botão Sair numa linha própria, acima dos botões. */}
      <span className="order-first flex basis-full items-center justify-center gap-2 text-xs sm:order-none sm:basis-auto sm:text-sm">
        {first ? (
          <span className="max-w-40 truncate text-foreground/70 sm:max-w-32" title={user.email || ""}>
            Olá, <b className="text-foreground">{first}</b> 👋
          </span>
        ) : (
          <Link href="/conta#nome" className="text-foreground/70 underline">
            Olá! Toque aqui e coloque seu nome
          </Link>
        )}
        <LogoutButton className={`${out} sm:hidden`} />
      </span>
      <span className="contents sm:flex sm:items-center sm:gap-1">
        <Link
          href="/conta#comprar"
          className={`${size} bg-accent text-white hover:bg-accent-dark`}
        >
          + Comprar
        </Link>
        <Link href="/conta" className={btn} title="Minha conta e saldo">
          {credits === null ? "Minha conta" : `${credits} crédito${credits === 1 ? "" : "s"}`}
        </Link>
      </span>
      <LogoutButton className={`${out} hidden sm:inline-block`} />
    </>
  );
}

export function HeaderAccountFallback() {
  return <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-foreground/10" />;
}
