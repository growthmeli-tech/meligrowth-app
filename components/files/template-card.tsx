import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";

export function TemplateCard({
  title,
  description,
  columns,
  href
}: {
  title: string;
  description: string;
  columns: string[];
  href: string;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-component bg-brand-light text-brand-purple">
          <FileSpreadsheet className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold text-zinc-950">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {columns.map((column) => (
          <span key={column} className="rounded-component bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
            {column}
          </span>
        ))}
      </div>
      <Link href={href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-dark" download>
        <Download className="h-4 w-4" />
        Descargar {title.replace(/^Planilla \d+:\s*/, "")}
      </Link>
    </Card>
  );
}
