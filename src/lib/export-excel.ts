import * as xlsx from 'xlsx';

export function exportReportToExcel(report: any) {
  // Hoja 1: Resumen Diario
  const summaryData = [
    {
      "Fecha": new Date(report.date).toLocaleString(),
      "Fase del Plan": report.planPhase,
      "Día del Plan": report.planDay,
      "Tipo de Cuenta": report.accountType,
      "Balance Final": `$${report.finalBalance?.toFixed(2)}`,
      "Ganancia Neta": `$${report.profit?.toFixed(2)}`,
      "Meta Alcanzada": `${report.profitPercent?.toFixed(2)}%`,
      "Total Operaciones": report.trades,
      "Operaciones Ganadas": report.wins,
      "Operaciones Perdidas": report.losses,
      "Precisión": `${report.trades > 0 ? Math.round((report.wins / report.trades) * 100) : 0}%`
    }
  ];

  // Hoja 2: Desglose por Horas
  const hourlyData = [];
  if (report.hourlyStats) {
    for (const [hour, stats] of Object.entries(report.hourlyStats)) {
      hourlyData.push({
        "Hora": hour,
        "Ganadas": (stats as any).wins,
        "Perdidas": (stats as any).losses,
        "Total Operaciones": (stats as any).wins + (stats as any).losses,
        "Ganancia ($)": (stats as any).profit?.toFixed(2)
      });
    }
  }
  
  if (hourlyData.length === 0) {
    hourlyData.push({ "Hora": "Sin datos", "Ganadas": 0, "Perdidas": 0, "Total Operaciones": 0, "Ganancia ($)": 0 });
  }

  // Crear el libro de trabajo
  const wb = xlsx.utils.book_new();
  
  // Agregar hojas
  const wsSummary = xlsx.utils.json_to_sheet(summaryData);
  xlsx.utils.book_append_sheet(wb, wsSummary, "Resumen Diario");
  
  const wsHourly = xlsx.utils.json_to_sheet(hourlyData);
  xlsx.utils.book_append_sheet(wb, wsHourly, "Desglose Horario");

  // Descargar el archivo
  const fileName = `NeuroTrade_Reporte_Fase${report.planPhase}_Dia${report.planDay}.xlsx`;
  xlsx.writeFile(wb, fileName);
}
