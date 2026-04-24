import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FBFBFD] px-4">
      <div className="w-full max-w-lg rounded-card border border-black/10 bg-white p-6 text-center">
        <h1 className="text-2xl font-bold text-zinc-950">No encontramos esa página</h1>
        <p className="mt-2 text-sm text-zinc-600">La ruta puede haber cambiado o no estar disponible para tu rol.</p>
        <Link href="/operator/dashboard">
          <Button className="mt-5">Volver al panel</Button>
        </Link>
      </div>
    </main>
  );
}
