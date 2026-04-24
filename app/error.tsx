"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FBFBFD] px-4">
      <div className="w-full max-w-lg rounded-card border border-black/10 bg-white p-6 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-component bg-[#FCEBEB] text-[#791F1F]">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-zinc-950">Algo no salió bien</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {error.digest ? `Código de error: ${error.digest}` : "Probá recargar la vista. Si persiste, revisá logs del servicio."}
        </p>
        <Button className="mt-5" onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    </main>
  );
}
