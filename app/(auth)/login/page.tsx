import { LogIn } from "lucide-react";
import { login } from "@/app/(auth)/login/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const errorMessages: Record<string, string> = {
  missing: "Ingresá email y password.",
  invalid: "No pudimos validar esas credenciales."
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = resolvedSearchParams.error ? errorMessages[resolvedSearchParams.error] : null;

  return (
    <main className="grid min-h-screen place-items-center bg-[#FBFBFD] px-4">
      <Card className="w-full max-w-md">
        <BrandLogo className="mx-auto h-24 w-full max-w-xs" priority />
        <p className="mt-5 text-center text-sm text-zinc-600">Ingresá con Supabase Auth. El rol define la redirección a operator o cliente.</p>
        <form action={login} className="mt-6 space-y-3">
          <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="email" placeholder="Email" type="email" />
          <input className="focus-ring h-11 w-full rounded-component border border-black/10 px-3" name="password" placeholder="Password" type="password" />
          {error ? <div className="rounded-component bg-[#FCEBEB] px-3 py-2 text-sm font-medium text-[#791F1F]">{error}</div> : null}
          <Button className="w-full">
            <LogIn className="h-4 w-4" />
            Ingresar
          </Button>
        </form>
      </Card>
    </main>
  );
}
