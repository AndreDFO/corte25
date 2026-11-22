"use client";

import { useState } from "react";

// Campo de senha com o "olhinho" para mostrar ou esconder o que foi digitado.
export default function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  const { className, ...rest } = props;
  return (
    <div className="relative grid">
      <input {...rest} type={show ? "text" : "password"} className={`${className || ""} pr-11`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Esconder senha" : "Mostrar senha"}
        title={show ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-foreground/50 hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {show && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </div>
  );
}
