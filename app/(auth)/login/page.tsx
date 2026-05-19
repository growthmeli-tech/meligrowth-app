import { LoginForm } from "@/app/(auth)/login/login-form";

const errorMessages: Record<string, string> = {
  missing: "Ingresá email y password.",
  invalid: "No pudimos validar esas credenciales."
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string; redirect?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = resolvedSearchParams.error ? errorMessages[resolvedSearchParams.error] : null;
  const redirectTo = typeof resolvedSearchParams.redirect === "string" ? resolvedSearchParams.redirect : undefined;

  return (
    <main className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-4">
      <section className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-4xl font-black text-[#FFD600] tracking-tight">MELIGROWTH</h1>
        <p className="text-sm text-[#6B6B6B] mt-1 mb-8">La plataforma operativa para sellers de Mercado Libre</p>
        <LoginForm initialError={error} redirectTo={redirectTo} />
        <p className="text-xs text-[#6B6B6B] text-center mt-4">growthmeli@gmail.com</p>
      </section>
    </main>
  );
}
