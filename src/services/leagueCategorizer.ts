import { MatchFixture } from '../types';

export interface LeagueInfo {
  id: number | string;
  name: string;
  country: string;
  flag?: string;
  matchCount: number;
  categoryKey: string;
}

export interface CompetitionGroup {
  key: string;
  name: string;
  displayName: string;
  category: 'INTERNATIONAL' | 'COUNTRY' | 'OTHER';
  flag: string;
  priority: number; // lower = higher in list
  totalMatches: number;
  leagues: LeagueInfo[];
  fixtures: MatchFixture[];
}

// Known international tournament indicators
const INTL_KEYWORDS = [
  'champions league',
  'europa league',
  'conference league',
  'uefa',
  'copa libertadores',
  'copa sudamericana',
  'recopa',
  'conmebol',
  'concacaf',
  'leagues cup',
  'gold cup',
  'afc champions',
  'caf champions',
  'fifa club',
  'club world cup',
  'mundial de clubes',
  'world cup',
  'copa america',
  'copa américa',
  'euro 20',
  'eurocopa',
  'nations league',
  'friendlies international',
  'international friendlies',
  'amistosos internacionales'
];

const INTL_COUNTRIES = [
  'world',
  'europe',
  'south america',
  'north & central america',
  'central america',
  'asia',
  'africa',
  'international'
];

// Country normalization & friendly names with flags
interface CountryMeta {
  spanishName: string;
  flag: string;
  priority: number;
  aliases: string[];
}

const COUNTRY_METAS: Record<string, CountryMeta> = {
  COLOMBIA: {
    spanishName: 'Colombia',
    flag: '🇨🇴',
    priority: 1,
    aliases: ['colombia', 'copa betplay', 'torneo betplay', 'liga betplay', 'primera a colombia', 'primera b colombia']
  },
  ENGLAND: {
    spanishName: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    priority: 2,
    aliases: ['england', 'inglaterra', 'premier league', 'championship', 'fa cup', 'efl cup', 'league one', 'league two']
  },
  SPAIN: {
    spanishName: 'España',
    flag: '🇪🇸',
    priority: 3,
    aliases: ['spain', 'espana', 'españa', 'laliga', 'la liga', 'copa del rey', 'segunda division']
  },
  ARGENTINA: {
    spanishName: 'Argentina',
    flag: '🇦🇷',
    priority: 4,
    aliases: ['argentina', 'liga profesional', 'copa de la liga', 'primera nacional', 'copa argentina']
  },
  BRAZIL: {
    spanishName: 'Brasil',
    flag: '🇧🇷',
    priority: 5,
    aliases: ['brazil', 'brasil', 'serie a brazil', 'serie a brasil', 'copa do brasil', 'paulista', 'carioca', 'brasileirao', 'brasileirão']
  },
  ITALY: {
    spanishName: 'Italia',
    flag: '🇮🇹',
    priority: 6,
    aliases: ['italy', 'italia', 'serie a', 'coppa italia', 'serie b']
  },
  GERMANY: {
    spanishName: 'Alemania',
    flag: '🇩🇪',
    priority: 7,
    aliases: ['germany', 'alemania', 'bundesliga', 'dfb pokal', '2. bundesliga']
  },
  FRANCE: {
    spanishName: 'Francia',
    flag: '🇫🇷',
    priority: 8,
    aliases: ['france', 'francia', 'ligue 1', 'coupe de france', 'ligue 2']
  },
  MEXICO: {
    spanishName: 'México',
    flag: '🇲🇽',
    priority: 9,
    aliases: ['mexico', 'méxico', 'liga mx', 'copa mx', 'expansion mx', 'expansión mx']
  },
  USA: {
    spanishName: 'Estados Unidos',
    flag: '🇺🇸',
    priority: 10,
    aliases: ['usa', 'united states', 'estados unidos', 'mls', 'major league soccer', 'us open cup', 'usl']
  },
  PORTUGAL: {
    spanishName: 'Portugal',
    flag: '🇵🇹',
    priority: 11,
    aliases: ['portugal', 'primeira liga', 'taca de portugal', 'taça de portugal', 'liga portugal']
  },
  NETHERLANDS: {
    spanishName: 'Países Bajos',
    flag: '🇳🇱',
    priority: 12,
    aliases: ['netherlands', 'paises bajos', 'países bajos', 'holanda', 'eredivisie', 'knvb beker']
  },
  SAUDI_ARABIA: {
    spanishName: 'Arabia Saudita',
    flag: '🇸🇦',
    priority: 13,
    aliases: ['saudi arabia', 'arabia saudita', 'saudi pro league', 'king cup']
  },
  TURKEY: {
    spanishName: 'Turquía',
    flag: '🇹🇷',
    priority: 14,
    aliases: ['turkey', 'turquía', 'turquia', 'super lig', 'süper lig', 'turkish cup']
  },
  CHILE: {
    spanishName: 'Chile',
    flag: '🇨🇱',
    priority: 15,
    aliases: ['chile', 'primera division chile', 'primera división chile', 'copa chile']
  },
  URUGUAY: {
    spanishName: 'Uruguay',
    flag: '🇺🇾',
    priority: 16,
    aliases: ['uruguay', 'primera division uruguay', 'campeonato uruguayo']
  },
  ECUADOR: {
    spanishName: 'Ecuador',
    flag: '🇪🇨',
    priority: 17,
    aliases: ['ecuador', 'liga pro ecuador', 'copa ecuador']
  },
  PERU: {
    spanishName: 'Perú',
    flag: '🇵🇪',
    priority: 18,
    aliases: ['peru', 'perú', 'liga 1 peru', 'copa bicentenario']
  },
  PARAGUAY: {
    spanishName: 'Paraguay',
    flag: '🇵🇾',
    priority: 19,
    aliases: ['paraguay', 'primera division paraguay']
  },
  BOLIVIA: {
    spanishName: 'Bolivia',
    flag: '🇧🇴',
    priority: 20,
    aliases: ['bolivia', 'division profesional bolivia']
  },
  VENEZUELA: {
    spanishName: 'Venezuela',
    flag: '🇻🇪',
    priority: 21,
    aliases: ['venezuela', 'liga futve']
  },
  BELGIUM: {
    spanishName: 'Bélgica',
    flag: '🇧🇪',
    priority: 22,
    aliases: ['belgium', 'belgica', 'bélgica', 'pro league', 'jupiler pro league']
  },
  SCOTLAND: {
    spanishName: 'Escocia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    priority: 23,
    aliases: ['scotland', 'escocia', 'scottish premiership', 'premiership scotland']
  },
  JAPAN: {
    spanishName: 'Japón',
    flag: '🇯🇵',
    priority: 24,
    aliases: ['japan', 'japon', 'japón', 'j1 league', 'j-league', 'emperor cup']
  }
};

/**
 * Determines whether a league is an international tournament
 */
export function isInternationalCompetition(leagueName: string, countryName?: string): boolean {
  const l = (leagueName || '').toLowerCase();
  const c = (countryName || '').toLowerCase();

  // Country matches international regions
  if (INTL_COUNTRIES.some(ic => c === ic || c.includes(ic))) {
    return true;
  }

  // Name matches known international cups
  if (INTL_KEYWORDS.some(kw => l.includes(kw))) {
    return true;
  }

  return false;
}

/**
 * Maps a fixture's league to a country key or INTL
 */
export function identifyCompetitionCategory(leagueName: string, countryName?: string): {
  key: string;
  name: string;
  displayName: string;
  flag: string;
  isInternational: boolean;
  priority: number;
} {
  const l = (leagueName || '').trim();
  const c = (countryName || '').trim();
  const lLower = l.toLowerCase();
  const cLower = c.toLowerCase();

  // 1. Check International Tournament
  if (isInternationalCompetition(l, c)) {
    // Specific international cup icons
    let flag = '🏆';
    if (lLower.includes('libertadores') || lLower.includes('sudamericana') || lLower.includes('conmebol')) {
      flag = '🌎';
    } else if (lLower.includes('champions') || lLower.includes('europa') || lLower.includes('conference') || lLower.includes('uefa')) {
      flag = '⭐';
    } else if (lLower.includes('concacaf') || lLower.includes('gold cup')) {
      flag = '🏆';
    } else if (lLower.includes('mundial') || lLower.includes('world cup')) {
      flag = '🌍';
    }

    return {
      key: 'INTL',
      name: 'Torneos Internacionales',
      displayName: `${flag} Torneos Internacionales`,
      flag,
      isInternational: true,
      priority: 0
    };
  }

  // 2. Check matched known countries
  for (const [key, meta] of Object.entries(COUNTRY_METAS)) {
    // Check country name
    if (meta.aliases.some(alias => cLower === alias || cLower.includes(alias))) {
      return {
        key,
        name: meta.spanishName,
        displayName: `${meta.flag} ${meta.spanishName}`,
        flag: meta.flag,
        isInternational: false,
        priority: meta.priority
      };
    }

    // Check league name for distinct national leagues (e.g. "Premier League", "LaLiga", "Copa BetPlay")
    if (meta.aliases.some(alias => lLower.includes(alias))) {
      return {
        key,
        name: meta.spanishName,
        displayName: `${meta.flag} ${meta.spanishName}`,
        flag: meta.flag,
        isInternational: false,
        priority: meta.priority
      };
    }
  }

  // 3. Fallback for any other country
  if (c && c.length > 0 && c.toLowerCase() !== 'unknown') {
    const safeKey = `COUNTRY_${c.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    return {
      key: safeKey,
      name: c,
      displayName: `🌐 ${c}`,
      flag: '🌐',
      isInternational: false,
      priority: 50
    };
  }

  // 4. Fallback unknown
  return {
    key: 'OTHER',
    name: 'Otras Competiciones',
    displayName: '⚽ Otras Competiciones',
    flag: '⚽',
    isInternational: false,
    priority: 99
  };
}

/**
 * Groups all fixtures into categorized CompetitionGroups:
 * - INTL: Torneos Internacionales
 * - Country groups with their leagues
 */
export function groupFixturesByCompetition(fixtures: MatchFixture[]): CompetitionGroup[] {
  const groupsMap = new Map<string, CompetitionGroup>();

  for (const fixture of fixtures) {
    const lName = fixture.league?.name || 'Competición';
    const cName = fixture.league?.country || '';
    const lId = fixture.league?.id || `${lName}-${cName}`;

    const cat = identifyCompetitionCategory(lName, cName);

    if (!groupsMap.has(cat.key)) {
      groupsMap.set(cat.key, {
        key: cat.key,
        name: cat.name,
        displayName: cat.displayName,
        category: cat.isInternational ? 'INTERNATIONAL' : (cat.key === 'OTHER' ? 'OTHER' : 'COUNTRY'),
        flag: cat.flag,
        priority: cat.priority,
        totalMatches: 0,
        leagues: [],
        fixtures: []
      });
    }

    const group = groupsMap.get(cat.key)!;
    group.totalMatches += 1;
    group.fixtures.push(fixture);

    // Track unique league in group
    let leagueEntry = group.leagues.find(lg => lg.id === lId || lg.name === lName);
    if (!leagueEntry) {
      leagueEntry = {
        id: lId,
        name: lName,
        country: cName,
        flag: fixture.league?.flag,
        matchCount: 0,
        categoryKey: cat.key
      };
      group.leagues.push(leagueEntry);
    }
    leagueEntry.matchCount += 1;
  }

  // Sort groups:
  // 1. International first (priority 0)
  // 2. High priority countries (Colombia, England, Spain, etc.)
  // 3. By total match count descending
  // 4. Other competitions at the end
  const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.totalMatches - a.totalMatches;
  });

  // Sort leagues inside each group by match count
  for (const grp of sortedGroups) {
    grp.leagues.sort((a, b) => b.matchCount - a.matchCount);
    // Sort fixtures in group by time
    grp.fixtures.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }

  return sortedGroups;
}

/**
 * Filter predicate to match fixtures according to selectedLeague filter value.
 * Strictly guarantees that only matches from the requested league, tournament,
 * or country are returned.
 */
export function matchesLeagueSelection(fixture: MatchFixture, selectedLeague: string): boolean {
  if (!selectedLeague || selectedLeague === 'ALL') {
    return true;
  }

  const lName = (fixture.league?.name || '').trim();
  const cName = (fixture.league?.country || '').trim();
  const lNameLower = lName.toLowerCase();
  const cNameLower = cName.toLowerCase();
  const lId = fixture.league?.id !== undefined && fixture.league?.id !== null ? String(fixture.league.id).trim() : '';

  // 1. International tournament selection ("GROUP_INTL" or "INTL")
  if (selectedLeague === 'GROUP_INTL' || selectedLeague === 'INTL') {
    return isInternationalCompetition(fixture.league?.name, fixture.league?.country);
  }

  // 2. Specific single league by ID (e.g. "LEAGUE_39", "LEAGUE_2", or "LEAGUE_Premier League-England")
  if (selectedLeague.startsWith('LEAGUE_')) {
    const target = selectedLeague.replace('LEAGUE_', '').trim();
    
    // A. Match numeric or string ID from fixture.league.id
    if (lId && (lId === target || lId.toLowerCase() === target.toLowerCase())) {
      return true;
    }
    
    // B. Match synthetic ID: "${lName}-${cName}"
    const synthId = `${lName}-${cName}`.trim();
    if (synthId && target.toLowerCase() === synthId.toLowerCase()) {
      return true;
    }

    // C. Match exact league name
    if (lNameLower && target.toLowerCase() === lNameLower) {
      return true;
    }

    // Explicitly reject if this fixture is not from the target league!
    return false;
  }

  // 3. Specific country group (e.g. "COUNTRY_COLOMBIA", "COUNTRY_ENGLAND", "COUNTRY_OTHER")
  if (selectedLeague.startsWith('COUNTRY_')) {
    const countryKey = selectedLeague.replace('COUNTRY_', '').trim().toUpperCase();
    const cat = identifyCompetitionCategory(fixture.league?.name, fixture.league?.country);
    
    // Match identified category key
    if (cat.key.toUpperCase() === countryKey || cat.key.toUpperCase() === `COUNTRY_${countryKey}`) {
      return true;
    }

    // Match known metadata aliases
    const meta = COUNTRY_METAS[countryKey];
    if (meta) {
      if (meta.aliases.some(alias => cNameLower === alias || cNameLower.includes(alias) || lNameLower.includes(alias))) {
        return true;
      }
    }

    // Match safe key generated from country name
    const safeKey = cNameLower.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (safeKey === countryKey || safeKey.includes(countryKey) || countryKey.includes(safeKey)) {
      return true;
    }

    // Explicitly reject if not from this country group!
    return false;
  }

  // 4. Legacy mappings for backwards compatibility
  if (selectedLeague === 'COLOMBIA') {
    return lNameLower.includes('colombia') || lNameLower.includes('betplay') || cNameLower.includes('colombia');
  }
  if (selectedLeague === 'ARG') {
    return lNameLower.includes('argentina') || lNameLower.includes('nacional') || lNameLower.includes('profesional') || cNameLower.includes('argentina');
  }
  if (selectedLeague === 'CONCACAF') {
    return lNameLower.includes('concacaf');
  }
  if (selectedLeague === 'LALIGA') {
    return lNameLower.includes('laliga') || lNameLower.includes('españa') || cNameLower.includes('spain') || cNameLower.includes('españa');
  }
  if (selectedLeague === 'PREMIER') {
    return lNameLower.includes('premier') || lNameLower.includes('england') || cNameLower.includes('england') || cNameLower.includes('inglaterra');
  }
  if (selectedLeague === 'SUDAMERICA') {
    return (
      cNameLower.includes('colombia') ||
      cNameLower.includes('brazil') ||
      cNameLower.includes('argentina') ||
      cNameLower.includes('uruguay') ||
      cNameLower.includes('bolivia') ||
      cNameLower.includes('chile') ||
      cNameLower.includes('ecuador') ||
      cNameLower.includes('paraguay') ||
      cNameLower.includes('peru') ||
      lNameLower.includes('libertadores') ||
      lNameLower.includes('sudamericana')
    );
  }

  // If a specific filter was provided but didn't match, return false!
  return false;
}
