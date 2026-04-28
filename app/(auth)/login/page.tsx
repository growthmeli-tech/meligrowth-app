import { LoginForm } from "@/app/(auth)/login/login-form";

const errorMessages: Record<string, string> = {
  missing: "Ingresá email y password.",
  invalid: "No pudimos validar esas credenciales."
};

export default async function LoginPage({ searchParams }: { searchParams?: Promise<{ error?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const error = resolvedSearchParams.error ? errorMessages[resolvedSearchParams.error] : null;

  return (
    <main className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-4">
      <section className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-[#1A1A1A] flex items-center justify-center text-[#FFD600] font-black text-sm">MG</span>
          <h1 className="text-2xl font-black text-[#1A1A1A]">MELIGROWTH</h1>
        </div>
        <p className="text-sm text-[#6B6B6B] mt-1">La plataforma operativa para sellers de Mercado Libre</p>
        <LoginForm initialError={error} />
        <p className="text-xs text-[#6B6B6B] text-center mt-4">growthmeli@gmail.com</p>
      </section>
    </main>
  );
}
