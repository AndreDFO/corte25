"use client";

export default function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/conta/sair", { method: "POST" });
        try {
          localStorage.removeItem("corte25_jobs"); // lista de lotes deste navegador
        } catch {}
        window.location.href = "/";
      }}
    >
      Sair
    </button>
  );
}
