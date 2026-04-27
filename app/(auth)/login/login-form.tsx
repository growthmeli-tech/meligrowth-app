"use client";

import { useState, useTransition } from "react";
import { LogIn } from "lucide-react";
import { login, type LoginState } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

type LoginFormProps = {
  initialError?: string | null;
};

export function LoginForm({ initialError = null }: LoginFormProps) {
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
      <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="email" placeholder="Email" type="email" required />
      <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="password" placeholder="Password" type="password" required />
      <Button className="w-full" disabled={isPending}>
        <LogIn className="h-4 w-4" />
        {isPending ? "Ingresando..." : "Ingresar"}
      </Button>
      {state.error ? <div className="rounded-component bg-[#FCEBEB] px-3 py-2 text-sm font-medium text-[#791F1F]">{state.error}</div> : null}
    </form>
  );
}
