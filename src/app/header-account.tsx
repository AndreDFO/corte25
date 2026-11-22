import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { balance } from "@/lib/credits";

const btn = "whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 font-bold text-on-brand hover:bg-brand-dark";

// Botão da conta no topo: com login, mostra o saldo de lotes; sem login, "Entrar".
export async function HeaderAccount() {
  const user = await currentUser().catch(() => null);
  if (!user) {
    return (
      <Link href="/conta" className={btn}>
        Conta
      </Link>
    );
  }
  const credits = await balance(user.id).catch(() => null);
  return (
    <Link href="/conta" className={btn} title="Minha conta">
      {credits === null ? "Conta" : `${credits} lote${credits === 1 ? "" : "s"}`}
    </Link>
  );
}

export function HeaderAccountFallback() {
  return (
    <Link href="/conta" className={btn}>
      Conta
    </Link>
  );
}
