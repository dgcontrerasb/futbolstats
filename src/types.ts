export interface TeamInfo {
  id: number;
  name: string;
  shortName: string;
  logo: string;
  rank: number;
  points: number;
  form: ('W' | 'D' | 'L')[];
  attackStrength: number; // relative to league avg (~0.8 to 1.6)
  defenseStrength: number; // lower is better defense (vulnerability factor: ~0.7 to 1.4)
  avgShotsPerMatch: number;
  avgShotsOnTarget: number;
  restHours: number; // hours since last official match
  starPlayer: {
    name: string;
    position: string;
    goalsSeason: number;
    expectedShots: number;
    expectedShotsOnTarget: number;
    goalConversionRate: number; // e.g. 0.28
  };
}

export interface MatchFixture {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  currentScore?: {
    home: number;
    away: number;
    minute?: number;
  };
  league: {
    id: number;
    name: string;
    country: string;
    flag: string;
    round: string;
    avgGoalsPerMatch: number;
    avgCardsPerMatch: number;
  };
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  referee: {
    name: string;
    nationality: string;
    rigor: 'Severo' | 'Moderado' | 'Flexible';
    avgYellowCards: number;
    avgRedCards: number;
    foulsPerCard: number;
  };
  venue: {
    name: string;
    city: string;
    capacity: number;
  };
  travel: {
    awayDistanceKm: number;
    awayFlightHours: number;
  };
  homeAdvantage?: number;
  derbyOrRivalry?: boolean;
  h2h?: H2HSummary;
}

export interface H2HSummary {
  totalMatches: number;
  homeWins: number;
  draws: number;
  awayWins: number;
}

export interface DixonColesResult {
  lambdaHome: number;
  lambdaAway: number;
  totalXG: number;
  pHomeWin: number; // percentage 0-100
  pDraw: number;
  pAwayWin: number;
  fairOddsHome: number;
  fairOddsDraw: number;
  fairOddsAway: number;
  scoreMatrix: number[][]; // 7x7 matrix [homeGoals][awayGoals]
  mostLikelyScores: { score: string; home: number; away: number; probability: number }[];
}

export interface GoalsMarketResult {
  bttsYes: number;
  bttsNo: number;
  over15: number;
  under15: number;
  over25: number;
  under25: number;
  over35: number;
  under35: number;
  doubleChance1X: number;
  doubleChanceX2: number;
  doubleChance12: number;
  firstHalfGoalProb: number;
  secondHalfGoalProb: number;
}

export interface CornersMarketResult {
  lambdaHomeCorners: number;
  lambdaAwayCorners: number;
  expectedTotalCorners: number;
  over75: number;
  over85: number;
  over95: number;
  over105: number;
  under95: number;
  under105: number;
  recommendedLine: string;
  recommendedProb: number;
  recommendedOdd: number;
}

export interface RefereeCardResult {
  refereeName: string;
  rigor: 'Severo' | 'Moderado' | 'Flexible';
  rigorFactor: number;
  matchTensionFactor: number;
  expectedYellowCards: number;
  expectedHomeYellows: number;
  expectedAwayYellows: number;
  expectedRedCards: number;
  redCardRiskPercent: number;
  over35CardsProb: number;
  over45CardsProb: number;
  under45CardsProb: number;
  under55CardsProb: number;
  recommendedCardPick: string;
  recommendedCardProb: number;
  recommendedCardOdd: number;
  tensionExplanation: string;
}

export interface ShotsPlayerResult {
  homeTotalShots: number;
  homeShotsOnTarget: number;
  awayTotalShots: number;
  awayShotsOnTarget: number;
  homeStar: {
    name: string;
    position: string;
    expectedShots: number;
    expectedShotsOnTarget: number;
    anytimeGoalProb: number;
  };
  awayStar: {
    name: string;
    position: string;
    expectedShots: number;
    expectedShotsOnTarget: number;
    anytimeGoalProb: number;
  };
}

export interface UrgencyResult {
  homeRank: number;
  awayRank: number;
  homePoints: number;
  awayPoints: number;
  homeContext: string;
  awayContext: string;
  urgencyIndex: number; // 1 to 10
  motivationSummary: string;
}

export interface HalfGoalsResult {
  firstHalfPercent: number;
  secondHalfPercent: number;
  equalPercent: number;
  expected1stHalfGoals: number;
  expected2ndHalfGoals: number;
  rationale: string;
}

export interface LateGoalsResult {
  lateGoalPercent: number; // min 75-90+
  dramaRating: 'Alta Intensidad' | 'Media Intensidad' | 'Partido Controlado';
  rationale: string;
}

export interface BilateralFatigueResult {
  homeRestHours: number;
  awayRestHours: number;
  awayTravelKm: number;
  awayTravelHours: number;
  awayPenaltyPercent: number; // e.g. 8.5%
  homePenaltyPercent: number;
  fatigueDiagnosis: string;
}

export interface CleanSheetResult {
  homeCleanSheetPercent: number;
  awayCleanSheetPercent: number;
  homeDefenseRating: string;
  awayDefenseRating: string;
}

export type MarketPickCategory =
  | 'CORNERS'
  | 'CARDS'
  | 'SAFE_GOALS'
  | 'DOUBLE_CHANCE'
  | 'BTTS'
  | 'SHOTS'
  | 'HALF_GOALS'
  | '1X2';

export interface BestMarketPick {
  id: string;
  category: MarketPickCategory;
  categoryLabel: string;
  label: string;
  plainTitle: string;
  probability: number;
  fairOdd: number;
  riskLevel: 'Riesgo Bajo' | 'Riesgo Moderado';
  whySaferThanWinner: string;
  stepByStepGuide: {
    step1: string;
    step2: string;
    step3: string;
  };
  glossaryTerm: {
    term: string;
    definition: string;
    example: string;
  };
}

export interface VerdictResult {
  closeMatchPercent: number; // diff <= 1 or draw
  wideWinPercent: number; // diff >= 2
  recommendedPicks: { label: string; market: string; probability: number; odd: number }[];
  topSafePick: BestMarketPick;
  allRankedPicks: BestMarketPick[];
  confidenceTier: 'Alta Convicción' | 'Valor Estadístico' | 'Precaución Táctica';
  technicalVerdict: string;
  keyTacticalFactor: string;
}

export interface MarketOddsComparison {
  provider: string; // e.g. 'The Odds API / Consenso del Mercado'
  bookmakerHomeOdds: number;
  bookmakerDrawOdds: number;
  bookmakerAwayOdds: number;
  impliedHomeProb: number;
  impliedDrawProb: number;
  impliedAwayProb: number;
  valueBetDetected: boolean;
  valueSide?: '1' | 'X' | '2';
  valueEdgePercent?: number; // e.g. +7.4%
  valueExplanation?: string;
}

export interface MatchAnalysis {
  matchId: string;
  dixonColes: DixonColesResult;
  goalsMarket: GoalsMarketResult;
  cornersMarket: CornersMarketResult;
  refereeCards: RefereeCardResult;
  shotsAndPlayers: ShotsPlayerResult;
  urgency: UrgencyResult;
  halfGoals: HalfGoalsResult;
  lateGoals: LateGoalsResult;
  fatigue: BilateralFatigueResult;
  cleanSheet: CleanSheetResult;
  verdict: VerdictResult;
  marketOdds?: MarketOddsComparison;
}

export interface CacheMetadata {
  date: string;
  cachedAt: string;
  source: 'cache' | 'api' | 'fallback';
  callsConsumed: number;
  remainingCalls: number;
  totalMatches: number;
  error?: string;
}

// ==========================================
// BASKETBALL / NBA SPECIFIC TYPES
// ==========================================

export type ActiveSport = 'SOCCER' | 'NBA';

export interface NBAPlayerProp {
  id: string;
  name: string;
  team: string;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  avatar?: string;
  seasonPpg: number; // Puntos por partido
  season3pm: number; // Triples anotados por partido
  seasonApg: number; // Asistencias por partido
  seasonRpg: number; // Rebotes por partido
  projectedMinutes: number;
  usageRate: number; // e.g. 31.5%
  // Proyección de Puntos
  projectedPoints: number;
  pointsLine: number;
  overPointsProb: number;
  underPointsProb: number;
  // Proyección de Triples (Cálculo Poisson exacto)
  projected3pm: number;
  threePointersLine: number;
  over3pmProb: number;
  under3pmProb: number;
  // Datos en vivo si el partido está en juego
  liveCurrentPoints?: number;
  liveCurrent3pm?: number;
}

export interface NBAQuarterScore {
  home: number;
  away: number;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface NBAQuarterProjection {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | '1H' | '2H';
  label: string;
  projectedHome: number;
  projectedAway: number;
  projectedTotal: number;
  favorite: string;
  spread: number;
  overLine: number;
  overProb: number;
  underProb: number;
  status: 'PENDING' | 'IN_PLAY' | 'FINAL';
  actualHome?: number;
  actualAway?: number;
}

export interface NBATeamInfo {
  id: number;
  name: string;
  shortName: string;
  city: string;
  logo: string;
  conference: 'Este' | 'Oeste';
  division: string;
  wins: number;
  losses: number;
  streak: string;
  pace: number; // Posesiones por 48 min
  offensiveRating: number; // Puntos por 100 posesiones
  defensiveRating: number; // Puntos permitidos por 100 posesiones
  netRating: number;
  threePointAttemptRate: number;
  threePointPct: number;
  keyPlayers: NBAPlayerProp[];
  restDays: number;
}

export interface NBAMatchFixture {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm COT (Hora Colombia)
  status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED';
  livePeriod?: 'Q1' | 'Q2' | 'HT' | 'Q3' | 'Q4' | 'OT';
  liveClock?: string; // e.g. '4:32'
  currentScore?: {
    home: number;
    away: number;
  };
  quarters?: {
    q1: NBAQuarterScore;
    q2: NBAQuarterScore;
    q3: NBAQuarterScore;
    q4: NBAQuarterScore;
    ot?: NBAQuarterScore;
  };
  homeTeam: NBATeamInfo;
  awayTeam: NBATeamInfo;
  arena: {
    name: string;
    city: string;
  };
  h2h: {
    totalMatches: number;
    homeWins: number;
    awayWins: number;
  };
}

export interface NBAAnalysis {
  matchId: string;
  isLive: boolean;
  // Métricas totales
  expectedPace: number;
  projectedHomeScore: number;
  projectedAwayScore: number;
  projectedTotalPoints: number;
  // Probabilidades y líneas
  pHomeWin: number;
  pAwayWin: number;
  fairSpread: number; // e.g. -6.5
  fairTotalLine: number; // e.g. 224.5
  overTotalProb: number;
  underTotalProb: number;
  // Mercado de Triples Totales del Encuentro
  threePointersMarket?: {
    projectedHome3PM: number;
    projectedAway3PM: number;
    projectedTotal3PM: number;
    threePointLine: number; // e.g. 26.5
    over3PMProb: number;
    under3PMProb: number;
    topShooterName: string;
    topShooter3PM: number;
  };
  // Desglose de Cuartos y Mitades
  quarterProjections: NBAQuarterProjection[];
  // Props de Jugadores (Puntos y Triples con Poisson)
  playerProps: NBAPlayerProp[];
  // Explicación técnica y táctica
  paceDifferentialExplanation: string;
  keyMatchup: string;
  // Cuotas de mercado y Valor (+EV)
  marketOdds?: {
    bookmakerHomeOdds: number;
    bookmakerAwayOdds: number;
    bookmakerSpread: number;
    bookmakerSpreadOdds: number;
    bookmakerTotal: number;
    bookmakerOverOdds: number;
    bookmakerUnderOdds: number;
    valueBetDetected: boolean;
    valueSide?: 'HOME' | 'AWAY' | 'OVER' | 'UNDER';
    valueEdgePercent?: number;
    valueExplanation?: string;
  };
}
