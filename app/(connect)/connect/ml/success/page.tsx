import Link from "next/link";

export default function ConnectMlSuccessPage() {
  return (
    <main className="min-h-screen bg-[#F5F5F0] px-4 py-16 flex items-center justify-center">
      <div className="max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm space-y-3">
        <p className="text-lg font-bold text-emerald-800">Cuenta conectada correctamente.</p>
        <p className="text-sm text-[#6B6B6B]">Ya podés cerrar esta ventana.</p>
        <Link href="/brand/dashboard" className="inline-block text-sm font-semibold text-[#1A1A1A] underline">
          Ir al panel
        </Link>
      </div>
    </main>
  );
}
