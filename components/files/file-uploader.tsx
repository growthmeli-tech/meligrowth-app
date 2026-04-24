"use client";

import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FileUploader({ action }: { action: (formData: FormData) => void }) {
  return (
    <form action={action} className="rounded-card border border-dashed border-brand-purple/50 bg-white p-6 text-center">
      <label className="focus-ring flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-component hover:bg-brand-light">
        <UploadCloud className="h-10 w-10 text-brand-purple" />
        <span className="mt-4 text-base font-semibold text-zinc-950">Arrastrá o seleccioná una plantilla</span>
        <span className="mt-2 max-w-lg text-sm text-zinc-600">CSV, XLSX u ODS con SKUs, stock, márgenes o fichas técnicas. Tamaño máximo: 10 MB.</span>
        <input className="mt-5 max-w-full text-sm" name="file" type="file" accept=".csv,.xlsx,.ods" required />
      </label>
      <Button className="mt-5" type="submit">
        <UploadCloud className="h-4 w-4" />
        Subir archivo
      </Button>
    </form>
  );
}
