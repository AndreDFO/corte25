"use client";

export default function LogoutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/conta/sair", { method: "POST" });
        window.location.href = "/";
      }}
    >
      Sair
    </button>
  );
}
