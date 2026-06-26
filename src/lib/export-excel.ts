import * as ExcelJSModule from 'exceljs';
import { saveAs } from 'file-saver';

// Polyfill para lidiar con el import default de Next.js
const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;

export async function exportReportToExcel(report: any) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NeuroTrade Bot';
  wb.created = new Date();

  // ----- COLORES CORPORATIVOS -----
  const theme = {
    headerBg: 'FF0D1117', // Oscuro
    headerFont: 'FFFFFFFF', // Blanco
    successText: 'FF22C55E', // Verde
    dangerText: 'FFEF4444', // Rojo
  };

  // ==========================================
  // HOJA 1: RESUMEN GENERAL
  // ==========================================
  const wsSummary = wb.addWorksheet('Resumen Diario', {
    views: [{ showGridLines: false }]
  });

  wsSummary.getColumn(1).width = 3;
  wsSummary.getColumn(2).width = 25;
  wsSummary.getColumn(3).width = 20;
  wsSummary.getColumn(4).width = 20;
  wsSummary.getColumn(5).width = 25;

  wsSummary.mergeCells('B2:E2');
  const titleCell = wsSummary.getCell('B2');
  titleCell.value = `REPORTE DE OPERACIONES - FASE ${report.planPhase} (Día ${report.planDay})`;
  titleCell.font = { size: 16, bold: true, color: { argb: theme.headerFont } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.headerBg } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  const metrics = [
    ['Fecha', new Date(report.date).toLocaleString()],
    ['Tipo de Cuenta', (report.accountType || '').toUpperCase()],
    ['Total Operaciones', report.trades],
    ['Ganadas / Perdidas', `${report.wins} / ${report.losses}`],
    ['Precisión', `${report.trades > 0 ? Math.round((report.wins / report.trades) * 100) : 0}%`],
    ['Beneficio Neto', report.profit],
    ['Meta Alcanzada', `${report.profitPercent?.toFixed(2)}%`]
  ];

  let row = 4;
  for (const [key, val] of metrics) {
    wsSummary.getCell(`B${row}`).value = key;
    wsSummary.getCell(`B${row}`).font = { bold: true };
    wsSummary.getCell(`C${row}`).value = val as string | number;
    if (key === 'Beneficio Neto') {
      wsSummary.getCell(`C${row}`).numFmt = '"$"#,##0.00';
      const profitNum = Number(val);
      wsSummary.getCell(`C${row}`).font = { bold: true, color: { argb: profitNum >= 0 ? theme.successText : theme.dangerText } };
    }
    row++;
  }

  try {
    const donutConfig = {
      type: 'doughnut',
      data: {
        labels: ['Ganadas', 'Perdidas'],
        datasets: [{ data: [report.wins, report.losses], backgroundColor: ['#22c55e', '#ef4444'] }]
      },
      options: { plugins: { datalabels: { color: '#fff', font: { weight: 'bold', size: 14 } } } }
    };
    const donutUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(donutConfig))}&w=300&h=300&bkg=transparent`;
    const donutRes = await fetch(donutUrl);
    const donutBuffer = await donutRes.arrayBuffer();
    
    const donutImageId = wb.addImage({ buffer: donutBuffer, extension: 'png' });
    wsSummary.addImage(donutImageId, {
      tl: { col: 3, row: 3 },
      ext: { width: 250, height: 250 }
    });

    if (report.hourlyStats) {
      const hLabels = Object.keys(report.hourlyStats);
      const hData = Object.values(report.hourlyStats).map((s: any) => s.profit);
      const hColors = hData.map((v: number) => v >= 0 ? '#22c55e' : '#ef4444');
      
      const barConfig = {
        type: 'bar',
        data: {
          labels: hLabels,
          datasets: [{ label: 'Beneficio Neto ($)', data: hData, backgroundColor: hColors }]
        },
        options: { legend: { display: false }, title: { display: true, text: 'Beneficio por Hora' } }
      };
      const barUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(barConfig))}&w=500&h=250&bkg=white`;
      const barRes = await fetch(barUrl);
      const barBuffer = await barRes.arrayBuffer();
      
      const barImageId = wb.addImage({ buffer: barBuffer, extension: 'png' });
      wsSummary.addImage(barImageId, {
        tl: { col: 1, row: 12 },
        ext: { width: 500, height: 250 }
      });
    }
  } catch (e) {
    console.warn("Fallo al generar gráficos", e);
  }

  const styleTable = (ws: ExcelJS.Worksheet, colCount: number) => {
    ws.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: theme.headerBg } };
      cell.font = { color: { argb: theme.headerFont }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    for (let i = 1; i <= colCount; i++) {
      ws.getColumn(i).width = 18;
    }
  };

  // ==========================================
  // HOJA 2: DESGLOSE HORARIO
  // ==========================================
  const wsHourly = wb.addWorksheet('Desglose Horario');
  wsHourly.addRow(['HORA', 'OPERACIONES', 'GANADAS', 'PERDIDAS', 'BENEFICIO NETO']);

  if (report.hourlyStats) {
    for (const [hour, stats] of Object.entries(report.hourlyStats)) {
      const s = stats as any;
      const profit = s.profit || 0;
      const r = wsHourly.addRow([hour, s.wins + s.losses, s.wins, s.losses, profit]);
      const profitCell = r.getCell(5);
      profitCell.numFmt = '"$"#,##0.00';
      profitCell.font = { color: { argb: profit > 0 ? theme.successText : (profit < 0 ? theme.dangerText : 'FF000000') }, bold: true };
    }
  }
  styleTable(wsHourly, 5);
  wsHourly.addConditionalFormatting({
    ref: `E2:E${Math.max(2, wsHourly.rowCount)}`,
    rules: [{ type: 'dataBar', gradient: false, color: { argb: 'FF22C55E' }, showValue: true, minLength: 0, maxLength: 100 } as any]
  });

  // ==========================================
  // HOJA 3: DESGLOSE DIVISAS
  // ==========================================
  const wsPairs = wb.addWorksheet('Desglose Divisas');
  wsPairs.addRow(['DIVISA (PAR)', 'OPERACIONES', 'GANADAS', 'PERDIDAS', 'BENEFICIO NETO', 'SEMAFORO']);

  if (report.pairStats) {
    for (const [pair, stats] of Object.entries(report.pairStats)) {
      const s = stats as any;
      const profit = s.profit || 0;
      let semaforo = "🟠 NEUTRAL";
      if (profit > 0) semaforo = "🟢 BUENA";
      else if (profit < 0) semaforo = "🔴 MALA";

      const r = wsPairs.addRow([pair, s.wins + s.losses, s.wins, s.losses, profit, semaforo]);
      const profitCell = r.getCell(5);
      profitCell.numFmt = '"$"#,##0.00';
      profitCell.font = { color: { argb: profit > 0 ? theme.successText : (profit < 0 ? theme.dangerText : 'FF000000') }, bold: true };
      r.getCell(6).alignment = { horizontal: 'center' };
    }
  }
  styleTable(wsPairs, 6);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `NeuroTrade_Reporte_Fase${report.planPhase}_Dia${report.planDay}.xlsx`);
}

