"use client";

import { useState, useTransition } from "react";
import { login, type LoginState } from "@/app/(auth)/login/actions";

type LoginFormProps = {
  initialError?: string | null;
  redirectTo?: string;
};

export function LoginForm({ initialError = null, redirectTo }: LoginFormProps) {
  const [state, setState] = useState<LoginState>({ error: initialError });
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await login({ error: null }, formData);
      if (result?.error) {
        setState({ error: result.error });
      } else {
        setState({ error: null });
      }
    });
  }

  return (
    <form action={submit} className="mt-6 space-y-3">
      {redirectTo ? <input type="hidden" name="redirect" value={redirectTo} /> : null}
      <div className="space-y-1">
        <label htmlFor="login-email" className="text-sm font-medium text-[#1A1A1A]">
          Email
        </label>
        <input
          id="login-email"
          className="h-11 rounded-lg border border-[#E8E8E2] focus:border-[#FFD600] focus:outline-none px-3 text-sm w-full"
          name="email"
          placeholder="Email"
          type="email"
          required
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="login-password" className="text-sm font-medium text-[#1A1A1A]">
          Contraseña
        </label>
        <input
          id="login-password"
          className="h-11 rounded-lg border border-[#E8E8E2] focus:border-[#FFD600] focus:outline-none px-3 text-sm w-full"
          name="password"
          placeholder="Contraseña"
          type="password"
          required
        />
      </div>
      {state.error ? <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{state.error}</div> : null}
      <button type="submit" className="w-full h-11 bg-[#FFD600] text-[#1A1A1A] font-semibold rounded-lg hover:brightness-95" disabled={isPending}>
        {isPending ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
