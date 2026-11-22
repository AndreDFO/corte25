import Link from "next/link";
import { currentUser, getProfile } from "@/lib/auth";
import { balance } from "@/lib/credits";
import LogoutButton from "./logout-button";

const btn = "whitespace-nowrap rounded-lg bg-brand px-2 py-1.5 min-[361px]:px-3 font-bold text-on-brand hover:bg-brand-dark";

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
  const first = (profile?.name || user.email || "").split(/[\s@]/)[0];
  return (
    <>
      <span className="hidden max-w-32 truncate text-foreground/70 md:inline" title={user.email || ""}>
        Olá, <b className="text-foreground">{first}</b>
      </span>
      <span className="flex items-center gap-1">
        <Link href="/conta" className={btn} title="Minha conta e saldo">
          {credits === null ? "Minha conta" : `${credits} crédito${credits === 1 ? "" : "s"}`}
        </Link>
        <Link
          href="/conta#comprar"
          className="whitespace-nowrap rounded-lg bg-accent px-2 py-1.5 font-bold text-white hover:bg-accent-dark min-[361px]:px-2.5"
        >
          + Comprar
        </Link>
      </span>
      <LogoutButton className="hidden text-xs text-foreground/50 underline hover:text-foreground sm:inline" />
    </>
  );
}

export function HeaderAccountFallback() {
  return <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-foreground/10" />;
}
