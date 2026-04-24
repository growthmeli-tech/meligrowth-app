import { Badge } from "@/components/ui/badge";

export function FileStatusBadge({ processed, error }: { processed: boolean; error?: string }) {
  if (error) return <Badge className="bg-[#FCEBEB] text-[#791F1F]">Error</Badge>;
  if (processed) return <Badge className="bg-[#EAF3DE] text-[#27500A]">Procesado</Badge>;
  return <Badge className="bg-[#FAEEDA] text-[#633806]">Pendiente</Badge>;
}
