import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata = { title: "Entrar · Corte25" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
