import Link from "next/link";
import { currentUser, getProfile } from "@/lib/auth";
import { balance } from "@/lib/credits";
import LogoutButton from "./logout-button";

// No celular os botões dividem a linha por igual (flex-1); no computador ficam do tamanho do texto.
const size = "flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-center font-bold max-[350px]:px-1 max-[350px]:text-xs sm:flex-none sm:px-3 sm:py-1.5";
const btn = `${size} bg-brand text-on-brand hover:bg-brand-dark`;


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
  const hello = "order-first basis-full truncate text-center text-xs text-foreground/70 sm:order-none sm:basis-auto sm:max-w-32 sm:text-sm";
  return (
    <>
      {first ? (
        <span className={hello} title={user.email || ""}>
          Olá, <b className="text-foreground">{first}</b> 👋
        </span>
      ) : (
        <Link href="/conta#nome" className={`${hello} underline`}>
          Olá! Toque aqui e coloque seu nome
        </Link>
      )}
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
      <LogoutButton className="hidden text-xs text-foreground/50 underline hover:text-foreground sm:inline" />
    </>
  );
}

export function HeaderAccountFallback() {
  return <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-foreground/10" />;
}
