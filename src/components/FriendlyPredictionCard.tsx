import React, { useState, useMemo } from 'react';
import { Shield, Trophy, Goal, Award, Check, TrendingUp, Radio, ExternalLink, Sparkles, Calculator, Percent, ChevronDown, ChevronUp, HelpCircle, BookOpen, Flag } from 'lucide-react';
import { MatchFixture, MatchAnalysis } from '../types';
import { getSoccerDidacticAdvice, formatOddsPayout } from '../services/didacticService';

interface FriendlyPredictionCardProps {
  fixture: MatchFixture;
  analysis: MatchAnalysis;
  onOpenSimulator?: (fixture: MatchFixture) => void;
  isSelected?: boolean;
  onToggleSelect?: (fixtureId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  viewMode?: 'SIMPLE' | 'EXPERT';
  mobileLightweight?: boolean;
}

export const FriendlyPredictionCard: React.FC<FriendlyPredictionCardProps> = React.memo(({
  fixture,
  analysis,
  onOpenSimulator,
  isSelected = false,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  viewMode = 'SIMPLE',
  mobileLightweight = false
}) => {
  const { dixonColes, goalsMarket, cornersMarket, refereeCards, verdict } = analysis;

  const [localExpanded, setLocalExpanded] = useState<boolean>(false);
  const expanded = isExpanded !== undefined ? isExpanded : localExpanded;

  const handleToggleExpand = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setLocalExpanded((prev) => !prev);
    }
  };

  // Selección predeterminada basada en la opción de mayor probabilidad del modelo
  const defaultSelection = useMemo<'1' | 'X' | '2'>(() => {
    if (dixonColes.pHomeWin >= dixonColes.pDraw && dixonColes.pHomeWin >= dixonColes.pAwayWin) return '1';
    if (dixonColes.pAwayWin >= dixonColes.pHomeWin && dixonColes.pAwayWin >= dixonColes.pDraw) return '2';
    return 'X';
  }, [dixonColes.pHomeWin, dixonColes.pDraw, dixonColes.pAwayWin]);

  // Estado local para la calculadora de Valor Esperado (+EV) y Kelly
  const [selectedBetSide, setSelectedBetSide] = useState<'1' | 'X' | '2'>(defaultSelection);
  const [inputOdds, setInputOdds] = useState<string>('');

  // Cálculo matemático en tiempo real de EV y Kelly Fraccional (25%)
  const evMetrics = useMemo(() => {
    const oddsNum = parseFloat(inputOdds);
    if (isNaN(oddsNum) || oddsNum <= 1) {
      return { evPercent: null, kellyStake: null, isPositive: false };
    }

    let prob = dixonColes.pHomeWin / 100;
    if (selectedBetSide === 'X') prob = dixonColes.pDraw / 100;
    if (selectedBetSide === '2') prob = dixonColes.pAwayWin / 100;

    // EV = (P * (Cuota - 1)) - (1 - P)
    const ev = (prob * (oddsNum - 1)) - (1 - prob);
    const evPercent = (ev * 100).toFixed(1);
    const isPositive = ev > 0;

    // Criterio de Kelly al 25% (Quarter Kelly)
    let kellyStake = 0;
    if (isPositive) {
      const fullKelly = ((prob * oddsNum) - 1) / (oddsNum - 1);
      kellyStake = Math.max(0, fullKelly * 0.25 * 100);
    }

    return {
      evPercent,
      kellyStake: kellyStake.toFixed(1),
      isPositive
    };
  }, [inputOdds, selectedBetSide, dixonColes]);

  // Favorite team label
  let favoriteTeam = 'Empate o muy parejo';
  if (dixonColes.pHomeWin >= dixonColes.pAwayWin + 8) {
    favoriteTeam = fixture.homeTeam.name;
  } else if (dixonColes.pAwayWin >= dixonColes.pHomeWin + 8) {
    favoriteTeam = fixture.awayTeam.name;
  }

  // Most likely exact score
  const mostLikelyScore = dixonColes.mostLikelyScores[0]?.score || '1-1';
  const mostLikelyScorePct = dixonColes.mostLikelyScores[0]
    ? dixonColes.mostLikelyScores[0].probability.toFixed(1)
    : '11.0';

  const bttsAnswer = goalsMarket.bttsYes >= 52 ? 'Sí, ambos marcan' : 'Poco probable';

  // H2H statistics summary
  const h2h = fixture.h2h || {
    totalMatches: 5,
    homeWins: 2,
    draws: 1,
    awayWins: 2
  };

  // Live score direct link (Universal live match tracker)
  const liveScoreUrl = (() => {
    const home = fixture.homeTeam.name;
    const away = fixture.awayTeam.name;
    return `https://www.google.com/search?q=${encodeURIComponent(`${home} vs ${away} marcador en vivo`)}`;
  })();

  // Value bet opportunity check
  const isValueBet = Boolean(analysis.marketOdds?.valueBetDetected);

  // Consejo y semáforo didáctico para principiantes
  const didacticAdvice = useMemo(() => {
    return getSoccerDidacticAdvice(fixture, analysis);
  }, [fixture, analysis]);

  const topSafePick = verdict.topSafePick;
  const homeShort = fixture.homeTeam.shortName || fixture.homeTeam.name;
  const awayShort = fixture.awayTeam.shortName || fixture.awayTeam.name;

  return (
    <div
      className={`${
        mobileLightweight
          ? 'rounded-lg border overflow-hidden transition-colors duration-150'
          : 'neon-running-card cyber-card transition-all'
      } ${
        isSelected
          ? 'ring-1.5 ring-[#00ff66] shadow-[#00ff66]/20'
          : isValueBet
          ? 'value-bet-glow ring-1 ring-amber-400/60'
          : mobileLightweight
          ? 'border-[#30363d] bg-[#161b22]'
          : ''
      }`}
    >
      <div className={mobileLightweight ? 'bg-[#161b22] flex flex-col' : 'neon-card-inner'}>
        {/* 1. Header: Competición y Hora Colombia */}
        <div className="px-3.5 sm:px-4 py-2 border-b border-[#30363d] flex flex-wrap items-center justify-between gap-2 text-xs bg-[#0b0e14]/90">
          <div className="flex items-center gap-2 min-w-0">
            {fixture.league.flag && fixture.league.flag.startsWith('http') ? (
              <img
                src={fixture.league.flag}
                alt={fixture.league.country || fixture.league.name}
                className="w-4 h-3 object-cover rounded shadow-xs inline-block shrink-0 border border-[#30363d]"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="text-sm shrink-0">{fixture.league.flag || '🏆'}</span>
            )}
            <span className="font-bold text-white tracking-wide uppercase text-[11px]">
              {fixture.league.name}
            </span>
            <span className="text-[#6e7681]">·</span>
            <span className="text-[#8b949e] text-[11px]">{fixture.league.round}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 text-xs flex-wrap font-mono tabular-nums">
              {fixture.status === 'IN_PLAY' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span>EN VIVO {fixture.currentScore?.minute ? `· ${fixture.currentScore.minute}'` : ''}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-bold text-[#00ff66]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66] animate-pulse"></span>
                  {fixture.time} COL
                </span>
              )}
              <span className="text-[#6e7681]">·</span>
              <span className="text-[#8b949e]">{fixture.date}</span>
              {fixture.derbyOrRivalry && (
                <>
                  <span className="text-[#6e7681]">·</span>
                  <span className="text-amber-400 font-bold uppercase text-[10px] tracking-wider">Clásico</span>
                </>
              )}
              {isValueBet && (
                <>
                  <span className="text-[#6e7681]">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-300 font-bold text-[10px] tracking-wider uppercase bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/40 animate-pulse">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                    +EV +{analysis.marketOdds?.valueEdgePercent}%
                  </span>
                </>
              )}
            </div>

            {onToggleSelect && (
              <button
                onClick={() => onToggleSelect(fixture.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#00ff66] text-black font-bold shadow-sm'
                    : 'bg-[#21262d] hover:bg-[#30363d] text-[#8b949e] hover:text-white border border-[#30363d]'
                }`}
                title={isSelected ? 'Quitar de mi selección' : 'Seleccionar este partido'}
              >
                <Check className={`w-3 h-3 ${isSelected ? 'stroke-[3]' : 'text-[#8b949e]'}`} />
                <span>{isSelected ? 'Listo' : 'Elegir'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Face-off: Equipos y Escudos (Clickeable para desplegar) */}
        <div
          onClick={handleToggleExpand}
          className="relative p-3.5 sm:p-4 overflow-hidden cursor-pointer hover:bg-white/[0.015] transition-colors"
          title={expanded ? 'Clic para contraer' : 'Clic para ver análisis completo'}
        >
          <div className="relative z-10 grid grid-cols-12 items-center gap-2 sm:gap-4">
            {/* Local */}
            <div className="col-span-5 flex items-center justify-end gap-2.5 sm:gap-3 text-right">
              <div>
                <div className="text-[10px] font-mono text-[#00ff66] font-bold tracking-wider uppercase mb-0.5">
                  Local · #{fixture.homeTeam.rank}
                </div>
                <h3 className="text-xs sm:text-base font-bold text-white tracking-tight leading-tight">
                  {fixture.homeTeam.name}
                </h3>
                <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-[#8b949e]">
                  <span className="font-mono tabular-nums text-white">
                    {fixture.homeTeam.avgShotsOnTarget} tiros arco · ~{cornersMarket.lambdaHomeCorners} córners
                  </span>
                </div>
              </div>

              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[#0b0e14] border border-[#30363d] p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                <img
                  src={fixture.homeTeam.logo}
                  alt={fixture.homeTeam.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                />
              </div>
            </div>

            {/* VS o Marcador En Vivo */}
            <div className="col-span-2 text-center flex flex-col items-center justify-center">
              {fixture.status === 'IN_PLAY' && fixture.currentScore ? (
                <div className="flex flex-col items-center px-2 py-0.5 rounded bg-[#0b0e14] border border-[#00ff66]/40 shadow-sm">
                  <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#00ff66]">
                    {fixture.currentScore.home} - {fixture.currentScore.away}
                  </span>
                  <span className="text-[9px] font-mono tabular-nums text-rose-400 font-bold animate-pulse">
                    {fixture.currentScore.minute}'
                  </span>
                </div>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-md bg-[#0b0e14] border border-[#30363d] flex items-center justify-center text-[9px] font-mono font-bold tracking-widest text-[#8b949e] shadow-inner">
                    VS
                  </div>
                  <span className="text-[10px] font-mono tabular-nums font-bold text-white mt-0.5 whitespace-nowrap">
                    {fixture.time}
                  </span>
                </>
              )}
            </div>

            {/* Visitante */}
            <div className="col-span-5 flex items-center justify-start gap-2.5 sm:gap-3 text-left">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-[#0b0e14] border border-[#30363d] p-1.5 flex items-center justify-center shrink-0 shadow-inner">
                <img
                  src={fixture.awayTeam.logo}
                  alt={fixture.awayTeam.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                />
              </div>

              <div>
                <div className="text-[10px] font-mono text-blue-400 font-bold tracking-wider uppercase mb-0.5">
                  Visitante · #{fixture.awayTeam.rank}
                </div>
                <h3 className="text-xs sm:text-base font-bold text-white tracking-tight leading-tight">
                  {fixture.awayTeam.name}
                </h3>
                <div className="mt-0.5 flex items-center justify-start gap-1.5 text-[10px] text-[#8b949e]">
                  <span className="font-mono tabular-nums text-white">
                    {fixture.awayTeam.avgShotsOnTarget} tiros arco · ~{cornersMarket.lambdaAwayCorners} córners
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen Compacto Multi-Mercado y Guía para Principiantes */}
        <div className="px-3.5 sm:px-4 py-2.5 border-t border-[#30363d] bg-[#161b22] space-y-2">
          {/* Bloque Principal: La Jugada Más Segura del Partido (Mayor Probabilidad Real) */}
          <div className="p-3 sm:p-3.5 rounded-lg border border-[#00ff66]/30 bg-[#0b0e14] shadow-sm transition-all">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00ff66]">
                  {didacticAdvice.badgeLabel}
                </span>
                {topSafePick && (
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                    topSafePick.riskLevel === 'Riesgo Bajo'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                  }`}>
                    {topSafePick.riskLevel}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#00ff66] font-mono tabular-nums font-bold bg-[#161b22] px-2.5 py-1 rounded-md border border-[#30363d] shadow-inner">
                {didacticAdvice.payoutExample}
              </span>
            </div>

            <div className="pt-1">
              <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                {didacticAdvice.headline}
              </p>
              <p className="text-xs text-[#cbd5e1] leading-relaxed mt-1 font-normal">
                {didacticAdvice.plainExplanation}
              </p>
            </div>
          </div>

          {/* Tablero de los 4 Mercados Más Seguros del Partido (Goles, Córners, Tarjetas y Doble Oportunidad) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            {/* Caja 1: Jugada #1 Más Factible del Partido */}
            <div className="p-2.5 rounded-md bg-[#0b0e14] border border-[#00ff66]/40 flex flex-col justify-center">
              <span className="text-[10px] text-[#00ff66] font-mono font-bold uppercase tracking-wider">
                ⭐ #1 Más Probable
              </span>
              <span className="text-xs sm:text-sm font-bold text-white truncate mt-0.5" title={topSafePick?.label}>
                {topSafePick?.label || favoriteTeam}
              </span>
              <span className="text-xs font-mono tabular-nums font-bold text-[#00ff66]">
                {topSafePick?.probability || Math.max(dixonColes.pHomeWin, dixonColes.pAwayWin)}% prob. · @{topSafePick?.fairOdd.toFixed(2)}
              </span>
              <span className="text-[10px] text-[#94a3b8] font-sans mt-0.5 truncate">
                ({topSafePick?.categoryLabel || 'Mayor probabilidad'})
              </span>
            </div>

            {/* Caja 2: Mercado de Tiros de Esquina (Córners) */}
            <div className="p-2.5 rounded-md bg-[#0b0e14] border border-[#30363d] flex flex-col justify-center">
              <span className="text-[10px] text-[#94a3b8] font-mono font-bold uppercase tracking-wider">
                🚩 Tiros de Esquina
              </span>
              <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono tabular-nums mt-0.5 truncate">
                {cornersMarket.recommendedLine.replace('Tiros de Esquina', 'Córners')}
              </span>
              <span className="text-xs font-mono tabular-nums text-white font-bold">
                {cornersMarket.recommendedProb}% prob.
              </span>
              <span className="text-[10px] text-[#94a3b8] font-mono tabular-nums mt-0.5">
                ({cornersMarket.expectedTotalCorners} esp: {cornersMarket.lambdaHomeCorners}+{cornersMarket.lambdaAwayCorners})
              </span>
            </div>

            {/* Caja 3: Mercado de Tarjetas Amarillas */}
            <div className="p-2.5 rounded-md bg-[#0b0e14] border border-[#30363d] flex flex-col justify-center">
              <span className="text-[10px] text-[#94a3b8] font-mono font-bold uppercase tracking-wider">
                🟨 Tarjetas Partido
              </span>
              <span className="text-xs sm:text-sm font-bold text-yellow-300 font-mono tabular-nums mt-0.5 truncate">
                {refereeCards.recommendedCardPick.replace(' en el partido', '')}
              </span>
              <span className="text-xs font-mono tabular-nums text-white font-bold">
                {refereeCards.recommendedCardProb}% prob.
              </span>
              <span className="text-[10px] text-[#94a3b8] font-mono tabular-nums mt-0.5">
                (~{refereeCards.expectedYellowCards} esp: {refereeCards.expectedHomeYellows}+{refereeCards.expectedAwayYellows})
              </span>
            </div>

            {/* Caja 4: Goles Seguros y Doble Oportunidad */}
            <div className="p-2.5 rounded-md bg-[#0b0e14] border border-[#30363d] flex flex-col justify-center">
              <span className="text-[10px] text-[#94a3b8] font-mono font-bold uppercase tracking-wider">
                🛡️ Goles / Doble Op.
              </span>
              <span className="text-xs sm:text-sm font-bold text-cyan-300 font-mono tabular-nums mt-0.5 truncate">
                {goalsMarket.over15 >= Math.max(goalsMarket.doubleChance1X, goalsMarket.doubleChanceX2)
                  ? '+1.5 Goles Totales'
                  : goalsMarket.doubleChance1X >= goalsMarket.doubleChanceX2
                  ? `1X (${homeShort} o Emp)`
                  : `X2 (${awayShort} o Emp)`}
              </span>
              <span className="text-xs font-mono tabular-nums text-white font-bold">
                {Math.max(goalsMarket.over15, goalsMarket.doubleChance1X, goalsMarket.doubleChanceX2)}% prob.
              </span>
              <span className="text-[10px] text-[#94a3b8] font-mono tabular-nums mt-0.5">
                (Marcador: {mostLikelyScore} · {goalsMarket.bttsYes}% BTTS)
              </span>
            </div>
          </div>

          {/* Botón Principal Desplegable */}
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleToggleExpand}
              className={`flex-1 py-2 px-3.5 rounded-md border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                expanded
                  ? 'bg-[#161b22] border-[#00ff66]/50 text-[#00ff66] hover:bg-[#21262d]'
                  : 'bg-[#161b22] hover:bg-[#21262d] border-[#30363d] text-[#00ff66]'
              }`}
            >
              <span>
                {expanded
                  ? 'Ocultar desglose de Córners, Tarjetas, Goles y +EV'
                  : '🔬 Ver análisis completo (Córners, Tarjetas por equipo, Goles, 1X2 y +EV)'}
              </span>
              {expanded ? <ChevronUp className="w-4 h-4 text-[#00ff66]" /> : <ChevronDown className="w-4 h-4 text-[#00ff66]" />}
            </button>

            {onOpenSimulator && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSimulator(fixture);
                }}
                className="py-2 px-3 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-white/10 hover:border-emerald-500/30 text-xs font-semibold text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Simulador Monte Carlo"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Simular</span>
              </button>
            )}
          </div>
        </div>

        {/* Sección de Análisis Detallado (Visible al Desplegar) */}
        {expanded && (
          <div className="space-y-0">
            <div className="px-4 sm:px-5 pt-3 pb-4 space-y-3.5 border-t border-white/10">
              {/* NUEVO: Ranking Top Mercados Más Seguros del Partido */}
              <div className="p-3 rounded-xl bg-slate-950/50 border border-emerald-500/30 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                    🏆 Ranking de Mercados Más Factibles (Ordenados por Probabilidad Real)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Priorizando seguridad sobre el ganador 1X2
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {verdict.allRankedPicks.slice(0, 3).map((pick, idx) => (
                    <div
                      key={pick.id}
                      className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                        idx === 0
                          ? 'bg-emerald-950/40 border-emerald-500/50 ring-1 ring-emerald-500/20'
                          : 'bg-slate-900/70 border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-300">
                          #{idx + 1} · {pick.categoryLabel}
                        </span>
                        <span className="text-xs font-mono tabular-nums font-black text-emerald-400">
                          {pick.probability}%
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white my-1">{pick.label}</div>
                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400">
                        <span>Cuota justa @{pick.fairOdd.toFixed(2)}</span>
                        <span className="text-emerald-300">{pick.riskLevel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* NUEVO: Desglose de Tiros de Esquina (Córners) y Tarjetas por Equipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Panel Córners */}
                <div className="p-3 rounded-xl bg-slate-950/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                      🚩 Proyección de Tiros de Esquina
                    </span>
                    <span className="text-xs font-mono tabular-nums font-black text-white">
                      {cornersMarket.expectedTotalCorners} córners esp.
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono tabular-nums">
                    <div className="p-1.5 rounded-lg bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-sans">{homeShort}</span>
                      <span className="font-bold text-emerald-400">~{cornersMarket.lambdaHomeCorners} córners</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-sans">{awayShort}</span>
                      <span className="font-bold text-blue-400">~{cornersMarket.lambdaAwayCorners} córners</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-mono tabular-nums pt-0.5">
                    <div className="p-1.5 rounded bg-slate-900/50 border border-white/5">
                      <span className="text-[9px] text-slate-400 block">+7.5 Córners</span>
                      <span className="font-bold text-emerald-300">{cornersMarket.over75}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/50 border border-white/5">
                      <span className="text-[9px] text-slate-400 block">+8.5 Córners</span>
                      <span className="font-bold text-amber-300">{cornersMarket.over85}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/50 border border-white/5">
                      <span className="text-[9px] text-slate-400 block">+9.5 Córners</span>
                      <span className="font-bold text-slate-200">{cornersMarket.over95}%</span>
                    </div>
                  </div>
                </div>

                {/* Panel Tarjetas */}
                <div className="p-3 rounded-xl bg-slate-950/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-yellow-300">
                      🟨 Proyección de Tarjetas ({fixture.referee?.rigor || refereeCards.rigor})
                    </span>
                    <span className="text-xs font-mono tabular-nums font-black text-white">
                      ~{refereeCards.expectedYellowCards} amarillas
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono tabular-nums">
                    <div className="p-1.5 rounded-lg bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-sans">{homeShort}</span>
                      <span className="font-bold text-yellow-300">~{refereeCards.expectedHomeYellows} amarillas</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-900/70 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-sans">{awayShort}</span>
                      <span className="font-bold text-yellow-300">~{refereeCards.expectedAwayYellows} amarillas</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-mono tabular-nums pt-0.5">
                    <div className="p-1.5 rounded bg-slate-900/50 border border-white/5">
                      <span className="text-[9px] text-slate-400 block">+3.5 Tarjetas</span>
                      <span className="font-bold text-emerald-300">{refereeCards.over35CardsProb}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/50 border border-white/5">
                      <span className="text-[9px] text-slate-400 block">+4.5 Tarjetas</span>
                      <span className="font-bold text-amber-300">{refereeCards.over45CardsProb}%</span>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900/50 border border-white/5">
                      <span className="text-[9px] text-slate-400 block">-4.5 Tarjetas</span>
                      <span className="font-bold text-slate-200">{refereeCards.under45CardsProb}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* NUEVO: Doble Oportunidad, Goles Seguros y Goles por Mitad */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono tabular-nums">
                <div className="p-2 rounded-xl bg-slate-950/35 border border-white/10">
                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Local o Empate (1X)</span>
                  <span className="text-sm font-black text-emerald-400">{goalsMarket.doubleChance1X}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/35 border border-white/10">
                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Visita o Empate (X2)</span>
                  <span className="text-sm font-black text-blue-400">{goalsMarket.doubleChanceX2}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/35 border border-white/10">
                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Más de 1.5 Goles</span>
                  <span className="text-sm font-black text-amber-300">{goalsMarket.over15}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/35 border border-white/10">
                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Gol en 1.ª Mitad</span>
                  <span className="text-sm font-black text-slate-200">{goalsMarket.firstHalfGoalProb}%</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950/35 border border-white/10 col-span-2 sm:col-span-1">
                  <span className="text-[9px] text-slate-400 uppercase font-sans font-bold block">Gol en 2.ª Mitad</span>
                  <span className="text-sm font-black text-emerald-300">{goalsMarket.secondHalfGoalProb}%</span>
                </div>
              </div>

              {/* Fila de Probabilidades Ganador 1X2 (Local / Empate / Visitante) */}
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                {/* Local */}
                <div className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
                  dixonColes.pHomeWin >= 48
                    ? 'bg-emerald-950/35 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/20'
                    : 'bg-slate-950/30 border-white/10'
                }`}>
                  <div className="text-[11px] font-bold text-slate-300">
                    Gana {homeShort}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tabular-nums tracking-tight my-0.5">
                    {dixonColes.pHomeWin}%
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-400">
                    Cuota @{(100 / Math.max(1, dixonColes.pHomeWin)).toFixed(2)}
                  </div>
                </div>

                {/* Empate */}
                <div className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
                  dixonColes.pDraw >= 32
                    ? 'bg-slate-900/40 border-slate-600 shadow-sm'
                    : 'bg-slate-950/30 border-white/10'
                }`}>
                  <div className="text-[11px] font-bold text-slate-300">
                    Empate
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-200 font-mono tabular-nums tracking-tight my-0.5">
                    {dixonColes.pDraw}%
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-400">
                    Cuota @{(100 / Math.max(1, dixonColes.pDraw)).toFixed(2)}
                  </div>
                </div>

                {/* Visitante */}
                <div className={`p-2 rounded-xl border backdrop-blur-md transition-all ${
                  dixonColes.pAwayWin >= 48
                    ? 'bg-blue-950/35 border-blue-500/50 shadow-sm ring-1 ring-blue-500/20'
                    : 'bg-slate-950/30 border-white/10'
                }`}>
                  <div className="text-[11px] font-bold text-slate-300">
                    Gana {awayShort}
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-blue-400 font-mono tabular-nums tracking-tight my-0.5">
                    {dixonColes.pAwayWin}%
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-slate-400">
                    Cuota @{(100 / Math.max(1, dixonColes.pAwayWin)).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Barra de Progresión */}
              <div className="space-y-0.5">
                <div className="h-1.5 w-full rounded-full bg-slate-950/60 overflow-hidden flex shadow-inner">
                  <div style={{ width: `${dixonColes.pHomeWin}%` }} className="bg-emerald-500 transition-all duration-500" />
                  <div style={{ width: `${dixonColes.pDraw}%` }} className="bg-slate-500 transition-all duration-500" />
                  <div style={{ width: `${dixonColes.pAwayWin}%` }} className="bg-blue-500 transition-all duration-500" />
                </div>
                <div className="flex justify-between text-[9px] font-mono tabular-nums text-slate-400 px-0.5">
                  <span>Local {dixonColes.pHomeWin}%</span>
                  <span>Empate {dixonColes.pDraw}%</span>
                  <span>Visita {dixonColes.pAwayWin}%</span>
                </div>
              </div>

              {/* 4. Resumen Directo de Resultados */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Marcador Más Probable */}
                <div className="p-2.5 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Marcador Probable</span>
                    <span className="text-base font-black text-white font-mono tabular-nums">{mostLikelyScore}</span>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {mostLikelyScorePct}%
                  </span>
                </div>

                {/* Ambos Marcan */}
                <div className="p-2.5 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Ambos Marcan</span>
                    <span className={`text-base font-black ${goalsMarket.bttsYes >= 50 ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {bttsAnswer}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums font-bold text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                    {goalsMarket.bttsYes}%
                  </span>
                </div>

                {/* Pronóstico Sugerido */}
                <div className="p-2.5 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Jugada #1 Sugerida</span>
                    <span className="text-xs font-bold text-emerald-300 block truncate">
                      {topSafePick?.label || verdict.recommendedPicks[0]?.label || `Victoria ${favoriteTeam}`}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums font-semibold text-emerald-400 shrink-0">
                    {topSafePick?.probability}%
                  </span>
                </div>
              </div>

              {/* 5. Estadísticas Clave */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* xG Local vs Visita */}
                <div className="p-2 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">xG Esperado</span>
                  <div className="text-sm font-black font-mono tabular-nums mt-0.5 flex items-center justify-center gap-1.5">
                    <span className="text-emerald-400">{dixonColes.lambdaHome.toFixed(2)}</span>
                    <span className="text-slate-600">vs</span>
                    <span className="text-blue-400">{dixonColes.lambdaAway.toFixed(2)}</span>
                  </div>
                </div>

                {/* Tiros a Puerta */}
                <div className="p-2 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Tiros a Puerta</span>
                  <div className="text-sm font-black font-mono tabular-nums text-white mt-0.5 flex items-center justify-center gap-1.5">
                    <span>{fixture.homeTeam.avgShotsOnTarget}</span>
                    <span className="text-slate-600">vs</span>
                    <span>{fixture.awayTeam.avgShotsOnTarget}</span>
                  </div>
                </div>

                {/* Historial Cara a Cara (H2H) */}
                <div className="p-2 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                    H2H ({h2h.totalMatches} Partidos)
                  </span>
                  <div className="text-sm font-black font-mono tabular-nums mt-0.5 flex items-center justify-center gap-1.5">
                    <span className="text-emerald-400" title={`Victorias de ${fixture.homeTeam.name}`}>{h2h.homeWins}V</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-300" title="Empates">{h2h.draws}E</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-blue-400" title={`Victorias de ${fixture.awayTeam.name}`}>{h2h.awayWins}V</span>
                  </div>
                </div>

                {/* Amarillas */}
                <div className="p-2 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 text-center">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Amarillas Esperadas</span>
                  <span className="text-sm font-black font-mono tabular-nums text-amber-400 mt-0.5 block">
                    ~{refereeCards.expectedYellowCards} tarjetas
                  </span>
                </div>

                {/* Árbitro Oficial */}
                <div className="p-2 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Árbitro Oficial</span>
                  <span className="text-xs font-semibold text-slate-200 mt-0.5 block truncate" title={fixture.referee?.name || 'Designación Oficial'}>
                    {fixture.referee?.name || 'Designación Oficial'}
                  </span>
                </div>
              </div>

          {/* 6. Cuotas de Mercado y Simulación */}
          <div className="p-2.5 rounded-xl bg-slate-950/30 backdrop-blur-md border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cuotas:</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
                {analysis.marketOdds ? (
                  <>
                    <span
                      className={`px-2 py-0.5 rounded border transition-all ${
                        analysis.marketOdds.valueSide === '1'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400/60 shadow-xs shadow-amber-500/40 font-black'
                          : 'bg-slate-900/60 border-white/10 text-emerald-400'
                      }`}
                      title={analysis.marketOdds.valueSide === '1' ? 'Cuota con Valor Estadístico positivo' : undefined}
                    >
                      1: @{analysis.marketOdds.bookmakerHomeOdds.toFixed(2)}
                      {analysis.marketOdds.valueSide === '1' && ' ★'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border transition-all ${
                        analysis.marketOdds.valueSide === 'X'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400/60 shadow-xs shadow-amber-500/40 font-black'
                          : 'bg-slate-900/60 border-white/10 text-slate-300'
                      }`}
                      title={analysis.marketOdds.valueSide === 'X' ? 'Cuota con Valor Estadístico positivo' : undefined}
                    >
                      X: @{analysis.marketOdds.bookmakerDrawOdds.toFixed(2)}
                      {analysis.marketOdds.valueSide === 'X' && ' ★'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border transition-all ${
                        analysis.marketOdds.valueSide === '2'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-300 ring-1 ring-amber-400/60 shadow-xs shadow-amber-500/40 font-black'
                          : 'bg-slate-900/60 border-white/10 text-blue-400'
                      }`}
                      title={analysis.marketOdds.valueSide === '2' ? 'Cuota con Valor Estadístico positivo' : undefined}
                    >
                      2: @{analysis.marketOdds.bookmakerAwayOdds.toFixed(2)}
                      {analysis.marketOdds.valueSide === '2' && ' ★'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-white/10 text-emerald-400">1: @{(100 / Math.max(1, dixonColes.pHomeWin)).toFixed(2)}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-white/10 text-slate-300">X: @{(100 / Math.max(1, dixonColes.pDraw)).toFixed(2)}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-white/10 text-blue-400">2: @{(100 / Math.max(1, dixonColes.pAwayWin)).toFixed(2)}</span>
                  </>
                )}
              </div>

              {analysis.marketOdds?.valueBetDetected && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-gradient-to-r from-amber-500/25 via-amber-500/20 to-yellow-500/15 text-amber-300 border border-amber-400/50 shadow-xs shadow-amber-500/30">
                  <Sparkles className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
                  <span>Apuesta de Valor en {analysis.marketOdds.valueSide} (+{analysis.marketOdds.valueEdgePercent}%)</span>
                </span>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto sm:ml-auto pt-1 sm:pt-0 border-t border-white/5 sm:border-t-0">
              <a
                href={liveScoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/30 transition-all cursor-pointer group shadow-xs"
                title="Ver marcador, incidencias y estadísticas en vivo"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping inline-block"></span>
                <span>Marcador en Vivo</span>
                <ExternalLink className="w-3 h-3 text-rose-400 group-hover:translate-x-0.5 transition-transform" />
              </a>

              {onOpenSimulator && (
                <button
                  onClick={() => onOpenSimulator(fixture)}
                  className="text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold hover:underline cursor-pointer"
                >
                  Simular Partido →
                </button>
              )}
            </div>
          </div>

          {/* 7. Módulo Interactivo: Calculadora +EV y Criterio de Kelly */}
          <div className="p-3 rounded-xl bg-slate-950/40 backdrop-blur-md border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                Calculadora +EV / Gestión Kelly
              </span>
              <span className="text-[10px] font-mono text-slate-400">Quarter Kelly (25%)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              {/* Selector de Selección (1, X, 2) */}
              <div className="sm:col-span-4 flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setSelectedBetSide('1')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors ${
                    selectedBetSide === '1'
                      ? 'bg-emerald-500 text-black shadow-xs font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1 ({dixonColes.pHomeWin}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBetSide('X')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors ${
                    selectedBetSide === 'X'
                      ? 'bg-slate-300 text-black shadow-xs font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  X ({dixonColes.pDraw}%)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBetSide('2')}
                  className={`flex-1 py-1 text-[11px] font-bold rounded transition-colors ${
                    selectedBetSide === '2'
                      ? 'bg-blue-500 text-white shadow-xs font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2 ({dixonColes.pAwayWin}%)
                </button>
              </div>

              {/* Input de Cuota */}
              <div className="sm:col-span-3">
                <input
                  type="number"
                  step="0.01"
                  min="1.01"
                  placeholder="Cuota (ej. 2.10)"
                  value={inputOdds}
                  onChange={(e) => setInputOdds(e.target.value)}
                  className="w-full bg-slate-900/60 border border-white/15 focus:border-emerald-400 focus:outline-none rounded-lg px-2.5 py-1 text-xs font-mono text-white placeholder-slate-500 text-center font-bold"
                />
              </div>

              {/* Resultados Directos: EV y Stake */}
              <div className="sm:col-span-5 grid grid-cols-2 gap-1.5 text-center">
                {/* Valor Esperado (+EV) */}
                <div className={`px-2 py-1 rounded-lg border text-xs font-mono font-bold flex flex-col justify-center ${
                  evMetrics.evPercent === null
                    ? 'bg-slate-900/40 border-white/5 text-slate-500'
                    : evMetrics.isPositive
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'bg-rose-950/30 border-rose-500/30 text-rose-400'
                }`}>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">
                    {evMetrics.evPercent === null ? 'Valor Esperado' : evMetrics.isPositive ? '+EV (Valor)' : '-EV (Sin Valor)'}
                  </span>
                  <span>
                    {evMetrics.evPercent !== null ? `${evMetrics.isPositive ? '+' : ''}${evMetrics.evPercent}%` : '—'}
                  </span>
                </div>

                {/* Stake Sugerido (Kelly) */}
                <div className={`px-2 py-1 rounded-lg border text-xs font-mono font-bold flex flex-col justify-center ${
                  evMetrics.kellyStake === null
                    ? 'bg-slate-900/40 border-white/5 text-slate-500'
                    : evMetrics.isPositive
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-900/40 border-white/5 text-slate-400'
                }`}>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-sans">Stake Kelly</span>
                  <span>
                    {evMetrics.kellyStake !== null ? `${evMetrics.kellyStake}% Banca` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botón Inferior para Contraer */}
        <div className="px-4 sm:px-5 pb-4">
          <button
            type="button"
            onClick={handleToggleExpand}
            className="w-full py-2 px-4 rounded-xl bg-slate-900/50 hover:bg-slate-800/70 border border-white/10 hover:border-emerald-500/30 text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>Colapsar análisis de este partido</span>
            <ChevronUp className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>
    )}
  </div>
</div>
  );
});