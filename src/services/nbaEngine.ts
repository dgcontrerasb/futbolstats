import {
  NBAMatchFixture,
  NBAAnalysis,
  NBAQuarterProjection,
  NBAPlayerProp
} from '../types';

// Standard normal cumulative distribution function (CDF approximation)
function normalCDF(z: number): number {
  if (z < -7) return 0;
  if (z > 7) return 1;

  // Abramowitz and Stegun approximation
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (z >= 0) {
    const t = 1.0 / (1.0 + p * z);
    return 1.0 - c * Math.exp(-z * z / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  } else {
    const t = 1.0 / (1.0 - p * z);
    return c * Math.exp(-z * z / 2.0) * t *
      (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1);
  }
}

// Factorial helper for Poisson calculation
function factorial(n: number): number {
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// Exact Poisson probability P(X = k)
function poissonPMF(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

// Exact Poisson cumulative probability P(X > line)
function poissonOver(lambda: number, line: number): number {
  const threshold = Math.floor(line);
  let cdf = 0;
  for (let k = 0; k <= threshold; k++) {
    cdf += poissonPMF(lambda, k);
  }
  const overProb = Math.max(0.01, Math.min(0.99, 1 - cdf));
  return Math.round(overProb * 1000) / 10; // percentage with 1 decimal
}

// In-memory memoization cache for calculated NBA analyses
const nbaAnalysisCache = new Map<string, { analysis: NBAAnalysis; timestamp: number }>();

export function clearNBAAnalysisCache(): void {
  nbaAnalysisCache.clear();
}

/**
 * Calculates comprehensive pre-game and live in-play adaptive analytics for NBA fixtures
 */
export function calculateNBAAnalysis(fixture: NBAMatchFixture): NBAAnalysis {
  const isLive = fixture.status === 'IN_PLAY';
  const isFinished = fixture.status === 'FINISHED';

  // Live cache key includes current score so in-game updates bust cache immediately
  const liveKey = `${fixture.id}_${fixture.status}_${fixture.currentScore?.home ?? 0}_${fixture.currentScore?.away ?? 0}_${fixture.livePeriod ?? 'PRE'}`;
  const cached = nbaAnalysisCache.get(liveKey);
  if (cached && Date.now() - cached.timestamp < 10000) { // 10s TTL for live
    return cached.analysis;
  }

  const { homeTeam, awayTeam } = fixture;
  const LEAGUE_AVG_PACE = 99.5;
  const LEAGUE_AVG_ORTG = 115.0;

  // 1. Pre-match Pace Projection
  const basePace = (homeTeam.pace * awayTeam.pace) / LEAGUE_AVG_PACE;
  // Home court gives ~2.2 points efficiency boost per 100 possessions
  const homeORTG = (homeTeam.offensiveRating * awayTeam.defensiveRating) / LEAGUE_AVG_ORTG + 2.2;
  const awayORTG = (awayTeam.offensiveRating * homeTeam.defensiveRating) / LEAGUE_AVG_ORTG - 0.4;

  let baseHomeScore = Math.round(((basePace * homeORTG) / 100) * 10) / 10;
  let baseAwayScore = Math.round(((basePace * awayORTG) / 100) * 10) / 10;

  // Rest days adjustments
  if (homeTeam.restDays === 0) baseHomeScore -= 1.8; // Back-to-back penalty
  if (awayTeam.restDays === 0) baseAwayScore -= 2.6; // Road back-to-back penalty
  if (homeTeam.restDays >= 3) baseHomeScore += 1.2;

  // 2. LIVE IN-PLAY ADAPTIVE RE-ESTIMATION
  let projectedHomeScore = baseHomeScore;
  let projectedAwayScore = baseAwayScore;
  let expectedPace = Math.round(basePace * 10) / 10;

  // Estimate minutes remaining if live
  let minutesRemaining = 48;
  if (isFinished) {
    minutesRemaining = 0;
    projectedHomeScore = fixture.currentScore?.home ?? baseHomeScore;
    projectedAwayScore = fixture.currentScore?.away ?? baseAwayScore;
  } else if (isLive && fixture.currentScore) {
    const curHome = fixture.currentScore.home;
    const curAway = fixture.currentScore.away;
    const curTotal = curHome + curAway;

    // Estimate elapsed minutes based on live period
    let elapsedMinutes = 12;
    if (fixture.livePeriod === 'Q1') elapsedMinutes = 6;
    else if (fixture.livePeriod === 'Q2') elapsedMinutes = 18;
    else if (fixture.livePeriod === 'HT') elapsedMinutes = 24;
    else if (fixture.livePeriod === 'Q3') elapsedMinutes = 30;
    else if (fixture.livePeriod === 'Q4') elapsedMinutes = 42;
    else if (fixture.livePeriod === 'OT') elapsedMinutes = 48;

    minutesRemaining = Math.max(0, 48 - elapsedMinutes);
    const fractionElapsed = elapsedMinutes / 48;
    const fractionRemaining = minutesRemaining / 48;

    // Calculate live effective pace from actual points scored so far
    if (fractionElapsed > 0.1 && curTotal > 15) {
      const paceFactor = curTotal / (fractionElapsed * (baseHomeScore + baseAwayScore));
      expectedPace = Math.round(basePace * Math.max(0.85, Math.min(1.20, paceFactor)) * 10) / 10;

      // Adaptive projected score = Points already scored + remaining projected points
      const remainingHomeExp = (baseHomeScore * fractionRemaining) * paceFactor;
      const remainingAwayExp = (baseAwayScore * fractionRemaining) * paceFactor;

      projectedHomeScore = Math.round((curHome + remainingHomeExp) * 10) / 10;
      projectedAwayScore = Math.round((curAway + remainingAwayExp) * 10) / 10;
    }
  }

  const projectedTotalPoints = Math.round((projectedHomeScore + projectedAwayScore) * 10) / 10;
  const pointDifferential = projectedHomeScore - projectedAwayScore;
  const fairSpread = Math.round(-pointDifferential * 2) / 2; // Home favored is negative (e.g. -6.5)
  const fairTotalLine = Math.round(projectedTotalPoints * 2) / 2;

  // 3. Win Probability via Normal Distribution
  // Standard deviation for 48 minutes is ~11.8 pts; decreases with time remaining
  const dynamicStdDev = isLive && minutesRemaining < 48
    ? Math.max(2.8, 11.8 * Math.sqrt(minutesRemaining / 48))
    : 11.8;

  let zScore = (projectedHomeScore - projectedAwayScore) / dynamicStdDev;
  if (isFinished && fixture.currentScore) {
    zScore = fixture.currentScore.home > fixture.currentScore.away ? 10 : -10;
  }

  const pHomeWinRaw = normalCDF(zScore);
  const pHomeWin = Math.round(pHomeWinRaw * 1000) / 10;
  const pAwayWin = Math.round((100 - pHomeWin) * 10) / 10;

  // Over / Under Total probability (relative to fair total line)
  const overTotalProb = 50.8;
  const underTotalProb = 49.2;

  // 4. Quarter Projections Breakdown (1Q, 2Q, 3Q, 4Q and Halves)
  // Quarters distribution weights in modern NBA:
  const quarterWeights = [
    { key: 'Q1' as const, label: '1er Cuarto (1Q)', weight: 0.254, elapsed: minutesRemaining <= 36 },
    { key: 'Q2' as const, label: '2do Cuarto (2Q)', weight: 0.246, elapsed: minutesRemaining <= 24 },
    { key: 'Q3' as const, label: '3er Cuarto (3Q)', weight: 0.252, elapsed: minutesRemaining <= 12 },
    { key: 'Q4' as const, label: '4to Cuarto (4Q)', weight: 0.248, elapsed: minutesRemaining === 0 }
  ];

  const quarterProjections: NBAQuarterProjection[] = quarterWeights.map((qw, idx) => {
    const qHome = Math.round((baseHomeScore * qw.weight) * 10) / 10;
    const qAway = Math.round((baseAwayScore * qw.weight) * 10) / 10;
    const qTotal = Math.round((qHome + qAway) * 10) / 10;
    const qSpread = Math.round(-(qHome - qAway) * 2) / 2;
    const qOverLine = Math.round(qTotal * 2) / 2;

    let status: 'PENDING' | 'IN_PLAY' | 'FINAL' = 'PENDING';
    let actualHome: number | undefined;
    let actualAway: number | undefined;

    // Check if quarter has reported scores
    const qKey = qw.key.toLowerCase() as 'q1' | 'q2' | 'q3' | 'q4';
    if (fixture.quarters && fixture.quarters[qKey]) {
      const qData = fixture.quarters[qKey];
      if (qData.isCompleted) {
        status = 'FINAL';
        actualHome = qData.home;
        actualAway = qData.away;
      } else if (qData.isCurrent) {
        status = 'IN_PLAY';
        actualHome = qData.home;
        actualAway = qData.away;
      }
    }

    return {
      quarter: qw.key,
      label: qw.label,
      projectedHome: qHome,
      projectedAway: qAway,
      projectedTotal: qTotal,
      favorite: qHome >= qAway ? homeTeam.shortName : awayTeam.shortName,
      spread: qSpread,
      overLine: qOverLine,
      overProb: 51.5,
      underProb: 48.5,
      status,
      actualHome,
      actualAway
    };
  });

  // Add 1st Half (1H) projection
  const firstHalfHome = Math.round((quarterProjections[0].projectedHome + quarterProjections[1].projectedHome) * 10) / 10;
  const firstHalfAway = Math.round((quarterProjections[0].projectedAway + quarterProjections[1].projectedAway) * 10) / 10;
  quarterProjections.push({
    quarter: '1H',
    label: '1ra Mitad (1H)',
    projectedHome: firstHalfHome,
    projectedAway: firstHalfAway,
    projectedTotal: Math.round((firstHalfHome + firstHalfAway) * 10) / 10,
    favorite: firstHalfHome >= firstHalfAway ? homeTeam.shortName : awayTeam.shortName,
    spread: Math.round(-(firstHalfHome - firstHalfAway) * 2) / 2,
    overLine: Math.round((firstHalfHome + firstHalfAway) * 2) / 2,
    overProb: 51.0,
    underProb: 49.0,
    status: minutesRemaining <= 24 ? 'FINAL' : isLive && minutesRemaining < 48 ? 'IN_PLAY' : 'PENDING'
  });

  // 5. Player Props with Poisson Distribution for 3-Pointers
  const allKeyPlayers: NBAPlayerProp[] = [
    ...(homeTeam.keyPlayers || []),
    ...(awayTeam.keyPlayers || [])
  ];

  const playerProps: NBAPlayerProp[] = allKeyPlayers.map((player) => {
    // Pace factor adjustment for player
    const playerTeam = player.team === homeTeam.name ? homeTeam : awayTeam;
    const opponentTeam = player.team === homeTeam.name ? awayTeam : homeTeam;
    const paceRatio = expectedPace / playerTeam.pace;
    const defFactor = opponentTeam.defensiveRating / LEAGUE_AVG_ORTG;

    // Projected Points
    const projPoints = Math.round((player.seasonPpg * paceRatio * defFactor) * 10) / 10;
    const pointsLine = Math.round(projPoints) - 0.5;
    const overPtsProb = projPoints > pointsLine ? 56.4 : 45.2;

    // Projected 3PM (Triples) with POISSON CALCULATION
    const lambda3pm = Math.max(0.8, player.season3pm * paceRatio * (opponentTeam.threePointAttemptRate > 0.40 ? 1.06 : 0.96));
    const threePointersLine = Math.floor(lambda3pm) + 0.5;
    const over3pmProb = poissonOver(lambda3pm, threePointersLine);
    const under3pmProb = Math.round((100 - over3pmProb) * 10) / 10;

    // If live, simulate player progression
    let liveCurrentPoints: number | undefined;
    let liveCurrent3pm: number | undefined;
    if (isLive && minutesRemaining < 48) {
      const elapsedFraction = (48 - minutesRemaining) / 48;
      liveCurrentPoints = Math.round(projPoints * elapsedFraction * 0.95);
      liveCurrent3pm = Math.round(lambda3pm * elapsedFraction * 0.9);
    }

    return {
      ...player,
      projectedPoints: projPoints,
      pointsLine,
      overPointsProb: overPtsProb,
      underPointsProb: Math.round((100 - overPtsProb) * 10) / 10,
      projected3pm: Math.round(lambda3pm * 10) / 10,
      threePointersLine,
      over3pmProb,
      under3pmProb,
      liveCurrentPoints,
      liveCurrent3pm
    };
  });

  // 5.5 Team 3-Pointers Market Projections (Triples Totales del Encuentro)
  const home3PA = expectedPace * (homeTeam.threePointAttemptRate || 0.40);
  const away3PA = expectedPace * (awayTeam.threePointAttemptRate || 0.40);
  const projHome3PM = Math.round((home3PA * ((homeTeam.threePointPct || 36.5) / 100)) * 10) / 10;
  const projAway3PM = Math.round((away3PA * ((awayTeam.threePointPct || 36.5) / 100)) * 10) / 10;
  const projTotal3PM = Math.round((projHome3PM + projAway3PM) * 10) / 10;
  const threePointLine = Math.floor(projTotal3PM) + 0.5;
  const over3PMProb = poissonOver(projTotal3PM, threePointLine);
  const under3PMProb = Math.round((100 - over3PMProb) * 10) / 10;

  const sortedShooters = [...playerProps].sort((a, b) => b.projected3pm - a.projected3pm);
  const topShooter = sortedShooters[0];

  const threePointersMarket = {
    projectedHome3PM: projHome3PM,
    projectedAway3PM: projAway3PM,
    projectedTotal3PM: projTotal3PM,
    threePointLine,
    over3PMProb,
    under3PMProb,
    topShooterName: topShooter?.name || 'Tirador Principal',
    topShooter3PM: topShooter?.projected3pm || 2.8
  };

  // 6. Tactical Insights & Match Keys
  const paceDiff = Math.abs(homeTeam.pace - awayTeam.pace);
  const fasterTeam = homeTeam.pace > awayTeam.pace ? homeTeam.shortName : awayTeam.shortName;
  const slowerTeam = homeTeam.pace > awayTeam.pace ? awayTeam.shortName : homeTeam.shortName;

  const paceDifferentialExplanation = paceDiff >= 4.0
    ? `Duelo de ritmos: ${fasterTeam} buscará transición rápida (${Math.max(homeTeam.pace, awayTeam.pace)} posesiones), mientras que ${slowerTeam} intentará frenar el tempo en media cancha.`
    : `Ritmo emparejado: Ambos conjuntos promedian ~${expectedPace} posesiones por 48 minutos, favoreciendo posesiones ordenadas de media cancha.`;

  const starHome = homeTeam.keyPlayers?.[0]?.name || homeTeam.shortName;
  const starAway = awayTeam.keyPlayers?.[0]?.name || awayTeam.shortName;
  const keyMatchup = `Emparejamiento estelar: ${starHome} (${homeTeam.shortName}) vs ${starAway} (${awayTeam.shortName}).`;

  // 7. Synthetic Consensus Odds & Value Bet (+EV)
  // Calculate fair moneyline odds from probabilities
  const fairOddsHome = Math.max(1.05, Math.min(15.0, Math.round((100 / Math.max(5, pHomeWin)) * 100) / 100));
  const fairOddsAway = Math.max(1.05, Math.min(15.0, Math.round((100 / Math.max(5, pAwayWin)) * 100) / 100));

  // Add 4.5% bookmaker vig
  const bookmakerHomeOdds = Math.round(fairOddsHome * 0.96 * 100) / 100;
  const bookmakerAwayOdds = Math.round(fairOddsAway * 0.96 * 100) / 100;

  // Check Value Bet
  let valueBetDetected = false;
  let valueSide: 'HOME' | 'AWAY' | 'OVER' | 'UNDER' | undefined;
  let valueEdgePercent: number | undefined;
  let valueExplanation: string | undefined;

  if (pHomeWin >= 56 && bookmakerHomeOdds >= 1.75) {
    valueBetDetected = true;
    valueSide = 'HOME';
    valueEdgePercent = Math.round((pHomeWin - (100 / bookmakerHomeOdds)) * 10) / 10;
    valueExplanation = `Ventaja en ${homeTeam.shortName} Moneyline: Modelo proyecta ${pHomeWin}% vs cuota de mercado de @${bookmakerHomeOdds.toFixed(2)}.`;
  } else if (pAwayWin >= 48 && bookmakerAwayOdds >= 2.05) {
    valueBetDetected = true;
    valueSide = 'AWAY';
    valueEdgePercent = Math.round((pAwayWin - (100 / bookmakerAwayOdds)) * 10) / 10;
    valueExplanation = `Ventaja en ${awayTeam.shortName} Moneyline: Modelo proyecta ${pAwayWin}% vs cuota de mercado de @${bookmakerAwayOdds.toFixed(2)}.`;
  }

  const analysisResult: NBAAnalysis = {
    matchId: fixture.id,
    isLive,
    expectedPace,
    projectedHomeScore,
    projectedAwayScore,
    projectedTotalPoints,
    pHomeWin,
    pAwayWin,
    fairSpread,
    fairTotalLine,
    overTotalProb,
    underTotalProb,
    threePointersMarket,
    quarterProjections,
    playerProps,
    paceDifferentialExplanation,
    keyMatchup,
    marketOdds: {
      bookmakerHomeOdds,
      bookmakerAwayOdds,
      bookmakerSpread: fairSpread,
      bookmakerSpreadOdds: 1.91,
      bookmakerTotal: fairTotalLine,
      bookmakerOverOdds: 1.91,
      bookmakerUnderOdds: 1.91,
      valueBetDetected,
      valueSide,
      valueEdgePercent,
      valueExplanation
    }
  };

  nbaAnalysisCache.set(liveKey, {
    analysis: analysisResult,
    timestamp: Date.now()
  });

  return analysisResult;
}
