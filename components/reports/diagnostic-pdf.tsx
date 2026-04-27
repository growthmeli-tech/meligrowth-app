import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { generateDiagnosticReport, type DiagnosticReportData } from "@/lib/reports/generate-diagnostic-report";

const styles = StyleSheet.create({
  page: { backgroundColor: "#F5F5F0", padding: 28, fontFamily: "Helvetica" },
  header: { backgroundColor: "#1A1A1A", padding: 16, flexDirection: "row", justifyContent: "space-between", borderRadius: 8 },
  headerText: { color: "#FFD600", fontSize: 14, fontWeight: 700 },
  headerMeta: { color: "#FFFFFF", fontSize: 10 },
  sectionTitle: { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#6B6B6B", marginBottom: 6 },
  sectionCard: { backgroundColor: "#FFFFFF", borderRadius: 8, border: "1 solid #E8E8E2", padding: 12 },
  heroRow: { marginTop: 12, flexDirection: "row", gap: 10 },
  scoreCard: { flex: 0.48, backgroundColor: "#FFFFFF", borderRadius: 8, border: "1 solid #E8E8E2", padding: 14, alignItems: "center" },
  summaryCard: { flex: 0.52, backgroundColor: "#FFFFFF", borderRadius: 8, border: "1 solid #E8E8E2", padding: 14 },
  scoreNumber: { fontSize: 64, fontWeight: 700 },
  scoreLabel: { marginTop: 2, fontSize: 12, color: "#1A1A1A", fontWeight: 700 },
  scoreContext: { marginTop: 8, fontSize: 9, color: "#6B6B6B" },
  blockRow: { marginTop: 12, flexDirection: "row", gap: 6 },
  blockCard: { padding: 10, borderRadius: 8, flex: 1, alignItems: "center" },
  blockTitle: { fontSize: 8, fontWeight: 700, color: "#1A1A1A" },
  blockScore: { marginTop: 4, fontSize: 16, fontWeight: 700, color: "#1A1A1A" },
  blockStatus: { marginTop: 2, fontSize: 8, color: "#1A1A1A" },
  alertsSection: { marginTop: 12 },
  alertCard: { padding: 10, borderRadius: 8, marginBottom: 6, backgroundColor: "#FFFFFF", borderLeft: "4 solid #E45C23" },
  alertTitle: { fontSize: 10, fontWeight: 700, color: "#1A1A1A" },
  alertDescription: { marginTop: 3, fontSize: 9, color: "#333333" },
  footer: { marginTop: 12, borderTop: "1 solid #E8E8E2", paddingTop: 8, fontSize: 8, color: "#6B6B6B", textAlign: "center" }
});

export function DiagnosticPDF({ data }: { data: DiagnosticReportData }) {
  const report = generateDiagnosticReport(data);
  const topAlerts = report.alertas.slice(0, 3);
  const topActions = report.recomendaciones_top3.slice(0, 3);
  const blocks = [
    { label: "Salud", score: report.score_salud },
    { label: "Publicaciones", score: report.score_publicaciones },
    { label: "Ads", score: report.score_ads },
    { label: "Logística", score: report.score_logistica },
    { label: "Stock", score: report.score_stock }
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerText}>MELIGROWTH</Text>
            <Text style={styles.headerMeta}>Reporte de Salud de Cuenta</Text>
          </View>
          <View>
            <Text style={[styles.headerMeta, { textAlign: "right" }]}>{report.company_name}</Text>
            <Text style={[styles.headerMeta, { textAlign: "right" }]}>{report.fecha}</Text>
          </View>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.sectionTitle}>Score Global</Text>
            <Text style={[styles.scoreNumber, { color: report.score_color }]}>{Math.round(report.score_global)}</Text>
            <Text style={styles.scoreLabel}>{report.estado_label}</Text>
            <Text style={styles.scoreContext}>{`${Math.round(report.score_global)} — ${report.estado_label}`}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Resumen Ejecutivo</Text>
            <Text style={{ fontSize: 11, color: "#1A1A1A" }}>{report.resumen_ejecutivo}</Text>
            <Text style={{ marginTop: 8, fontSize: 9, color: "#6B6B6B" }}>{`Plan: ${report.plan}`}</Text>
          </View>
        </View>

        <View style={styles.blockRow}>
          {blocks.map((block) => (
            <View key={block.label} style={[styles.blockCard, { backgroundColor: getBlockTone(block.score) }]}>
              <Text style={styles.blockTitle}>{block.label.toUpperCase()}</Text>
              <Text style={styles.blockScore}>{Math.round(block.score)}</Text>
              <Text style={styles.blockStatus}>{statusFromScore(block.score)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.alertsSection}>
          <Text style={styles.sectionTitle}>Alertas Prioritarias</Text>
          {topAlerts.map((alert) => (
            <View key={`${alert.titulo}-${alert.prioridad}`} style={[styles.alertCard, { borderLeftColor: borderFromPriority(alert.prioridad) }]}>
              <Text style={styles.alertTitle}>{alert.titulo}</Text>
              <Text style={styles.alertDescription}>{alert.descripcion}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={styles.sectionTitle}>Próximos Pasos</Text>
          <View style={styles.sectionCard}>
            {topActions.map((action, index) => (
              <Text key={`${action.titulo}-${index}`} style={{ fontSize: 10, marginBottom: 4, color: "#1A1A1A" }}>
                {`${index + 1}. ${action.accion_concreta} → Impacto esperado: ${action.impacto_estimado}`}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.footer}>growthmeli@gmail.com · Reporte generado automáticamente por Meli Growth</Text>
      </Page>
    </Document>
  );
}

function getBlockTone(score: number) {
  if (score >= 85) return "#DBF4E5";
  if (score >= 70) return "#E3EDFF";
  if (score >= 55) return "#FDF0D7";
  if (score >= 40) return "#FCE5D8";
  return "#FCE1E1";
}

function statusFromScore(score: number) {
  if (score >= 95) return "Platinum";
  if (score >= 85) return "Muy bueno";
  if (score >= 70) return "Sólido";
  if (score >= 55) return "En desarrollo";
  if (score >= 40) return "En riesgo";
  return "Crítico";
}

function borderFromPriority(priority: string) {
  if (priority === "urgente") return "#C23934";
  if (priority === "alta") return "#E45C23";
  if (priority === "media") return "#D28A00";
  return "#2F6FED";
}
