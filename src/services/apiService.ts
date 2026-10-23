import { MatchFixture, CacheMetadata, H2HSummary } from '../types';

export const API_KEY_STORAGE_KEY = 'futbolstats_apikey';
export const CACHE_PREFIX = 'futbolstats_fixtures_v2_';
export const CACHE_META_PREFIX = 'futbolstats_cache_meta_v2_';

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch {
    // ignore local storage errors in private mode
  }
}

// Generate rich, realistic elite fixtures for any given date
function generateHighCaliberFixtures(dateStr: string): MatchFixture[] {
  // Use dateStr as seed so fixtures for the same date are consistent
  const dateHash = dateStr.split('-').reduce((acc, part) => acc + parseInt(part || '0', 10), 0);

  const fixtureBlueprints: Omit<MatchFixture, 'id' | 'date'>[] = [
    // 0. Copa Colombia BetPlay: Independiente Santa Fe vs Llaneros FC
    {
      time: '18:30',
      status: 'SCHEDULED',
      league: {
        id: 240,
        name: 'Copa Colombia BetPlay',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Octavos de Final',
        avgGoalsPerMatch: 2.35,
        avgCardsPerMatch: 5.1
      },
      homeTeam: {
        id: 1133,
        name: 'Independiente Santa Fe',
        shortName: 'Santa Fe',
        logo: 'https://media.api-sports.io/football/teams/1133.png',
        rank: 3,
        points: 52,
        form: ['W', 'D', 'W', 'W', 'D'],
        attackStrength: 1.35,
        defenseStrength: 0.85,
        avgShotsPerMatch: 13.8,
        avgShotsOnTarget: 5.4,
        restHours: 96,
        starPlayer: {
          name: 'Hugo Rodallega',
          position: 'Delantero',
          goalsSeason: 14,
          expectedShots: 3.5,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.28
        }
      },
      awayTeam: {
        id: 1139,
        name: 'Llaneros FC',
        shortName: 'Llaneros',
        logo: 'https://media.api-sports.io/football/teams/1139.png',
        rank: 12,
        points: 36,
        form: ['D', 'W', 'L', 'D', 'W'],
        attackStrength: 1.05,
        defenseStrength: 1.15,
        avgShotsPerMatch: 10.2,
        avgShotsOnTarget: 3.8,
        restHours: 72,
        starPlayer: {
          name: 'Néider Ospina',
          position: 'Extremo',
          goalsSeason: 7,
          expectedShots: 2.4,
          expectedShotsOnTarget: 1.1,
          goalConversionRate: 0.22
        }
      },
      referee: {
        name: 'Wilmar Roldán',
        nationality: 'Colombia',
        rigor: 'Moderado',
        avgYellowCards: 4.6,
        avgRedCards: 0.22,
        foulsPerCard: 5.4
      },
      venue: {
        name: 'Estadio Nemesio Camacho El Campín',
        city: 'Bogotá',
        capacity: 36343
      },
      travel: {
        awayDistanceKm: 120,
        awayFlightHours: 0.5
      },
      derbyOrRivalry: false
    },

    // 0.1 Copa Colombia BetPlay: Atlético Nacional vs Cúcuta Deportivo
    {
      time: '20:30',
      status: 'SCHEDULED',
      league: {
        id: 240,
        name: 'Copa Colombia BetPlay',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Octavos de Final',
        avgGoalsPerMatch: 2.42,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 1131,
        name: 'Atlético Nacional',
        shortName: 'Atl. Nacional',
        logo: 'https://media.api-sports.io/football/teams/1131.png',
        rank: 2,
        points: 58,
        form: ['W', 'W', 'D', 'W', 'L'],
        attackStrength: 1.45,
        defenseStrength: 0.79,
        avgShotsPerMatch: 15.2,
        avgShotsOnTarget: 6.2,
        restHours: 96,
        starPlayer: {
          name: 'Alfredo Morelos',
          position: 'Delantero',
          goalsSeason: 12,
          expectedShots: 3.8,
          expectedShotsOnTarget: 2.0,
          goalConversionRate: 0.30
        }
      },
      awayTeam: {
        id: 1137,
        name: 'Cúcuta Deportivo',
        shortName: 'Cúcuta',
        logo: 'https://media.api-sports.io/football/teams/1137.png',
        rank: 14,
        points: 32,
        form: ['L', 'D', 'W', 'L', 'D'],
        attackStrength: 0.95,
        defenseStrength: 1.25,
        avgShotsPerMatch: 9.8,
        avgShotsOnTarget: 3.5,
        restHours: 72,
        starPlayer: {
          name: 'Jaime Peralta',
          position: 'Delantero',
          goalsSeason: 6,
          expectedShots: 2.2,
          expectedShotsOnTarget: 1.0,
          goalConversionRate: 0.20
        }
      },
      referee: {
        name: 'Carlos Betancur',
        nationality: 'Colombia',
        rigor: 'Severo',
        avgYellowCards: 5.2,
        avgRedCards: 0.28,
        foulsPerCard: 4.8
      },
      venue: {
        name: 'Estadio Atanasio Girardot',
        city: 'Medellín',
        capacity: 44863
      },
      travel: {
        awayDistanceKm: 580,
        awayFlightHours: 1.1
      },
      derbyOrRivalry: true
    },

    // 0.2 Copa Colombia BetPlay: Alianza FC vs Deportivo Pasto (En Vivo / 2H)
    {
      time: '16:10',
      status: 'IN_PLAY',
      currentScore: {
        home: 1,
        away: 1,
        minute: 82
      },
      league: {
        id: 240,
        name: 'Copa Colombia BetPlay',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Octavos de Final',
        avgGoalsPerMatch: 2.30,
        avgCardsPerMatch: 4.9
      },
      homeTeam: {
        id: 1138,
        name: 'Alianza FC',
        shortName: 'Alianza',
        logo: 'https://media.api-sports.io/football/teams/1138.png',
        rank: 8,
        points: 40,
        form: ['D', 'L', 'W', 'D', 'W'],
        attackStrength: 1.15,
        defenseStrength: 1.05,
        avgShotsPerMatch: 11.5,
        avgShotsOnTarget: 4.2,
        restHours: 72,
        starPlayer: {
          name: 'Mayer Gil',
          position: 'Extremo',
          goalsSeason: 6,
          expectedShots: 2.6,
          expectedShotsOnTarget: 1.2,
          goalConversionRate: 0.24
        }
      },
      awayTeam: {
        id: 1135,
        name: 'Deportivo Pasto',
        shortName: 'Pasto',
        logo: 'https://media.api-sports.io/football/teams/1135.png',
        rank: 7,
        points: 42,
        form: ['W', 'D', 'L', 'W', 'D'],
        attackStrength: 1.18,
        defenseStrength: 1.02,
        avgShotsPerMatch: 12.0,
        avgShotsOnTarget: 4.5,
        restHours: 72,
        starPlayer: {
          name: 'Daniel Moreno',
          position: 'Delantero',
          goalsSeason: 9,
          expectedShots: 3.1,
          expectedShotsOnTarget: 1.5,
          goalConversionRate: 0.26
        }
      },
      referee: {
        name: 'Jhon Hinestroza',
        nationality: 'Colombia',
        rigor: 'Moderado',
        avgYellowCards: 4.5,
        avgRedCards: 0.18,
        foulsPerCard: 5.0
      },
      venue: {
        name: 'Estadio Armando Maestre Pavajeau',
        city: 'Valledupar',
        capacity: 11000
      },
      travel: {
        awayDistanceKm: 980,
        awayFlightHours: 2.1
      },
      derbyOrRivalry: false
    },

    // 0.3 Colombia Primera B: Leones FC vs Barranquilla FC (En Vivo / 2H)
    {
      time: '16:00',
      status: 'IN_PLAY',
      currentScore: {
        home: 1,
        away: 0,
        minute: 88
      },
      league: {
        id: 241,
        name: 'Torneo BetPlay (Primera B)',
        country: 'Colombia',
        flag: '🇨🇴',
        round: 'Jornada 14',
        avgGoalsPerMatch: 2.20,
        avgCardsPerMatch: 5.2
      },
      homeTeam: {
        id: 1140,
        name: 'Leones FC',
        shortName: 'Leones',
        logo: 'https://media.api-sports.io/football/teams/1140.png',
        rank: 9,
        points: 28,
        form: ['W', 'L', 'D', 'W', 'L'],
        attackStrength: 1.10,
        defenseStrength: 1.10,
        avgShotsPerMatch: 10.8,
        avgShotsOnTarget: 4.0,
        restHours: 72,
        starPlayer: {
          name: 'Nicolás Restrepo',
          position: 'Delantero',
          goalsSeason: 5,
          expectedShots: 2.4,
          expectedShotsOnTarget: 1.1,
          goalConversionRate: 0.22
        }
      },
      awayTeam: {
        id: 1141,
        name: 'Barranquilla FC',
        shortName: 'Barranquilla',
        logo: 'https://media.api-sports.io/football/teams/1141.png',
        rank: 10,
        points: 26,
        form: ['L', 'D', 'L', 'W', 'D'],
        attackStrength: 1.02,
        defenseStrength: 1.18,
        avgShotsPerMatch: 9.9,
        avgShotsOnTarget: 3.4,
        restHours: 72,
        starPlayer: {
          name: 'Miller Bacca',
          position: 'Delantero',
          goalsSeason: 4,
          expectedShots: 2.1,
          expectedShotsOnTarget: 0.9,
          goalConversionRate: 0.20
        }
      },
      referee: {
        name: 'Diego Ulloa',
        nationality: 'Colombia',
        rigor: 'Moderado',
        avgYellowCards: 4.8,
        avgRedCards: 0.25,
        foulsPerCard: 5.1
      },
      venue: {
        name: 'Estadio Metropolitano Ciudad de Itagüí',
        city: 'Itagüí',
        capacity: 12000
      },
      travel: {
        awayDistanceKm: 700,
        awayFlightHours: 1.3
      },
      derbyOrRivalry: false
    },

    // 1. LaLiga: Real Madrid vs FC Barcelona (El Clásico)
    {
      time: '21:00',
      status: 'SCHEDULED',
      league: {
        id: 140,
        name: 'LaLiga EA Sports',
        country: 'España',
        flag: '🇪🇸',
        round: 'Jornada 28',
        avgGoalsPerMatch: 2.68,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 541,
        name: 'Real Madrid CF',
        shortName: 'Real Madrid',
        logo: 'https://media.api-sports.io/football/teams/541.png',
        rank: 1,
        points: 68,
        form: ['W', 'W', 'D', 'W', 'W'],
        attackStrength: 1.48,
        defenseStrength: 0.78,
        avgShotsPerMatch: 16.4,
        avgShotsOnTarget: 6.8,
        restHours: 96,
        starPlayer: {
          name: 'Kylian Mbappé',
          position: 'Delantero',
          goalsSeason: 22,
          expectedShots: 4.2,
          expectedShotsOnTarget: 2.1,
          goalConversionRate: 0.29
        }
      },
      awayTeam: {
        id: 529,
        name: 'FC Barcelona',
        shortName: 'Barcelona',
        logo: 'https://media.api-sports.io/football/teams/529.png',
        rank: 2,
        points: 65,
        form: ['W', 'W', 'W', 'L', 'W'],
        attackStrength: 1.44,
        defenseStrength: 0.82,
        avgShotsPerMatch: 15.8,
        avgShotsOnTarget: 6.2,
        restHours: 72,
        starPlayer: {
          name: 'Robert Lewandowski',
          position: 'Delantero',
          goalsSeason: 20,
          expectedShots: 3.8,
          expectedShotsOnTarget: 1.9,
          goalConversionRate: 0.28
        }
      },
      referee: {
        name: 'Jesús Gil Manzano',
        nationality: 'España',
        rigor: 'Severo',
        avgYellowCards: 5.6,
        avgRedCards: 0.32,
        foulsPerCard: 4.1
      },
      venue: {
        name: 'Estadio Santiago Bernabéu',
        city: 'Madrid',
        capacity: 84000
      },
      travel: {
        awayDistanceKm: 620,
        awayFlightHours: 1.2
      },
      derbyOrRivalry: true
    },
    // 2. Premier League: Manchester City vs Arsenal
    {
      time: '17:30',
      status: 'SCHEDULED',
      league: {
        id: 39,
        name: 'Premier League',
        country: 'Inglaterra',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        round: 'Matchweek 30',
        avgGoalsPerMatch: 2.95,
        avgCardsPerMatch: 4.2
      },
      homeTeam: {
        id: 50,
        name: 'Manchester City',
        shortName: 'Man City',
        logo: 'https://media.api-sports.io/football/teams/50.png',
        rank: 2,
        points: 67,
        form: ['W', 'W', 'W', 'D', 'W'],
        attackStrength: 1.55,
        defenseStrength: 0.80,
        avgShotsPerMatch: 17.5,
        avgShotsOnTarget: 7.2,
        restHours: 120,
        starPlayer: {
          name: 'Erling Haaland',
          position: 'Delantero',
          goalsSeason: 26,
          expectedShots: 4.5,
          expectedShotsOnTarget: 2.4,
          goalConversionRate: 0.32
        }
      },
      awayTeam: {
        id: 42,
        name: 'Arsenal FC',
        shortName: 'Arsenal',
        logo: 'https://media.api-sports.io/football/teams/42.png',
        rank: 1,
        points: 69,
        form: ['W', 'W', 'W', 'W', 'D'],
        attackStrength: 1.42,
        defenseStrength: 0.72,
        avgShotsPerMatch: 15.2,
        avgShotsOnTarget: 5.8,
        restHours: 96,
        starPlayer: {
          name: 'Bukayo Saka',
          position: 'Extremo',
          goalsSeason: 15,
          expectedShots: 3.2,
          expectedShotsOnTarget: 1.4,
          goalConversionRate: 0.24
        }
      },
      referee: {
        name: 'Michael Oliver',
        nationality: 'Inglaterra',
        rigor: 'Moderado',
        avgYellowCards: 4.1,
        avgRedCards: 0.18,
        foulsPerCard: 5.4
      },
      venue: {
        name: 'Etihad Stadium',
        city: 'Manchester',
        capacity: 53400
      },
      travel: {
        awayDistanceKm: 330,
        awayFlightHours: 0.8
      },
      derbyOrRivalry: false
    },
    // 3. Champions League: Bayern München vs Paris Saint-Germain
    {
      time: '21:00',
      status: 'SCHEDULED',
      league: {
        id: 2,
        name: 'UEFA Champions League',
        country: 'Europa',
        flag: '🇪🇺',
        round: 'Cuartos de Final',
        avgGoalsPerMatch: 3.05,
        avgCardsPerMatch: 4.5
      },
      homeTeam: {
        id: 157,
        name: 'Bayern München',
        shortName: 'Bayern',
        logo: 'https://media.api-sports.io/football/teams/157.png',
        rank: 1,
        points: 62,
        form: ['W', 'W', 'W', 'W', 'L'],
        attackStrength: 1.58,
        defenseStrength: 0.84,
        avgShotsPerMatch: 18.2,
        avgShotsOnTarget: 7.4,
        restHours: 72,
        starPlayer: {
          name: 'Harry Kane',
          position: 'Delantero',
          goalsSeason: 28,
          expectedShots: 4.6,
          expectedShotsOnTarget: 2.3,
          goalConversionRate: 0.31
        }
      },
      awayTeam: {
        id: 85,
        name: 'Paris Saint-Germain',
        shortName: 'PSG',
        logo: 'https://media.api-sports.io/football/teams/85.png',
        rank: 1,
        points: 64,
        form: ['W', 'D', 'W', 'W', 'W'],
        attackStrength: 1.45,
        defenseStrength: 0.86,
        avgShotsPerMatch: 16.0,
        avgShotsOnTarget: 6.5,
        restHours: 68, // fatigued (<72h)
        starPlayer: {
          name: 'Ousmane Dembélé',
          position: 'Extremo',
          goalsSeason: 12,
          expectedShots: 3.4,
          expectedShotsOnTarget: 1.5,
          goalConversionRate: 0.22
        }
      },
      referee: {
        name: 'Szymon Marciniak',
        nationality: 'Polonia',
        rigor: 'Severo',
        avgYellowCards: 5.1,
        avgRedCards: 0.28,
        foulsPerCard: 4.6
      },
      venue: {
        name: 'Allianz Arena',
        city: 'Múnich',
        capacity: 75000
      },
      travel: {
        awayDistanceKm: 840,
        awayFlightHours: 4.2 // Long travel
      },
      derbyOrRivalry: false
    },
    // 4. Serie A: Inter Milan vs Juventus (Derby d'Italia)
    {
      time: '20:45',
      status: 'SCHEDULED',
      league: {
        id: 135,
        name: 'Serie A',
        country: 'Italia',
        flag: '🇮🇹',
        round: 'Giornata 29',
        avgGoalsPerMatch: 2.58,
        avgCardsPerMatch: 5.1
      },
      homeTeam: {
        id: 505,
        name: 'Inter Milano',
        shortName: 'Inter',
        logo: 'https://media.api-sports.io/football/teams/505.png',
        rank: 1,
        points: 71,
        form: ['W', 'W', 'W', 'W', 'W'],
        attackStrength: 1.42,
        defenseStrength: 0.68,
        avgShotsPerMatch: 15.6,
        avgShotsOnTarget: 5.9,
        restHours: 144,
        starPlayer: {
          name: 'Lautaro Martínez',
          position: 'Delantero',
          goalsSeason: 23,
          expectedShots: 4.0,
          expectedShotsOnTarget: 1.9,
          goalConversionRate: 0.29
        }
      },
      awayTeam: {
        id: 496,
        name: 'Juventus FC',
        shortName: 'Juventus',
        logo: 'https://media.api-sports.io/football/teams/496.png',
        rank: 3,
        points: 59,
        form: ['D', 'W', 'D', 'W', 'L'],
        attackStrength: 1.18,
        defenseStrength: 0.74,
        avgShotsPerMatch: 12.8,
        avgShotsOnTarget: 4.6,
        restHours: 96,
        starPlayer: {
          name: 'Dušan Vlahović',
          position: 'Delantero',
          goalsSeason: 16,
          expectedShots: 3.5,
          expectedShotsOnTarget: 1.6,
          goalConversionRate: 0.26
        }
      },
      referee: {
        name: 'Daniele Orsato',
        nationality: 'Italia',
        rigor: 'Severo',
        avgYellowCards: 5.4,
        avgRedCards: 0.30,
        foulsPerCard: 4.2
      },
      venue: {
        name: 'Stadio Giuseppe Meazza (San Siro)',
        city: 'Milán',
        capacity: 75817
      },
      travel: {
        awayDistanceKm: 140,
        awayFlightHours: 0.5
      },
      derbyOrRivalry: true
    },
    // 5. Premier League: Liverpool vs Chelsea
    {
      time: '15:00',
      status: 'SCHEDULED',
      league: {
        id: 39,
        name: 'Premier League',
        country: 'Inglaterra',
        flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
        round: 'Matchweek 30',
        avgGoalsPerMatch: 2.95,
        avgCardsPerMatch: 4.2
      },
      homeTeam: {
        id: 40,
        name: 'Liverpool FC',
        shortName: 'Liverpool',
        logo: 'https://media.api-sports.io/football/teams/40.png',
        rank: 3,
        points: 64,
        form: ['W', 'D', 'W', 'W', 'W'],
        attackStrength: 1.46,
        defenseStrength: 0.82,
        avgShotsPerMatch: 16.8,
        avgShotsOnTarget: 6.4,
        restHours: 96,
        starPlayer: {
          name: 'Mohamed Salah',
          position: 'Extremo',
          goalsSeason: 19,
          expectedShots: 3.9,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.27
        }
      },
      awayTeam: {
        id: 49,
        name: 'Chelsea FC',
        shortName: 'Chelsea',
        logo: 'https://media.api-sports.io/football/teams/49.png',
        rank: 6,
        points: 49,
        form: ['W', 'W', 'L', 'D', 'W'],
        attackStrength: 1.25,
        defenseStrength: 0.98,
        avgShotsPerMatch: 13.9,
        avgShotsOnTarget: 5.1,
        restHours: 70, // fatigued (<72h)
        starPlayer: {
          name: 'Cole Palmer',
          position: 'Mediapunta',
          goalsSeason: 17,
          expectedShots: 3.6,
          expectedShotsOnTarget: 1.6,
          goalConversionRate: 0.26
        }
      },
      referee: {
        name: 'Anthony Taylor',
        nationality: 'Inglaterra',
        rigor: 'Moderado',
        avgYellowCards: 4.3,
        avgRedCards: 0.20,
        foulsPerCard: 5.0
      },
      venue: {
        name: 'Anfield',
        city: 'Liverpool',
        capacity: 61276
      },
      travel: {
        awayDistanceKm: 350,
        awayFlightHours: 0.9
      },
      derbyOrRivalry: false
    },
    // 6. LaLiga: Atlético de Madrid vs Sevilla FC
    {
      time: '18:30',
      status: 'SCHEDULED',
      league: {
        id: 140,
        name: 'LaLiga EA Sports',
        country: 'España',
        flag: '🇪🇸',
        round: 'Jornada 28',
        avgGoalsPerMatch: 2.68,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 530,
        name: 'Atlético de Madrid',
        shortName: 'Atlético',
        logo: 'https://media.api-sports.io/football/teams/530.png',
        rank: 3,
        points: 58,
        form: ['W', 'L', 'W', 'W', 'D'],
        attackStrength: 1.28,
        defenseStrength: 0.76,
        avgShotsPerMatch: 14.1,
        avgShotsOnTarget: 5.3,
        restHours: 120,
        starPlayer: {
          name: 'Antoine Griezmann',
          position: 'Mediapunta',
          goalsSeason: 14,
          expectedShots: 3.3,
          expectedShotsOnTarget: 1.5,
          goalConversionRate: 0.25
        }
      },
      awayTeam: {
        id: 536,
        name: 'Sevilla FC',
        shortName: 'Sevilla',
        logo: 'https://media.api-sports.io/football/teams/536.png',
        rank: 12,
        points: 34,
        form: ['L', 'D', 'W', 'L', 'D'],
        attackStrength: 1.05,
        defenseStrength: 1.12,
        avgShotsPerMatch: 11.8,
        avgShotsOnTarget: 4.0,
        restHours: 96,
        starPlayer: {
          name: 'Isaac Romero',
          position: 'Delantero',
          goalsSeason: 9,
          expectedShots: 2.8,
          expectedShotsOnTarget: 1.1,
          goalConversionRate: 0.21
        }
      },
      referee: {
        name: 'Alejandro Hernández Hernández',
        nationality: 'España',
        rigor: 'Severo',
        avgYellowCards: 5.8,
        avgRedCards: 0.35,
        foulsPerCard: 3.9
      },
      venue: {
        name: 'Cívitas Metropolitano',
        city: 'Madrid',
        capacity: 70460
      },
      travel: {
        awayDistanceKm: 530,
        awayFlightHours: 1.1
      },
      derbyOrRivalry: false
    },
    // 7. Bundesliga: Borussia Dortmund vs Bayer Leverkusen
    {
      time: '18:30',
      status: 'SCHEDULED',
      league: {
        id: 78,
        name: 'Bundesliga',
        country: 'Alemania',
        flag: '🇩🇪',
        round: 'Spieltag 27',
        avgGoalsPerMatch: 3.18,
        avgCardsPerMatch: 3.9
      },
      homeTeam: {
        id: 165,
        name: 'Borussia Dortmund',
        shortName: 'Dortmund',
        logo: 'https://media.api-sports.io/football/teams/165.png',
        rank: 4,
        points: 52,
        form: ['W', 'W', 'D', 'L', 'W'],
        attackStrength: 1.38,
        defenseStrength: 0.94,
        avgShotsPerMatch: 15.4,
        avgShotsOnTarget: 6.0,
        restHours: 96,
        starPlayer: {
          name: 'Serhou Guirassy',
          position: 'Delantero',
          goalsSeason: 18,
          expectedShots: 3.7,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.28
        }
      },
      awayTeam: {
        id: 168,
        name: 'Bayer 04 Leverkusen',
        shortName: 'Leverkusen',
        logo: 'https://media.api-sports.io/football/teams/168.png',
        rank: 2,
        points: 60,
        form: ['W', 'W', 'W', 'D', 'W'],
        attackStrength: 1.45,
        defenseStrength: 0.81,
        avgShotsPerMatch: 16.2,
        avgShotsOnTarget: 6.6,
        restHours: 72,
        starPlayer: {
          name: 'Florian Wirtz',
          position: 'Mediapunta',
          goalsSeason: 14,
          expectedShots: 3.5,
          expectedShotsOnTarget: 1.7,
          goalConversionRate: 0.25
        }
      },
      referee: {
        name: 'Felix Zwayer',
        nationality: 'Alemania',
        rigor: 'Moderado',
        avgYellowCards: 4.4,
        avgRedCards: 0.16,
        foulsPerCard: 5.2
      },
      venue: {
        name: 'Signal Iduna Park',
        city: 'Dortmund',
        capacity: 81365
      },
      travel: {
        awayDistanceKm: 85,
        awayFlightHours: 0.4
      },
      derbyOrRivalry: false
    },
    // 8. Copa Libertadores: River Plate vs Flamengo
    {
      time: '21:30',
      status: 'SCHEDULED',
      league: {
        id: 13,
        name: 'Copa Libertadores',
        country: 'Sudamérica',
        flag: '🏆',
        round: 'Fase de Grupos',
        avgGoalsPerMatch: 2.62,
        avgCardsPerMatch: 5.7
      },
      homeTeam: {
        id: 435,
        name: 'CA River Plate',
        shortName: 'River Plate',
        logo: 'https://media.api-sports.io/football/teams/435.png',
        rank: 1,
        points: 12,
        form: ['W', 'W', 'W', 'D', 'W'],
        attackStrength: 1.35,
        defenseStrength: 0.74,
        avgShotsPerMatch: 15.0,
        avgShotsOnTarget: 5.8,
        restHours: 120,
        starPlayer: {
          name: 'Miguel Borja',
          position: 'Delantero',
          goalsSeason: 16,
          expectedShots: 3.8,
          expectedShotsOnTarget: 1.8,
          goalConversionRate: 0.28
        }
      },
      awayTeam: {
        id: 127,
        name: 'CR Flamengo',
        shortName: 'Flamengo',
        logo: 'https://media.api-sports.io/football/teams/127.png',
        rank: 2,
        points: 10,
        form: ['W', 'L', 'W', 'W', 'D'],
        attackStrength: 1.32,
        defenseStrength: 0.85,
        avgShotsPerMatch: 14.2,
        avgShotsOnTarget: 5.4,
        restHours: 65, // fatigued
        starPlayer: {
          name: 'Pedro',
          position: 'Delantero',
          goalsSeason: 19,
          expectedShots: 3.9,
          expectedShotsOnTarget: 1.9,
          goalConversionRate: 0.29
        }
      },
      referee: {
        name: 'Wilton Sampaio',
        nationality: 'Brasil',
        rigor: 'Severo',
        avgYellowCards: 6.2,
        avgRedCards: 0.42,
        foulsPerCard: 3.7
      },
      venue: {
        name: 'Estadio Monumental',
        city: 'Buenos Aires',
        capacity: 84567
      },
      travel: {
        awayDistanceKm: 2650,
        awayFlightHours: 4.5 // international flight
      },
      derbyOrRivalry: true
    },
    // 9. LaLiga: Valencia CF vs RCD Espanyol (Pelea por Permanencia)
    {
      time: '14:00',
      status: 'SCHEDULED',
      league: {
        id: 140,
        name: 'LaLiga EA Sports',
        country: 'España',
        flag: '🇪🇸',
        round: 'Jornada 28',
        avgGoalsPerMatch: 2.68,
        avgCardsPerMatch: 4.8
      },
      homeTeam: {
        id: 532,
        name: 'Valencia CF',
        shortName: 'Valencia',
        logo: 'https://media.api-sports.io/football/teams/532.png',
        rank: 17,
        points: 27,
        form: ['L', 'D', 'W', 'L', 'L'],
        attackStrength: 0.92,
        defenseStrength: 1.15,
        avgShotsPerMatch: 11.2,
        avgShotsOnTarget: 3.8,
        restHours: 144,
        starPlayer: {
          name: 'Hugo Duro',
          position: 'Delantero',
          goalsSeason: 10,
          expectedShots: 2.7,
          expectedShotsOnTarget: 1.0,
          goalConversionRate: 0.22
        }
      },
      awayTeam: {
        id: 540,
        name: 'RCD Espanyol',
        shortName: 'Espanyol',
        logo: 'https://media.api-sports.io/football/teams/540.png',
        rank: 18,
        points: 25,
        form: ['D', 'L', 'L', 'W', 'L'],
        attackStrength: 0.88,
        defenseStrength: 1.25,
        avgShotsPerMatch: 10.4,
        avgShotsOnTarget: 3.4,
        restHours: 120,
        starPlayer: {
          name: 'Javi Puado',
          position: 'Extremo',
          goalsSeason: 8,
          expectedShots: 2.4,
          expectedShotsOnTarget: 0.9,
          goalConversionRate: 0.20
        }
      },
      referee: {
        name: 'César Soto Grado',
        nationality: 'España',
        rigor: 'Severo',
        avgYellowCards: 5.9,
        avgRedCards: 0.38,
        foulsPerCard: 3.8
      },
      venue: {
        name: 'Estadio de Mestalla',
        city: 'Valencia',
        capacity: 49430
      },
      travel: {
        awayDistanceKm: 350,
        awayFlightHours: 0.9
      },
      derbyOrRivalry: false
    }
  ];

  return fixtureBlueprints.map((item, index) => {
    return {
      ...item,
      id: `fix-${dateStr}-${index + 1}-${dateHash % 997}`,
      date: dateStr,
      h2h: item.h2h || computeH2H(
        item.homeTeam.id,
        item.awayTeam.id,
        item.homeTeam.attackStrength,
        item.homeTeam.defenseStrength,
        item.awayTeam.attackStrength,
        item.awayTeam.defenseStrength
      )
    };
  });
}

export function computeH2H(
  homeId: number,
  awayId: number,
  homeAttack: number,
  homeDefense: number,
  awayAttack: number,
  awayDefense: number
): H2HSummary {
  const seed = (Math.abs(homeId) * 37 + Math.abs(awayId) * 19) % 100;
  const strengthDiff = (homeAttack / Math.max(0.1, homeDefense)) - (awayAttack / Math.max(0.1, awayDefense));

  let homeWins = 2;
  let draws = 1;
  let awayWins = 2;

  if (strengthDiff > 0.3) {
    homeWins = 3 + (seed % 2);
    draws = (seed + 1) % 2;
    awayWins = Math.max(0, 5 - homeWins - draws);
  } else if (strengthDiff < -0.3) {
    awayWins = 3 + (seed % 2);
    draws = (seed + 1) % 2;
    homeWins = Math.max(0, 5 - awayWins - draws);
  } else {
    draws = 1 + (seed % 2);
    const bias = seed % 3;
    homeWins = bias === 0 ? 2 : bias === 1 ? 1 : 2;
    awayWins = Math.max(0, 5 - homeWins - draws);
  }

  homeWins = Math.max(0, homeWins);
  awayWins = Math.max(0, awayWins);
  draws = Math.max(0, 5 - homeWins - awayWins);

  return {
    totalMatches: 5,
    homeWins,
    draws,
    awayWins
  };
}

const KNOWN_CLUBS: Record<string, { atk: number; def: number; rank: number; star: string; starPos: string; shots: number }> = {
  'real madrid': { atk: 1.48, def: 0.78, rank: 1, star: 'Kylian Mbappé', starPos: 'Delantero', shots: 16.5 },
  'barcelona': { atk: 1.44, def: 0.82, rank: 2, star: 'Robert Lewandowski', starPos: 'Delantero', shots: 15.8 },
  'manchester city': { atk: 1.55, def: 0.80, rank: 2, star: 'Erling Haaland', starPos: 'Delantero', shots: 17.5 },
  'arsenal': { atk: 1.42, def: 0.72, rank: 1, star: 'Bukayo Saka', starPos: 'Extremo', shots: 15.2 },
  'liverpool': { atk: 1.46, def: 0.82, rank: 3, star: 'Mohamed Salah', starPos: 'Extremo', shots: 16.8 },
  'chelsea': { atk: 1.25, def: 0.98, rank: 6, star: 'Cole Palmer', starPos: 'Mediapunta', shots: 13.9 },
  'bayern': { atk: 1.58, def: 0.84, rank: 1, star: 'Harry Kane', starPos: 'Delantero', shots: 18.2 },
  'psg': { atk: 1.45, def: 0.86, rank: 1, star: 'Ousmane Dembélé', starPos: 'Extremo', shots: 16.0 },
  'paris': { atk: 1.45, def: 0.86, rank: 1, star: 'Ousmane Dembélé', starPos: 'Extremo', shots: 16.0 },
  'inter': { atk: 1.42, def: 0.68, rank: 1, star: 'Lautaro Martínez', starPos: 'Delantero', shots: 15.6 },
  'juventus': { atk: 1.18, def: 0.74, rank: 3, star: 'Dušan Vlahović', starPos: 'Delantero', shots: 12.8 },
  'milan': { atk: 1.26, def: 0.88, rank: 4, star: 'Rafael Leão', starPos: 'Extremo', shots: 14.0 },
  'atletico': { atk: 1.28, def: 0.76, rank: 3, star: 'Antoine Griezmann', starPos: 'Mediapunta', shots: 14.1 },
  'dortmund': { atk: 1.38, def: 0.94, rank: 4, star: 'Serhou Guirassy', starPos: 'Delantero', shots: 15.4 },
  'leverkusen': { atk: 1.45, def: 0.81, rank: 2, star: 'Florian Wirtz', starPos: 'Mediapunta', shots: 16.2 },
  'river': { atk: 1.35, def: 0.74, rank: 1, star: 'Miguel Borja', starPos: 'Delantero', shots: 15.0 },
  'flamengo': { atk: 1.32, def: 0.85, rank: 2, star: 'Pedro', starPos: 'Delantero', shots: 14.2 },
  'boca': { atk: 1.20, def: 0.82, rank: 4, star: 'Edinson Cavani', starPos: 'Delantero', shots: 13.5 },
  'palmeiras': { atk: 1.34, def: 0.76, rank: 2, star: 'Estêvão', starPos: 'Extremo', shots: 14.8 },
  'sevilla': { atk: 1.05, def: 1.12, rank: 12, star: 'Isaac Romero', starPos: 'Delantero', shots: 11.8 },
  'valencia': { atk: 0.95, def: 1.15, rank: 17, star: 'Hugo Duro', starPos: 'Delantero', shots: 11.2 },
  'espanyol': { atk: 0.90, def: 1.22, rank: 18, star: 'Javi Puado', starPos: 'Extremo', shots: 10.4 },
  'aston villa': { atk: 1.30, def: 0.92, rank: 5, star: 'Ollie Watkins', starPos: 'Delantero', shots: 14.4 },
  'tottenham': { atk: 1.32, def: 1.02, rank: 7, star: 'Son Heung-min', starPos: 'Delantero', shots: 14.8 }
};

function getTeamRating(name: string, id: number, isHome: boolean) {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(KNOWN_CLUBS)) {
    if (lower.includes(key)) {
      return {
        rank: val.rank,
        points: Math.max(15, 75 - val.rank * 3),
        attackStrength: val.atk,
        defenseStrength: val.def,
        shots: val.shots,
        starName: val.star,
        starPos: val.starPos
      };
    }
  }

  // Deterministic calculation from team ID and name to give realistic variation
  const hash = (id * 17 + name.length * 31 + (isHome ? 13 : 7)) % 100;
  const rank = Math.max(1, Math.min(20, Math.floor(hash / 5) + 1));
  const attackStrength = Math.round((1.45 - (rank * 0.035) + ((hash % 10) * 0.015)) * 100) / 100;
  const defenseStrength = Math.round((0.72 + (rank * 0.032) - ((hash % 8) * 0.01)) * 100) / 100;
  const shots = Math.round((16.5 - rank * 0.28) * 10) / 10;
  const points = Math.max(18, 72 - rank * 3);

  return {
    rank,
    points,
    attackStrength: Math.max(0.75, Math.min(1.65, attackStrength)),
    defenseStrength: Math.max(0.65, Math.min(1.40, defenseStrength)),
    shots: Math.max(9.0, shots),
    starName: `Goleador #${(hash % 9) + 7}`,
    starPos: 'Delantero'
  };
}

// Helper: Convert date/timestamp to Colombian Time (America/Bogota, UTC-5)
export function formatToColombiaTime(isoOrTimestamp: string | number | undefined): { date: string; time: string; fullLabel: string } {
  if (!isoOrTimestamp) {
    return { date: getColombiaDateString(), time: '19:00', fullLabel: '19:00 (Hora Col)' };
  }
  const d = typeof isoOrTimestamp === 'number'
    ? new Date(isoOrTimestamp < 1e12 ? isoOrTimestamp * 1000 : isoOrTimestamp)
    : new Date(isoOrTimestamp);

  if (isNaN(d.getTime())) {
    return { date: getColombiaDateString(), time: '19:00', fullLabel: '19:00 (Hora Col)' };
  }

  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);

  const time = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);

  return { date, time, fullLabel: `${time} (Hora Col)` };
}

export function getColombiaDateString(offsetDays = 0): string {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

// Convert raw API-Football v3 response item into normalized MatchFixture in Colombian Time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiSportsFixture(raw: any, fallbackTargetDate: string): MatchFixture {
  const fixtureId = String(raw.fixture?.id || Math.random());
  
  // Format kickoff explicitly to Colombia Time (UTC-5 / America/Bogota)
  const rawDateOrTimestamp = raw.fixture?.timestamp ? raw.fixture.timestamp * 1000 : raw.fixture?.date;
  const colombiaTimeInfo = formatToColombiaTime(rawDateOrTimestamp);
  const kickoff = colombiaTimeInfo.time;
  const matchDate = colombiaTimeInfo.date || fallbackTargetDate;

  const statusShort = String(raw.fixture?.status?.short || '').toUpperCase();
  const elapsed = raw.fixture?.status?.elapsed;

  const hasGoalsReported =
    (raw.goals?.home !== null && raw.goals?.home !== undefined) ||
    (raw.score?.fulltime?.home !== null && raw.score?.fulltime?.home !== undefined);
  const homeGoals = raw.goals?.home ?? raw.score?.fulltime?.home ?? 0;
  const awayGoals = raw.goals?.away ?? raw.score?.fulltime?.away ?? 0;

  // Determine kickoff timestamp in ms
  const matchTimestampMs = raw.fixture?.timestamp
    ? raw.fixture.timestamp * 1000
    : raw.fixture?.date
    ? new Date(raw.fixture.date).getTime()
    : 0;

  const nowMs = Date.now();
  const minutesSinceKickoff = matchTimestampMs > 0 ? (nowMs - matchTimestampMs) / 60000 : -1;

  let status: 'SCHEDULED' | 'IN_PLAY' | 'FINISHED' = 'SCHEDULED';

  // 1. Explicit finished status from provider
  if (['FT', 'AET', 'PEN', 'AWD', 'WO'].includes(statusShort)) {
    status = 'FINISHED';
  }
  // 2. Explicit live in-play status
  else if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(statusShort)) {
    status = 'IN_PLAY';
  }
  // 3. Match has final goals reported and match was played or 90 mins elapsed
  else if (hasGoalsReported && (elapsed >= 90 || minutesSinceKickoff >= 105)) {
    status = 'FINISHED';
  }
  // 4. Match has goals and is currently underway
  else if (hasGoalsReported && minutesSinceKickoff > 0 && minutesSinceKickoff < 105) {
    status = 'IN_PLAY';
  }
  // 5. Kickoff was more than 115 minutes ago -> in reality it has already ended
  else if (matchTimestampMs > 0 && minutesSinceKickoff >= 115) {
    status = 'FINISHED';
  }
  // 6. Kickoff was between 0 and 115 minutes ago -> in reality it is currently playing
  else if (matchTimestampMs > 0 && minutesSinceKickoff > 0 && minutesSinceKickoff < 115) {
    status = 'IN_PLAY';
  }
  // 7. Kickoff is genuinely in the future
  else {
    status = 'SCHEDULED';
  }

  const currentScore =
    status !== 'SCHEDULED' || hasGoalsReported
      ? {
          home: Number(homeGoals),
          away: Number(awayGoals),
          minute: elapsed ?? (status === 'IN_PLAY' ? Math.max(1, Math.min(90, Math.floor(minutesSinceKickoff))) : 90)
        }
      : undefined;

  const refName = raw.fixture?.referee || 'Árbitro Principal Oficial';
  const rigor: 'Severo' | 'Moderado' | 'Flexible' =
    refName.toLowerCase().includes('manzano') ||
    refName.toLowerCase().includes('lahoz') ||
    refName.toLowerCase().includes('marciniak') ||
    refName.toLowerCase().includes('sampaio')
      ? 'Severo'
      : refName.toLowerCase().includes('turpin') ||
        refName.toLowerCase().includes('taylor') ||
        refName.toLowerCase().includes('zwayer')
      ? 'Flexible'
      : 'Moderado';

  const homeTeamName = raw.teams?.home?.name || 'Equipo Local';
  const homeTeamId = raw.teams?.home?.id || 1;
  const awayTeamName = raw.teams?.away?.name || 'Equipo Visitante';
  const awayTeamId = raw.teams?.away?.id || 2;

  const homeRating = getTeamRating(homeTeamName, homeTeamId, true);
  const awayRating = getTeamRating(awayTeamName, awayTeamId, false);

  return {
    id: fixtureId,
    date: matchDate,
    time: kickoff,
    status,
    currentScore,
    league: {
      id: raw.league?.id || 1,
      name: raw.league?.name || 'Liga de Primera División',
      country: raw.league?.country || 'Internacional',
      flag: raw.league?.flag || '⚽',
      round: raw.league?.round || 'Jornada Regular',
      avgGoalsPerMatch: 2.75,
      avgCardsPerMatch: 4.5
    },
    homeTeam: {
      id: homeTeamId,
      name: homeTeamName,
      shortName: homeTeamName.split(' ')[0],
      logo: raw.teams?.home?.logo || 'https://media.api-sports.io/football/teams/541.png',
      rank: homeRating.rank,
      points: homeRating.points,
      form: ['W', 'D', 'W', 'W', 'L'],
      attackStrength: homeRating.attackStrength,
      defenseStrength: homeRating.defenseStrength,
      avgShotsPerMatch: homeRating.shots,
      avgShotsOnTarget: Math.round(homeRating.shots * 0.42 * 10) / 10,
      restHours: 96,
      starPlayer: {
        name: homeRating.starName,
        position: homeRating.starPos,
        goalsSeason: Math.max(6, Math.floor(homeRating.attackStrength * 12)),
        expectedShots: Math.round(homeRating.shots * 0.26 * 10) / 10,
        expectedShotsOnTarget: Math.round(homeRating.shots * 0.12 * 10) / 10,
        goalConversionRate: 0.28
      }
    },
    awayTeam: {
      id: awayTeamId,
      name: awayTeamName,
      shortName: awayTeamName.split(' ')[0],
      logo: raw.teams?.away?.logo || 'https://media.api-sports.io/football/teams/529.png',
      rank: awayRating.rank,
      points: awayRating.points,
      form: ['W', 'L', 'D', 'W', 'W'],
      attackStrength: awayRating.attackStrength,
      defenseStrength: awayRating.defenseStrength,
      avgShotsPerMatch: awayRating.shots,
      avgShotsOnTarget: Math.round(awayRating.shots * 0.39 * 10) / 10,
      restHours: 72,
      starPlayer: {
        name: awayRating.starName,
        position: awayRating.starPos,
        goalsSeason: Math.max(5, Math.floor(awayRating.attackStrength * 10)),
        expectedShots: Math.round(awayRating.shots * 0.24 * 10) / 10,
        expectedShotsOnTarget: Math.round(awayRating.shots * 0.11 * 10) / 10,
        goalConversionRate: 0.25
      }
    },
    referee: {
      name: refName,
      nationality: raw.league?.country || 'Internacional',
      rigor,
      avgYellowCards: rigor === 'Severo' ? 4.8 : rigor === 'Flexible' ? 3.4 : 4.0,
      avgRedCards: rigor === 'Severo' ? 0.22 : 0.12,
      foulsPerCard: 5.2
    },
    venue: {
      name: raw.fixture?.venue?.name || 'Estadio Principal',
      city: raw.fixture?.venue?.city || 'Sede',
      capacity: 50000
    },
    travel: {
      awayDistanceKm: 420,
      awayFlightHours: 1.2
    },
    derbyOrRivalry: Boolean(homeRating.rank <= 4 && awayRating.rank <= 4),
    h2h: computeH2H(
      homeTeamId,
      awayTeamId,
      homeRating.attackStrength,
      homeRating.defenseStrength,
      awayRating.attackStrength,
      awayRating.defenseStrength
    )
  };
}

function sortFixturesByPriority(list: MatchFixture[]): MatchFixture[] {
  return [...list].sort((a, b) => {
    // Priority order: Live (0), Upcoming/Scheduled (1), Finished (2)
    const priority = (s: MatchFixture['status']) => (s === 'IN_PLAY' ? 0 : s === 'SCHEDULED' ? 1 : 2);
    const diff = priority(a.status) - priority(b.status);
    if (diff !== 0) return diff;
    return a.time.localeCompare(b.time);
  });
}

export async function checkSecretServerStatus(): Promise<{ hasKey: boolean; source: string }> {
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // server not running full-stack
  }
  return { hasKey: false, source: 'none' };
}

export async function saveSecretServerApiKey(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/set-secret-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, message: `Error HTTP ${res.status}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

const UPCOMING_CACHE_PREFIX = 'futbolstats_upcoming_v5_';
const UPCOMING_CACHE_TTL_MS = 25 * 60 * 1000; // 25 minutes in localStorage for maximum quota protection

export interface UpcomingCachePayload {
  fixtures: MatchFixture[];
  timestamp: number;
  dateStr: string;
}

export function getLocalUpcomingCache(dateStr: string): { fixtures: MatchFixture[]; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(`${UPCOMING_CACHE_PREFIX}${dateStr}`);
    if (!raw) return null;
    const parsed: UpcomingCachePayload = JSON.parse(raw);
    const age = Date.now() - parsed.timestamp;
    // Invalidate if contains mock IDs or synthetic test matches
    const hasMock = parsed.fixtures.some((f) => {
      const idStr = String(f.id);
      return idStr.startsWith('fix-') || idStr === '991001' || idStr === '991002' || idStr === '991003';
    });
    if (hasMock) {
      localStorage.removeItem(`${UPCOMING_CACHE_PREFIX}${dateStr}`);
      return null;
    }
    if (age < UPCOMING_CACHE_TTL_MS && Array.isArray(parsed.fixtures)) {
      return { fixtures: parsed.fixtures, cachedAt: parsed.timestamp };
    }
  } catch (e) {
    console.warn('Error reading upcoming cache from localStorage', e);
  }
  return null;
}

export function saveLocalUpcomingCache(dateStr: string, fixtures: MatchFixture[]): void {
  try {
    // Only save real fixtures, never mock data or synthetic test fixtures
    const isMock = fixtures.some(f => {
      const idStr = String(f.id);
      return idStr.startsWith('fix-') || idStr === '991001' || idStr === '991002' || idStr === '991003';
    });
    if (isMock) return;

    const payload: UpcomingCachePayload = {
      fixtures,
      timestamp: Date.now(),
      dateStr
    };
    localStorage.setItem(`${UPCOMING_CACHE_PREFIX}${dateStr}`, JSON.stringify(payload));
  } catch (e) {
    console.warn('Error saving upcoming cache to localStorage', e);
  }
}

export async function fetchUpcomingFixtures(
  dateStr?: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{
  fixtures: MatchFixture[];
  count: number;
  fromLocalStorage: boolean;
  error?: string;
  cachedAt?: number;
  remainingCalls?: number;
  quotaShieldActive?: boolean;
}> {
  const targetDate = dateStr || getColombiaDateString(0);

  // 1. Check localStorage FIRST if not forcing refresh
  if (!options.forceRefresh) {
    const local = getLocalUpcomingCache(targetDate);
    if (local && Array.isArray(local.fixtures)) {
      return {
        fixtures: local.fixtures,
        count: local.fixtures.length,
        fromLocalStorage: true,
        cachedAt: local.cachedAt
      };
    }
  }

  // 2. Fetch from server proxy with official API
  try {
    const forceParam = options.forceRefresh ? '&force=true' : '';
    const url = `/api/upcoming?date=${targetDate}${forceParam}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.fixtures)) {
        const mapped: MatchFixture[] = json.fixtures
          .map((f: unknown) => {
            const raw = f as { fixture?: { date?: string; id?: number } };
            const fixtureDate = raw.fixture?.date ? raw.fixture.date.split('T')[0] : targetDate;
            return mapApiSportsFixture(f, fixtureDate);
          })
          .filter((fix: MatchFixture) => {
            const idStr = String(fix.id);
            if (idStr === '991001' || idStr === '991002' || idStr === '991003') return false;
            return fix.status === 'SCHEDULED' || fix.status === 'IN_PLAY';
          });

        saveLocalUpcomingCache(targetDate, mapped);
        return {
          fixtures: mapped,
          count: mapped.length,
          fromLocalStorage: false,
          cachedAt: Date.now(),
          remainingCalls: json.remainingCalls,
          quotaShieldActive: json.quotaShieldActive
        };
      }
      const message = typeof json.message === 'string'
        ? json.message
        : typeof json.error === 'string'
        ? json.error
        : 'El servidor no devolvió partidos válidos.';
      console.error(`FutbolStats Pro: respuesta inválida de /api/upcoming (${res.status}): ${message}`);
      return {
        fixtures: [],
        count: 0,
        fromLocalStorage: false,
        error: message,
        cachedAt: Date.now()
      };
    }
    const message = `El servidor de estadísticas respondió HTTP ${res.status}.`;
    console.error(`FutbolStats Pro: ${message}`);
    return {
      fixtures: [],
      count: 0,
      fromLocalStorage: false,
      error: message,
      cachedAt: Date.now()
    };
  } catch (err) {
    console.warn('FutbolStats Pro: Error al conectar con proxy de partidos próximos', err);
    const message = err instanceof Error ? err.message : String(err);
    return {
      fixtures: [],
      count: 0,
      fromLocalStorage: false,
      error: `No se pudo conectar con el servidor de estadísticas: ${message}`,
      cachedAt: Date.now()
    };
  }
}

export async function fetchFixturesForDate(dateStr: string): Promise<{ fixtures: MatchFixture[]; meta: CacheMetadata }> {
  const cacheKey = `${CACHE_PREFIX}${dateStr}`;
  const metaKey = `${CACHE_META_PREFIX}${dateStr}`;

  // Step 1: Check localStorage Cache first (0 calls consumed)
  try {
    const cachedData = localStorage.getItem(cacheKey);
    const cachedMeta = localStorage.getItem(metaKey);

    if (cachedData && cachedMeta) {
      const fixtures: MatchFixture[] = JSON.parse(cachedData);
      const meta: CacheMetadata = JSON.parse(cachedMeta);
      if (Array.isArray(fixtures) && fixtures.length > 0) {
        const hasSyntheticFixtures = fixtures.some((fixture) => String(fixture.id).startsWith('fix-'));
        if (!hasSyntheticFixtures) {
          return {
            fixtures: sortFixturesByPriority(fixtures),
            meta: {
              ...meta,
              source: 'cache',
              callsConsumed: 0 // 0 calls consumed on read
            }
          };
        }
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(metaKey);
      }
    }
  } catch (err) {
    console.warn('FutbolStats Pro: Error al leer cache local', err);
  }

  // Step 2: Secret Server Proxy (Key is 100% hidden on server, never sent to client)
  try {
    const serverProxyRes = await fetch(`/api/fixtures?date=${dateStr}`);
    if (serverProxyRes.ok) {
      const serverJson = await serverProxyRes.json();
      if (serverJson.success && Array.isArray(serverJson.fixtures) && serverJson.fixtures.length > 0) {
        const rawMapped = serverJson.fixtures.slice(0, 30).map((f: unknown) => mapApiSportsFixture(f, dateStr));
        const mappedFixtures = sortFixturesByPriority(rawMapped);
        const meta: CacheMetadata = {
          date: dateStr,
          cachedAt: new Date().toISOString(),
          source: 'api',
          callsConsumed: serverJson.source === 'server_cache' ? 0 : 1,
          remainingCalls: serverJson.remainingCalls ?? 90,
          totalMatches: mappedFixtures.length
        };

        try {
          localStorage.setItem(cacheKey, JSON.stringify(mappedFixtures));
          localStorage.setItem(metaKey, JSON.stringify(meta));
        } catch {
          // ignore storage error
        }

        return { fixtures: mappedFixtures, meta };
      }
    }
  } catch {
    // server proxy inactive or in offline mode
  }

  // Step 3: Fallback client key if configured
  const apiKey = getStoredApiKey();

  if (apiKey) {
    try {
      const response = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateStr}`, {
        method: 'GET',
        headers: {
          'x-apisports-key': apiKey
        }
      });

      if (response.ok) {
        const json = await response.json();
        const rawFixtures = json.response;

        if (Array.isArray(rawFixtures) && rawFixtures.length > 0) {
          const rawMapped = rawFixtures.slice(0, 30).map(f => mapApiSportsFixture(f, dateStr));
          const mappedFixtures = sortFixturesByPriority(rawMapped);
          const remaining = parseInt(response.headers.get('x-ratelimit-requests-remaining') || '99', 10);

          const meta: CacheMetadata = {
            date: dateStr,
            cachedAt: new Date().toISOString(),
            source: 'api',
            callsConsumed: 1,
            remainingCalls: isNaN(remaining) ? 99 : remaining,
            totalMatches: mappedFixtures.length
          };

          try {
            localStorage.setItem(cacheKey, JSON.stringify(mappedFixtures));
            localStorage.setItem(metaKey, JSON.stringify(meta));
          } catch {
            // storage quota full fallback
          }

          return { fixtures: mappedFixtures, meta };
        }
      }
    } catch {
      console.info('FutbolStats Pro: API no disponible o cuota superada.');
    }
  }

  // Do not present generated fixtures as real matches when data sources fail.
  const fallbackMeta: CacheMetadata = {
    date: dateStr,
    cachedAt: new Date().toISOString(),
    source: 'fallback',
    callsConsumed: 0,
    remainingCalls: 100,
    totalMatches: 0,
    error: 'No fue posible obtener partidos reales desde las fuentes disponibles.'
  };

  return { fixtures: [], meta: fallbackMeta };
}

export function clearLocalCache(): void {
  try {
    fetch('/api/clear-cache', { method: 'POST' }).catch(() => {});
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('futbolstats_fixtures_') || key.startsWith('futbolstats_cache_meta_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.error('Error al limpiar caché', err);
  }
}

export function getCacheStats(): { datesCached: number; estimatedKb: number } {
  try {
    let datesCached = 0;
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        datesCached++;
        const val = localStorage.getItem(key) || '';
        totalBytes += key.length + val.length;
      }
    }
    return { datesCached, estimatedKb: Math.round(totalBytes / 1024) };
  } catch {
    return { datesCached: 0, estimatedKb: 0 };
  }
}

function normalizeClientTeamKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|ac|cd|ud|club|deportivo|atletico|athletic|real|sporting)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export interface LivePulseSyncResult {
  updatedFixtures: MatchFixture[];
  changedIds: string[];
  liveCount: number;
  syncedAt: number;
}

/**
 * Polls /api/live-pulse (45-second hybrid live engine, 0 API-Football quota cost)
 * and merges any live score or minute changes into the current fixtures list.
 */
export async function syncLivePulseFixtures(
  dateStr: string,
  currentFixtures: MatchFixture[]
): Promise<LivePulseSyncResult> {
  if (!Array.isArray(currentFixtures) || currentFixtures.length === 0) {
    return { updatedFixtures: currentFixtures, changedIds: [], liveCount: 0, syncedAt: Date.now() };
  }

  try {
    const res = await fetch(`/api/live-pulse?date=${encodeURIComponent(dateStr)}`);
    if (!res.ok) {
      return { updatedFixtures: currentFixtures, changedIds: [], liveCount: 0, syncedAt: Date.now() };
    }
    const json = await res.json();
    const deltas: Array<{
      id?: string;
      homeKey: string;
      awayKey: string;
      homeScore: number;
      awayScore: number;
      minute: number;
      status: 'IN_PLAY' | 'FINISHED' | 'SCHEDULED';
    }> = Array.isArray(json.deltas) ? json.deltas : [];

    const changedIds: string[] = [];
    let liveCount = 0;

    const updatedFixtures = currentFixtures.map((fix) => {
      const hKey = normalizeClientTeamKey(fix.homeTeam.name);
      const aKey = normalizeClientTeamKey(fix.awayTeam.name);

      const delta = deltas.find(
        (d) =>
          (d.id && String(d.id) === String(fix.id)) ||
          (d.homeKey &&
            d.awayKey &&
            hKey &&
            aKey &&
            (d.homeKey.includes(hKey) || hKey.includes(d.homeKey)) &&
            (d.awayKey.includes(aKey) || aKey.includes(d.awayKey)))
      );

      if (delta) {
        const prevHome = fix.currentScore?.home ?? 0;
        const prevAway = fix.currentScore?.away ?? 0;
        const prevMin = fix.currentScore?.minute ?? 0;
        const prevStatus = fix.status;

        const nextStatus = delta.status === 'IN_PLAY' ? 'IN_PLAY' : fix.status;
        if (nextStatus === 'IN_PLAY') liveCount++;

        if (
          prevHome !== delta.homeScore ||
          prevAway !== delta.awayScore ||
          prevMin !== delta.minute ||
          prevStatus !== nextStatus
        ) {
          changedIds.push(fix.id);
          return {
            ...fix,
            status: nextStatus,
            currentScore: {
              home: delta.homeScore,
              away: delta.awayScore,
              minute: delta.minute
            }
          };
        }
      } else if (fix.status === 'IN_PLAY' && fix.currentScore) {
        liveCount++;
        const nextMinute = Math.min(90, (fix.currentScore.minute || 45) + 1);
        if (nextMinute !== fix.currentScore.minute) {
          changedIds.push(fix.id);
          return {
            ...fix,
            currentScore: {
              ...fix.currentScore,
              minute: nextMinute
            }
          };
        }
      }

      return fix;
    });

    if (changedIds.length > 0) {
      saveLocalUpcomingCache(dateStr, updatedFixtures);
    }

    return {
      updatedFixtures,
      changedIds,
      liveCount,
      syncedAt: Date.now()
    };
  } catch {
    return { updatedFixtures: currentFixtures, changedIds: [], liveCount: 0, syncedAt: Date.now() };
  }
}
