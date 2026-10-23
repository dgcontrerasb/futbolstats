import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatchFixture, MatchAnalysis, NBAMatchFixture, NBAAnalysis } from '../types';

export interface ExportItem {
  fixture: MatchFixture;
  analysis: MatchAnalysis;
}

export interface NBAExportItem {
  fixture: NBAMatchFixture;
  analysis: NBAAnalysis;
}

// 1. Export to Excel (.csv with UTF-8 BOM for Microsoft Excel & Google Sheets)
export function exportToExcel(items: ExportItem[], fileNamePrefix = 'Pronosticos_Futbol'): void {
  if (!items || items.length === 0) return;

  const headers = [
    'Fecha',
    'Hora (Colombia - COT)',
    'Liga',
    'Equipo Local',
    'Equipo Visitante',
    'Prob. Local (%)',
    'Prob. Empate (%)',
    'Prob. Visitante (%)',
    'Favorito',
    'Marcador Probable',
    'xG Total',
    'Ambos Marcan',
    'Mas de 2.5 Goles (%)',
    'Veredicto / Pronostico'
  ];

  const rows = items.map(({ fixture, analysis }) => {
    const { dixonColes, goalsMarket, verdict } = analysis;
    let favorito = 'Parejo';
    if (dixonColes.pHomeWin >= dixonColes.pAwayWin + 8) favorito = fixture.homeTeam.name;
    else if (dixonColes.pAwayWin >= dixonColes.pHomeWin + 8) favorito = fixture.awayTeam.name;

    const btts = goalsMarket.bttsYes >= 50 ? `Si (${goalsMarket.bttsYes}%)` : `No (${100 - goalsMarket.bttsYes}%)`;
    const cleanVerdict = (verdict.recommendedPicks[0]?.label || verdict.technicalVerdict).replace(/[\r\n",;]+/g, ' ');

    return [
      `"${fixture.date}"`,
      `"${fixture.time}"`,
      `"${fixture.league.name}"`,
      `"${fixture.homeTeam.name}"`,
      `"${fixture.awayTeam.name}"`,
      `${dixonColes.pHomeWin}%`,
      `${dixonColes.pDraw}%`,
      `${dixonColes.pAwayWin}%`,
      `"${favorito}"`,
      `"${dixonColes.mostLikelyScores[0]?.score || '1-1'}"`,
      `${dixonColes.totalXG.toFixed(2)}`,
      `"${btts}"`,
      `${goalsMarket.over25}%`,
      `"${cleanVerdict}"`
    ].join(';');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens with proper accents and character encoding
  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];

  link.setAttribute('href', url);
  link.setAttribute('download', `${fileNamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 2. Export to PDF (Clean, professional, styled sports prediction report)
export function exportToPDF(items: ExportItem[], title = 'Reporte de Pronósticos - Partidos Próximos'): void {
  if (!items || items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const nowStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Title Banner
  doc.setFillColor(15, 23, 42); // Navy background
  doc.rect(0, 0, 842, 60, 'F');

  doc.setTextColor(6, 182, 212); // Cyan accent
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SportStats Pro · Pronósticos', 30, 32);

  doc.setTextColor(241, 245, 249);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`· ${title}`, 265, 32);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.text(`Generado el ${nowStr} · Total de partidos analizados: ${items.length}`, 30, 48);

  const tableHead = [
    ['Fecha/Hora (Colombia)', 'Liga', 'Partido (Local vs Visita)', '1 (Local)', 'X (Empate)', '2 (Visita)', 'Marcador', 'Ambos Marcan', 'Pronóstico Recomendado']
  ];

  const tableBody = items.map(({ fixture, analysis }) => {
    const { dixonColes, goalsMarket, verdict } = analysis;
    const score = dixonColes.mostLikelyScores[0]?.score || '1-1';
    const pick = verdict.recommendedPicks[0]?.label || `Gana ${fixture.homeTeam.shortName}`;

    return [
      `${fixture.date}\n${fixture.time}`,
      fixture.league.name,
      `${fixture.homeTeam.name}\nvs\n${fixture.awayTeam.name}`,
      `${dixonColes.pHomeWin}%`,
      `${dixonColes.pDraw}%`,
      `${dixonColes.pAwayWin}%`,
      `${score}\n(${dixonColes.mostLikelyScores[0]?.probability}%)`,
      goalsMarket.bttsYes >= 50 ? `Sí (${goalsMarket.bttsYes}%)` : `No (${100 - goalsMarket.bttsYes}%)`,
      pick
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 75,
    margin: { left: 30, right: 30 },
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 6,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [8, 145, 178], // Cyan-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 65, halign: 'center' },
      1: { cellWidth: 95 },
      2: { cellWidth: 150, fontStyle: 'bold' },
      3: { cellWidth: 50, halign: 'center', textColor: [5, 150, 105], fontStyle: 'bold' },
      4: { cellWidth: 50, halign: 'center' },
      5: { cellWidth: 50, halign: 'center', textColor: [37, 99, 235], fontStyle: 'bold' },
      6: { cellWidth: 65, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 70, halign: 'center' },
      8: { cellWidth: 180, fontStyle: 'bold', textColor: [15, 23, 42] }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Pronosticos_SportStatsPro_${dateStr}.pdf`);
}

// 3. Export NBA to Excel (.csv)
export function exportNBAToExcel(items: NBAExportItem[], fileNamePrefix = 'Pronosticos_NBA'): void {
  if (!items || items.length === 0) return;

  const headers = [
    'Fecha',
    'Hora (Colombia - COT)',
    'Conferencia',
    'Equipo Local',
    'Equipo Visitante',
    'Estado / Marcador',
    'Prob. Local (%)',
    'Prob. Visitante (%)',
    'Puntos Proyectados Totales',
    'Linea Over/Under',
    'Pace (Posesiones)',
    'Handicap (Spread)',
    '1Q Proyectado',
    '2Q Proyectado',
    '3Q Proyectado',
    '4Q Proyectado',
    'Estrella Local (Pts/3PM)',
    'Estrella Visita (Pts/3PM)'
  ];

  const rows = items.map(({ fixture, analysis }) => {
    const isLive = fixture.status === 'IN_PLAY';
    const statusText = isLive && fixture.currentScore
      ? `EN VIVO (${fixture.currentScore.home}-${fixture.currentScore.away} ${fixture.livePeriod})`
      : fixture.status === 'FINISHED' && fixture.currentScore
      ? `FINAL (${fixture.currentScore.home}-${fixture.currentScore.away})`
      : 'PROGRAMADO';

    const q1 = analysis.quarterProjections.find((q) => q.quarter === 'Q1');
    const q2 = analysis.quarterProjections.find((q) => q.quarter === 'Q2');
    const q3 = analysis.quarterProjections.find((q) => q.quarter === 'Q3');
    const q4 = analysis.quarterProjections.find((q) => q.quarter === 'Q4');

    const starH = analysis.playerProps.find((p) => p.team === fixture.homeTeam.shortName);
    const starA = analysis.playerProps.find((p) => p.team === fixture.awayTeam.shortName);

    const starHText = starH ? `${starH.name}: ${starH.projectedPoints} pts / ${starH.projected3pm} 3PM` : '—';
    const starAText = starA ? `${starA.name}: ${starA.projectedPoints} pts / ${starA.projected3pm} 3PM` : '—';

    return [
      `"${fixture.date}"`,
      `"${fixture.time}"`,
      `"${fixture.homeTeam.conference} vs ${fixture.awayTeam.conference}"`,
      `"${fixture.homeTeam.name}"`,
      `"${fixture.awayTeam.name}"`,
      `"${statusText}"`,
      `${analysis.pHomeWin}%`,
      `${analysis.pAwayWin}%`,
      `${analysis.projectedTotalPoints}`,
      `${analysis.fairTotalLine}`,
      `${analysis.expectedPace}`,
      `"${analysis.fairSpread > 0 ? `+${analysis.fairSpread}` : analysis.fairSpread}"`,
      `"${q1 ? `${q1.projectedHome}-${q1.projectedAway} (O/U ${q1.overLine})` : '—'}"`,
      `"${q2 ? `${q2.projectedHome}-${q2.projectedAway} (O/U ${q2.overLine})` : '—'}"`,
      `"${q3 ? `${q3.projectedHome}-${q3.projectedAway} (O/U ${q3.overLine})` : '—'}"`,
      `"${q4 ? `${q4.projectedHome}-${q4.projectedAway} (O/U ${q4.overLine})` : '—'}"`,
      `"${starHText}"`,
      `"${starAText}"`
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];

  link.setAttribute('href', url);
  link.setAttribute('download', `${fileNamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 4. Export NBA to PDF
export function exportNBAToPDF(items: NBAExportItem[], title = 'Reporte de Pronósticos NBA'): void {
  if (!items || items.length === 0) return;

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const nowStr = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Title Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 842, 60, 'F');

  doc.setTextColor(245, 158, 11); // Amber
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BasketStats NBA Pro', 30, 32);

  doc.setTextColor(241, 245, 249);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`· ${title}`, 225, 32);

  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.text(`Generado el ${nowStr} · Total de partidos NBA: ${items.length}`, 30, 48);

  const tableHead = [
    ['Hora (COL)', 'Partido (Local vs Visita)', 'Prob. Local', 'Prob. Visita', 'Total Pts', 'Ritmo', 'Spread', '1Q Proy', 'Estrella Principal']
  ];

  const tableBody = items.map(({ fixture, analysis }) => {
    const star = analysis.playerProps[0];
    const starText = star ? `${star.name} (${star.projectedPoints} pts, ${star.projected3pm} 3PM)` : '—';
    const q1 = analysis.quarterProjections.find((q) => q.quarter === 'Q1');
    const q1Text = q1 ? `${q1.projectedHome}-${q1.projectedAway}` : '—';

    return [
      `${fixture.time}`,
      `${fixture.homeTeam.name}\nvs\n${fixture.awayTeam.name}`,
      `${analysis.pHomeWin}%`,
      `${analysis.pAwayWin}%`,
      `${analysis.projectedTotalPoints} pts\n(O/U ${analysis.fairTotalLine})`,
      `${analysis.expectedPace}`,
      analysis.fairSpread > 0 ? `+${analysis.fairSpread}` : `${analysis.fairSpread}`,
      q1Text,
      starText
    ];
  });

  autoTable(doc, {
    head: tableHead,
    body: tableBody,
    startY: 75,
    margin: { left: 30, right: 30 },
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 6,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: [217, 119, 6], // Amber-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 60, halign: 'center' },
      1: { cellWidth: 160, fontStyle: 'bold' },
      2: { cellWidth: 60, halign: 'center', textColor: [5, 150, 105], fontStyle: 'bold' },
      3: { cellWidth: 60, halign: 'center', textColor: [37, 99, 235], fontStyle: 'bold' },
      4: { cellWidth: 80, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 55, halign: 'center' },
      6: { cellWidth: 55, halign: 'center' },
      7: { cellWidth: 65, halign: 'center' },
      8: { cellWidth: 185 }
    },
    alternateRowStyles: {
      fillColor: [254, 252, 232]
    }
  });

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`Pronosticos_NBA_${dateStr}.pdf`);
}
