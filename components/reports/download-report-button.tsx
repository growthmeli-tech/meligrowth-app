"use client";

import { Download } from "lucide-react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { DiagnosticPDF } from "@/components/reports/diagnostic-pdf";
import type { DiagnosticReportData } from "@/lib/reports/generate-diagnostic-report";

export function DownloadReportButton({
  reportData,
  disabled = false,
  disabledTooltip = "Creá un diagnóstico primero",
  label = "Descargar reporte"
}: {
  reportData: DiagnosticReportData;
  disabled?: boolean;
  disabledTooltip?: string;
  label?: string;
}) {
  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledTooltip}
        className="inline-flex items-center gap-2 rounded-lg border border-[#E8E8E2] bg-[#F5F5F0] px-4 py-2 text-sm font-semibold text-[#6B6B6B]"
      >
        <Download className="h-4 w-4" />
        {label}
      </button>
    );
  }

  const filename = `reporte-${slugify(reportData.company_name)}-${reportData.fecha}.pdf`;

  return (
    <PDFDownloadLink
      document={<DiagnosticPDF data={reportData} />}
      fileName={filename}
      className="inline-flex items-center gap-2 rounded-lg border border-[#E8E8E2] bg-white px-4 py-2 text-sm font-semibold text-[#1A1A1A] hover:bg-[#F5F5F0]"
    >
      {({ loading }) => (
        <>
          <Download className="h-4 w-4" />
          {loading ? "Generando PDF..." : label}
        </>
      )}
    </PDFDownloadLink>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
