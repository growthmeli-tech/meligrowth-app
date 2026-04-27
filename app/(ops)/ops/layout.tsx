export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F5F0] pb-20 md:pb-0 md:grid md:grid-cols-[220px_1fr]">
      <aside className="hidden md:block border-r border-[#E8E8E2] bg-white p-4">
        <p className="text-sm font-black text-[#1A1A1A]">MELIGROWTH OPS</p>
        <nav className="mt-4 space-y-1">
          <a href="/ops/dashboard" className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#FFD600]/20">
            Dashboard
          </a>
          <a href="/ops/alerts" className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#FFD600]/20">
            Alertas
          </a>
          <a href="/ops/tasks" className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#FFD600]/20">
            Tareas
          </a>
        </nav>
      </aside>

      <main className="p-4 md:p-6">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-[#E8E8E2] bg-white px-2 py-2">
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-[#1A1A1A]">
          <a href="/ops/dashboard" className="text-center py-2 rounded-lg hover:bg-[#F5F5F0]">
            Dashboard
          </a>
          <a href="/ops/alerts" className="text-center py-2 rounded-lg hover:bg-[#F5F5F0]">
            Alertas
          </a>
          <a href="/ops/tasks" className="text-center py-2 rounded-lg bg-[#FFD600]">
            + Diagnostico
          </a>
          <a href="/ops/tasks" className="text-center py-2 rounded-lg hover:bg-[#F5F5F0]">
            Tareas
          </a>
        </div>
      </nav>
    </div>
  );
}
