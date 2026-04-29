import ExcelJS from "exceljs";
import { listUnifiedCatalog, type UnifiedCatalogItem } from "@/lib/data-v2/unified-catalog";

const SHEET = "Catálogo Maestro";

const HDR_GRAY = "FFD9D9D9";
const HDR_BLUE = "FF9DC3E6";
const HDR_YELLOW = "FFFFF494";
const HDR_GREEN = "FFC6EFCE";

function rowTone(item: UnifiedCatalogItem): "red" | "amber" | "orange" | "gray" | "white" {
  if (!item.tiene_costo) return "gray";
  if (item.stock === 0) return "red";
  if (item.margen_en_riesgo) return "amber";
  if (item.precio_desviado) return "orange";
  return "white";
}

function applyRowFill(row: ExcelJS.Row, tone: "red" | "amber" | "orange" | "gray" | "white") {
  const map = {
    red: "FFFFCDD2",
    amber: "FFFFF9C4",
    orange: "FFFFE0B2",
    gray: "FFF5F5F5",
    white: "FFFFFFFF"
  };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: map[tone] }
    };
  });
}

/** Precio venta aproximado por tipo de logística (referencia en Excel). */
function precioFormulaExcel(rowNum: number): string {
  const G = `G${rowNum}`;
  const H = `H${rowNum}`;
  const I = `I${rowNum}`;
  const J = `J${rowNum}`;
  return [
    `IF(OR(${G}="",${J}=""),"",`,
    `IF(${H}="Retiro domicilio",ROUND(${G}/(1-0.1375-${I}-${J}),2),`,
    `IF(${H}="Full",ROUND((${G}+IF(${G}*2<=15000,1095,IF(${G}*2<=25000,2190,IF(${G}*2<=33000,2628,0))))/(1-0.1375-${I}-${J}-0.1),2),`,
    `IF(${H}="Flex",ROUND((${G}+IF(${G}*2<=15999,1255,IF(${G}*2<=23999,2500,IF(${G}*2<=33000,3030,0))))/(1-0.1375-${I}-${J}-0.07),2),`,
    `""))))`
  ].join("");
}

export async function generateMasterCatalogExcel(
  mlAccountId: string,
  options?: { itemIds?: string[] }
): Promise<Buffer> {
  const list = await listUnifiedCatalog(mlAccountId);
  if (!list.success) {
    throw new Error(list.error);
  }

  let rows = list.data;
  if (options?.itemIds?.length) {
    const set = new Set(options.itemIds);
    rows = rows.filter((r) => set.has(r.item_id));
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(SHEET, {
    properties: { defaultRowHeight: 18 }
  });

  sheet.columns = Array.from({ length: 14 }, () => ({ width: 14 }));

  const titles = [
    "Item ID (ML)",
    "Título ML",
    "SKU interno",
    "Precio actual ML",
    "Stock",
    "Vendidos",
    "Costo $",
    "Logística",
    "% Publicidad",
    "% Margen deseado",
    "Notas",
    "Precio venta calc.",
    "Ganancia $",
    "ROI %"
  ];

  const header = sheet.getRow(1);
  titles.forEach((t, i) => {
    const cell = header.getCell(i + 1);
    cell.value = t;
    cell.font = { bold: true, size: 10 };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (i < 3) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDR_GRAY } };
    else if (i < 6) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDR_BLUE } };
    else if (i < 11) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDR_YELLOW } };
    else cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HDR_GREEN } };
  });
  header.height = 28;

  rows.forEach((item, idx) => {
    const r = sheet.getRow(idx + 2);
    const rowNum = idx + 2;

    r.getCell(1).value = item.item_id;
    r.getCell(2).value = item.title;
    r.getCell(3).value = item.seller_custom_field ?? item.sku ?? "";
    r.getCell(4).value = item.price_ml ?? "";
    r.getCell(5).value = item.stock ?? "";
    r.getCell(6).value = item.sold_quantity ?? "";

    const costo = item.costo ?? "";
    r.getCell(7).value = costo === "" ? "" : Number(costo);
    r.getCell(8).value = item.logistica ?? "Flex";
    r.getCell(9).value = item.publicidad_pct ?? 0;
    r.getCell(10).value = item.margen_pct ?? 0.15;
    r.getCell(11).value = "";

    r.getCell(12).value = { formula: precioFormulaExcel(rowNum) };
    r.getCell(13).value = { formula: `IF(L${rowNum}="","",ROUND(L${rowNum}*J${rowNum},2))` };
    r.getCell(14).value = { formula: `IF(OR(G${rowNum}="",L${rowNum}=""),"",ROUND(M${rowNum}/G${rowNum}*100,2))` };

    for (let c = 1; c <= 14; c += 1) {
      r.getCell(c).protection = { locked: true };
    }
    for (const c of [7, 8, 9, 10, 11]) {
      r.getCell(c).protection = { locked: false };
    }

    applyRowFill(r, rowTone(item));
  });

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 2;
    sheet.getCell(`H${rowNum}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: ['"Full,Flex,Retiro domicilio"'],
      showErrorMessage: true,
      errorTitle: "Valor inválido",
      error: "Elegí Full, Flex o Retiro domicilio"
    };
  }

  sheet.protect("meligrowth-catalog", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
