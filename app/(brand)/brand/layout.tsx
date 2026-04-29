import { TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <header className="border-b border-[#E8E8E2] bg-white">
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
          <span className="text-sm font-black text-[#1A1A1A]">MELIGROWTH</span>
          <a href="/brand/dashboard" className="text-sm font-semibold text-[#1A1A1A]">
            Dashboard
          </a>
          <a
            href="/brand/profitability"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B6B6B] hover:text-[#1A1A1A]"
          >
            <TrendingUp className="h-4 w-4" aria-hidden />
            Rentabilidad
          </a>
          <a href="/brand/metrics" className="text-sm font-semibold text-[#6B6B6B] hover:text-[#1A1A1A]">
            Metricas
          </a>
          <a href="/brand/files" className="text-sm font-semibold text-[#6B6B6B] hover:text-[#1A1A1A]">
            Planillas
          </a>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
