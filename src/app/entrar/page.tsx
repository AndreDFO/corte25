import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata = {
  title: "Entrar · Corte25",
  description: "Entre ou crie sua conta no Corte25 para gerar vídeos para o TikTok Shop.",
  alternates: { canonical: "/entrar" },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
