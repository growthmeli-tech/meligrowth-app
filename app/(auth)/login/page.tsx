import { BrandLogo } from "@/components/brand/brand-logo";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/app/(auth)/login/login-form";

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
        <LoginForm initialError={error} />
      </Card>
    </main>
  );
}
