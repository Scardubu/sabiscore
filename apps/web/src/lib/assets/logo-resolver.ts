/**
 * Logo & Flag Resolution System for SabiScore
 * ============================================
 * 
 * Tiered asset resolution with caching and fallbacks:
 * 1. API-Football team logos (free tier: 100 req/day)
 * 2. TheSportsDB badges (free JSON API)
 * 3. FlagCDN country flags (SVG, unlimited)
 * 4. Emoji fallback (guaranteed render)
 * 
 * @version 1.1.0 - Added in-memory caching for performance
 */

// In-memory cache for resolved logos (reduces lookup overhead)
const LOGO_CACHE = new Map<string, LogoMeta>();
const CACHE_MAX_SIZE = 200;
const CACHE_KEYS: string[] = [];

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export interface LogoMeta {
  /** Primary URL to fetch (may be undefined if all sources unavailable) */
  url?: string;
  /** Fallback URLs in priority order */
  fallbackUrls: string[];
  /** Emoji placeholder for error states */
  placeholder: string;
  /** Source identifier for analytics/debugging */
  source: 'api-sports' | 'thesportsdb' | 'flagcdn' | 'placeholder';
  /** Cache key for localStorage/memory */
  cacheKey: string;
  /** Team/league colors for gradient fallback */
  colors?: string;
}

export interface TeamIdMapping {
  apiSportsId?: number;      // API-Football team ID
  sportsDbId?: number;       // TheSportsDB team ID (numeric)
  countryCode: string;       // ISO 3166-1 alpha-2 (e.g., 'GB', 'ES')
  emoji: string;             // Fallback emoji
  colors?: string;           // Team colors for gradient
}

export interface LeagueIdMapping {
  apiSportsId?: number;
  sportsDbId?: string;       // TheSportsDB league ID
  countryCode: string;
  emoji: string;
}

// ---------------------------------------------------------------------------
// API Endpoints (Free Tiers)
// ---------------------------------------------------------------------------

/**
 * API-Football (api-sports.io) - Free tier: 100 requests/day
 * Direct PNG URLs, no auth required for logos
 */
const API_SPORTS_TEAM_LOGO = (id: number) => 
  `https://media.api-sports.io/football/teams/${id}.png`;

const API_SPORTS_LEAGUE_LOGO = (id: number) =>
  `https://media.api-sports.io/football/leagues/${id}.png`;

/**
 * TheSportsDB - Free JSON API, unlimited requests
 * Badge URLs from their CDN
 */
const THESPORTSDB_TEAM_BADGE = (id: number) =>
  `https://www.thesportsdb.com/images/media/team/badge/${id}.png`;

const THESPORTSDB_LEAGUE_BADGE = (id: string) =>
  `https://www.thesportsdb.com/images/media/league/badge/${id}.png`;

/**
 * FlagCDN - Free, unlimited, SVG/PNG country flags
 */
const FLAGCDN_SVG = (code: string) =>
  `https://flagcdn.com/${code.toLowerCase()}.svg`;

const FLAGCDN_PNG = (code: string, size: number = 64) =>
  `https://flagcdn.com/${size}x${Math.round(size * 0.75)}/${code.toLowerCase()}.png`;

// ---------------------------------------------------------------------------
// Team ID Mappings (API-Sports & TheSportsDB)
// ---------------------------------------------------------------------------

/**
 * Comprehensive team ID mappings for major leagues
 * API-Sports IDs from https://www.api-football.com/documentation-v3#tag/Teams
 * TheSportsDB IDs from https://www.thesportsdb.com/api.php
 */
export const TEAM_IDS: Record<string, TeamIdMapping> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // PREMIER LEAGUE (England)
  // ═══════════════════════════════════════════════════════════════════════════
  "Arsenal": { apiSportsId: 42, sportsDbId: 133604, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Aston Villa": { apiSportsId: 66, sportsDbId: 133601, countryCode: "GB", emoji: "🟣", colors: "🟣🔵" },
  "Bournemouth": { apiSportsId: 35, sportsDbId: 134777, countryCode: "GB", emoji: "🍒", colors: "🍒⚫" },
  "Brentford": { apiSportsId: 55, sportsDbId: 133600, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Brighton": { apiSportsId: 51, sportsDbId: 133619, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Chelsea": { apiSportsId: 49, sportsDbId: 133610, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Crystal Palace": { apiSportsId: 52, sportsDbId: 133632, countryCode: "GB", emoji: "🔴", colors: "🔴🔵" },
  "Everton": { apiSportsId: 45, sportsDbId: 133615, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Fulham": { apiSportsId: 36, sportsDbId: 133600, countryCode: "GB", emoji: "⚪", colors: "⚪⚫" },
  "Ipswich Town": { apiSportsId: 57, sportsDbId: 133614, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Leicester City": { apiSportsId: 46, sportsDbId: 133616, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Liverpool": { apiSportsId: 40, sportsDbId: 133602, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Manchester City": { apiSportsId: 50, sportsDbId: 133613, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Manchester United": { apiSportsId: 33, sportsDbId: 133612, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Newcastle United": { apiSportsId: 34, sportsDbId: 134778, countryCode: "GB", emoji: "⚫", colors: "⚫⚪" },
  "Nottingham Forest": { apiSportsId: 65, sportsDbId: 133599, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Southampton": { apiSportsId: 41, sportsDbId: 134778, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Tottenham Hotspur": { apiSportsId: 47, sportsDbId: 133616, countryCode: "GB", emoji: "⚪", colors: "⚪🔵" },
  "West Ham United": { apiSportsId: 48, sportsDbId: 133620, countryCode: "GB", emoji: "🍷", colors: "🍷🔵" },
  "Wolverhampton": { apiSportsId: 39, sportsDbId: 133598, countryCode: "GB", emoji: "🟠", colors: "🟠⚫" },
  
  // Additional EPL teams
  "Burnley": { apiSportsId: 44, sportsDbId: 133606, countryCode: "GB", emoji: "🍷", colors: "🍷🔵" },
  "Luton Town": { apiSportsId: 1359, sportsDbId: 133607, countryCode: "GB", emoji: "🟠", colors: "🟠⚪" },
  "Sheffield United": { apiSportsId: 62, sportsDbId: 133621, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },

  // ═══════════════════════════════════════════════════════════════════════════
  // LA LIGA (Spain)
  // ═══════════════════════════════════════════════════════════════════════════
  "Real Madrid": { apiSportsId: 541, sportsDbId: 133738, countryCode: "ES", emoji: "⚪", colors: "⚪💜" },
  "Barcelona": { apiSportsId: 529, sportsDbId: 133739, countryCode: "ES", emoji: "🔵", colors: "🔵🔴" },
  "Atletico Madrid": { apiSportsId: 530, sportsDbId: 133740, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },
  "Sevilla": { apiSportsId: 536, sportsDbId: 133741, countryCode: "ES", emoji: "⚪", colors: "⚪🔴" },
  "Real Sociedad": { apiSportsId: 548, sportsDbId: 133749, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Real Betis": { apiSportsId: 543, sportsDbId: 133749, countryCode: "ES", emoji: "💚", colors: "💚⚪" },
  "Athletic Club": { apiSportsId: 531, sportsDbId: 133744, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },
  "Villarreal": { apiSportsId: 533, sportsDbId: 133742, countryCode: "ES", emoji: "🟡", colors: "🟡🔵" },
  "Valencia": { apiSportsId: 532, sportsDbId: 133742, countryCode: "ES", emoji: "🟠", colors: "⚪🟠" },
  "Girona": { apiSportsId: 547, sportsDbId: 134779, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },

  // ═══════════════════════════════════════════════════════════════════════════
  // SERIE A (Italy)
  // ═══════════════════════════════════════════════════════════════════════════
  "Inter Milan": { apiSportsId: 505, sportsDbId: 133642, countryCode: "IT", emoji: "🔵", colors: "🔵⚫" },
  "Milan": { apiSportsId: 489, sportsDbId: 133643, countryCode: "IT", emoji: "🔴", colors: "🔴⚫" },
  "Juventus": { apiSportsId: 496, sportsDbId: 133644, countryCode: "IT", emoji: "⚫", colors: "⚫⚪" },
  "Napoli": { apiSportsId: 492, sportsDbId: 133645, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Roma": { apiSportsId: 497, sportsDbId: 133646, countryCode: "IT", emoji: "🟡", colors: "🟡🔴" },
  "Lazio": { apiSportsId: 487, sportsDbId: 133647, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Atalanta": { apiSportsId: 499, sportsDbId: 133648, countryCode: "IT", emoji: "🔵", colors: "🔵⚫" },
  "Fiorentina": { apiSportsId: 502, sportsDbId: 133649, countryCode: "IT", emoji: "💜", colors: "💜⚪" },
  "Bologna": { apiSportsId: 500, sportsDbId: 133650, countryCode: "IT", emoji: "🔴", colors: "🔴🔵" },
  "Torino": { apiSportsId: 503, sportsDbId: 133651, countryCode: "IT", emoji: "🍷", colors: "🍷⚪" },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUNDESLIGA (Germany)
  // ═══════════════════════════════════════════════════════════════════════════
  "Bayern Munich": { apiSportsId: 157, sportsDbId: 133653, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Borussia Dortmund": { apiSportsId: 165, sportsDbId: 133654, countryCode: "DE", emoji: "🟡", colors: "🟡⚫" },
  "RB Leipzig": { apiSportsId: 173, sportsDbId: 140057, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Bayer Leverkusen": { apiSportsId: 168, sportsDbId: 133655, countryCode: "DE", emoji: "🔴", colors: "🔴⚫" },
  "Eintracht Frankfurt": { apiSportsId: 169, sportsDbId: 133656, countryCode: "DE", emoji: "⚫", colors: "⚫⚪🔴" },
  "VfL Wolfsburg": { apiSportsId: 161, sportsDbId: 133657, countryCode: "DE", emoji: "💚", colors: "💚⚪" },
  "Borussia Monchengladbach": { apiSportsId: 163, sportsDbId: 133658, countryCode: "DE", emoji: "⚫", colors: "⚫⚪💚" },
  "Union Berlin": { apiSportsId: 182, sportsDbId: 140029, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Freiburg": { apiSportsId: 160, sportsDbId: 133659, countryCode: "DE", emoji: "🔴", colors: "🔴⚫" },
  "Stuttgart": { apiSportsId: 172, sportsDbId: 133660, countryCode: "DE", emoji: "⚪", colors: "⚪🔴" },

  // ═══════════════════════════════════════════════════════════════════════════
  // LIGUE 1 (France)
  // ═══════════════════════════════════════════════════════════════════════════
  "Paris Saint-Germain": { apiSportsId: 85, sportsDbId: 133706, countryCode: "FR", emoji: "🔵", colors: "🔵🔴" },
  "Marseille": { apiSportsId: 81, sportsDbId: 133707, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
  "Lyon": { apiSportsId: 80, sportsDbId: 133708, countryCode: "FR", emoji: "🔵", colors: "🔵⚪🔴" },
  "Monaco": { apiSportsId: 91, sportsDbId: 133709, countryCode: "MC", emoji: "🔴", colors: "🔴⚪" },
  "Lille": { apiSportsId: 79, sportsDbId: 133710, countryCode: "FR", emoji: "🔴", colors: "🔴⚪" },
  "Nice": { apiSportsId: 84, sportsDbId: 133711, countryCode: "FR", emoji: "🔴", colors: "🔴⚫" },
  "Rennes": { apiSportsId: 94, sportsDbId: 133712, countryCode: "FR", emoji: "🔴", colors: "🔴⚫" },
  "Lens": { apiSportsId: 116, sportsDbId: 133713, countryCode: "FR", emoji: "🟡", colors: "🟡🔴" },
  "Brest": { apiSportsId: 106, sportsDbId: 134784, countryCode: "FR", emoji: "🔴", colors: "🔴⚪" },
  "Strasbourg": { apiSportsId: 95, sportsDbId: 133714, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PORTUGUESE PRIMEIRA LIGA
  // ═══════════════════════════════════════════════════════════════════════════
  "Benfica": { apiSportsId: 211, sportsDbId: 133592, countryCode: "PT", emoji: "🔴", colors: "🔴⚪" },
  "Porto": { apiSportsId: 212, sportsDbId: 133593, countryCode: "PT", emoji: "🔵", colors: "🔵⚪" },
  "Sporting CP": { apiSportsId: 228, sportsDbId: 133594, countryCode: "PT", emoji: "💚", colors: "💚⚪" },
  "Braga": { apiSportsId: 217, sportsDbId: 133595, countryCode: "PT", emoji: "🔴", colors: "🔴⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EREDIVISIE (Netherlands)
  // ═══════════════════════════════════════════════════════════════════════════
  "Ajax": { apiSportsId: 194, sportsDbId: 133561, countryCode: "NL", emoji: "🔴", colors: "🔴⚪" },
  "PSV Eindhoven": { apiSportsId: 197, sportsDbId: 133562, countryCode: "NL", emoji: "🔴", colors: "🔴⚪" },
  "Feyenoord": { apiSportsId: 215, sportsDbId: 133563, countryCode: "NL", emoji: "🔴", colors: "🔴⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SCOTTISH PREMIERSHIP
  // ═══════════════════════════════════════════════════════════════════════════
  "Celtic": { apiSportsId: 247, sportsDbId: 133788, countryCode: "GB", emoji: "💚", colors: "💚⚪" },
  "Rangers": { apiSportsId: 257, sportsDbId: 133789, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL LA LIGA TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Celta Vigo": { apiSportsId: 538, sportsDbId: 133745, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Espanyol": { apiSportsId: 540, sportsDbId: 133746, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Getafe": { apiSportsId: 546, sportsDbId: 133747, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Osasuna": { apiSportsId: 727, sportsDbId: 133748, countryCode: "ES", emoji: "🔴", colors: "🔴🔵" },
  "Mallorca": { apiSportsId: 798, sportsDbId: 133750, countryCode: "ES", emoji: "🔴", colors: "🔴⚫" },
  "Alaves": { apiSportsId: 542, sportsDbId: 133751, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Las Palmas": { apiSportsId: 534, sportsDbId: 133752, countryCode: "ES", emoji: "🟡", colors: "🟡🔵" },
  "Rayo Vallecano": { apiSportsId: 728, sportsDbId: 133753, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL SERIE A TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Udinese": { apiSportsId: 494, sportsDbId: 133652, countryCode: "IT", emoji: "⚫", colors: "⚫⚪" },
  "Sassuolo": { apiSportsId: 488, sportsDbId: 134699, countryCode: "IT", emoji: "💚", colors: "💚⚫" },
  "Empoli": { apiSportsId: 511, sportsDbId: 135790, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Verona": { apiSportsId: 504, sportsDbId: 133653, countryCode: "IT", emoji: "🟡", colors: "🟡🔵" },
  "Lecce": { apiSportsId: 867, sportsDbId: 138983, countryCode: "IT", emoji: "🟡", colors: "🟡🔴" },
  "Monza": { apiSportsId: 1579, sportsDbId: 139284, countryCode: "IT", emoji: "🔴", colors: "🔴⚪" },
  "Cagliari": { apiSportsId: 490, sportsDbId: 133654, countryCode: "IT", emoji: "🔴", colors: "🔴🔵" },
  "Genoa": { apiSportsId: 495, sportsDbId: 133655, countryCode: "IT", emoji: "🔴", colors: "🔴🔵" },
  "Parma": { apiSportsId: 523, sportsDbId: 133656, countryCode: "IT", emoji: "🟡", colors: "🟡🔵" },
  "Como": { apiSportsId: 1543, sportsDbId: 140256, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Venezia": { apiSportsId: 517, sportsDbId: 133657, countryCode: "IT", emoji: "🟠", colors: "🟠💚⚫" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL BUNDESLIGA TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Hoffenheim": { apiSportsId: 167, sportsDbId: 133661, countryCode: "DE", emoji: "🔵", colors: "🔵⚪" },
  "Werder Bremen": { apiSportsId: 162, sportsDbId: 133662, countryCode: "DE", emoji: "💚", colors: "💚⚪" },
  "Mainz": { apiSportsId: 164, sportsDbId: 133663, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Augsburg": { apiSportsId: 170, sportsDbId: 133664, countryCode: "DE", emoji: "🔴", colors: "🔴💚⚪" },
  "Heidenheim": { apiSportsId: 180, sportsDbId: 140325, countryCode: "DE", emoji: "🔴", colors: "🔴🔵" },
  "St Pauli": { apiSportsId: 186, sportsDbId: 133665, countryCode: "DE", emoji: "🟤", colors: "🟤⚪" },
  "Holstein Kiel": { apiSportsId: 192, sportsDbId: 140526, countryCode: "DE", emoji: "🔵", colors: "🔵⚪" },
  "Bochum": { apiSportsId: 176, sportsDbId: 133666, countryCode: "DE", emoji: "🔵", colors: "🔵⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL LIGUE 1 TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Toulouse": { apiSportsId: 96, sportsDbId: 133715, countryCode: "FR", emoji: "💜", colors: "💜⚪" },
  "Montpellier": { apiSportsId: 82, sportsDbId: 133716, countryCode: "FR", emoji: "🟠", colors: "🟠🔵" },
  "Nantes": { apiSportsId: 83, sportsDbId: 133717, countryCode: "FR", emoji: "🟡", colors: "🟡💚" },
  "Reims": { apiSportsId: 93, sportsDbId: 133718, countryCode: "FR", emoji: "🔴", colors: "🔴⚪" },
  "Auxerre": { apiSportsId: 99, sportsDbId: 133719, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
  "Angers": { apiSportsId: 77, sportsDbId: 133720, countryCode: "FR", emoji: "⚫", colors: "⚫⚪" },
  "Saint-Etienne": { apiSportsId: 1063, sportsDbId: 133721, countryCode: "FR", emoji: "💚", colors: "💚⚪" },
  "Le Havre": { apiSportsId: 103, sportsDbId: 140327, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
};

// ---------------------------------------------------------------------------
// League ID Mappings
// ---------------------------------------------------------------------------

export const LEAGUE_IDS: Record<string, LeagueIdMapping> = {
  "EPL": { apiSportsId: 39, sportsDbId: "4328", countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "Premier League": { apiSportsId: 39, sportsDbId: "4328", countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "La Liga": { apiSportsId: 140, sportsDbId: "4335", countryCode: "ES", emoji: "🇪🇸" },
  "Serie A": { apiSportsId: 135, sportsDbId: "4332", countryCode: "IT", emoji: "🇮🇹" },
  "Bundesliga": { apiSportsId: 78, sportsDbId: "4331", countryCode: "DE", emoji: "🇩🇪" },
  "Ligue 1": { apiSportsId: 61, sportsDbId: "4334", countryCode: "FR", emoji: "🇫🇷" },
  "Champions League": { apiSportsId: 2, sportsDbId: "4480", countryCode: "EU", emoji: "🇪🇺" },
  "Europa League": { apiSportsId: 3, sportsDbId: "4481", countryCode: "EU", emoji: "🇪🇺" },
  "Conference League": { apiSportsId: 848, sportsDbId: "4749", countryCode: "EU", emoji: "🇪🇺" },
  // Additional leagues
  "Primeira Liga": { apiSportsId: 94, sportsDbId: "4344", countryCode: "PT", emoji: "🇵🇹" },
  "Eredivisie": { apiSportsId: 88, sportsDbId: "4337", countryCode: "NL", emoji: "🇳🇱" },
  "Scottish Premiership": { apiSportsId: 179, sportsDbId: "4330", countryCode: "GB", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  "FA Cup": { apiSportsId: 45, sportsDbId: "4482", countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "EFL Cup": { apiSportsId: 48, sportsDbId: "4570", countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "Copa del Rey": { apiSportsId: 143, sportsDbId: "4483", countryCode: "ES", emoji: "🇪🇸" },
  "Coppa Italia": { apiSportsId: 137, sportsDbId: "4486", countryCode: "IT", emoji: "🇮🇹" },
  "DFB Pokal": { apiSportsId: 81, sportsDbId: "4485", countryCode: "DE", emoji: "🇩🇪" },
  "Coupe de France": { apiSportsId: 66, sportsDbId: "4484", countryCode: "FR", emoji: "🇫🇷" },
};

// ---------------------------------------------------------------------------
// Resolution Functions
// ---------------------------------------------------------------------------

/**
 * Resolve team logo with tiered fallbacks
 */
export function resolveTeamLogo(teamName: string): LogoMeta {
  const mapping = TEAM_IDS[teamName];
  
  if (!mapping) {
    // Unknown team: use country flag or generic
    return {
      url: undefined,
      fallbackUrls: [],
      placeholder: "⚽",
      source: 'placeholder',
      cacheKey: `team_${teamName.toLowerCase().replace(/\s+/g, '_')}`,
    };
  }

  const urls: string[] = [];
  
  // Priority 1: API-Sports (best quality, but rate limited)
  if (mapping.apiSportsId) {
    urls.push(API_SPORTS_TEAM_LOGO(mapping.apiSportsId));
  }
  
  // Priority 2: TheSportsDB (free, unlimited)
  if (mapping.sportsDbId) {
    urls.push(THESPORTSDB_TEAM_BADGE(mapping.sportsDbId));
  }
  
  // Priority 3: Country flag from FlagCDN
  urls.push(FLAGCDN_SVG(mapping.countryCode));

  return {
    url: urls[0],
    fallbackUrls: urls.slice(1),
    placeholder: mapping.emoji,
    source: mapping.apiSportsId ? 'api-sports' : mapping.sportsDbId ? 'thesportsdb' : 'flagcdn',
    cacheKey: `team_${teamName.toLowerCase().replace(/\s+/g, '_')}`,
    colors: mapping.colors,
  };
}

/**
 * Resolve league logo with fallbacks
 */
export function resolveLeagueLogo(league: string): LogoMeta {
  const mapping = LEAGUE_IDS[league];
  
  if (!mapping) {
    return {
      url: undefined,
      fallbackUrls: [],
      placeholder: "🏆",
      source: 'placeholder',
      cacheKey: `league_${league.toLowerCase().replace(/\s+/g, '_')}`,
    };
  }

  const urls: string[] = [];
  
  if (mapping.apiSportsId) {
    urls.push(API_SPORTS_LEAGUE_LOGO(mapping.apiSportsId));
  }
  
  if (mapping.sportsDbId) {
    urls.push(THESPORTSDB_LEAGUE_BADGE(mapping.sportsDbId));
  }
  
  // Fallback to country flag
  if (mapping.countryCode !== 'EU') {
    urls.push(FLAGCDN_SVG(mapping.countryCode));
  }

  return {
    url: urls[0],
    fallbackUrls: urls.slice(1),
    placeholder: mapping.emoji,
    source: mapping.apiSportsId ? 'api-sports' : 'thesportsdb',
    cacheKey: `league_${league.toLowerCase().replace(/\s+/g, '_')}`,
  };
}

/**
 * Get country flag URL
 */
export function getCountryFlag(countryCode: string, format: 'svg' | 'png' = 'svg'): string {
  return format === 'svg' 
    ? FLAGCDN_SVG(countryCode)
    : FLAGCDN_PNG(countryCode, 64);
}

/**
 * Get country flag for a team
 */
export function getTeamCountryFlag(teamName: string): string | undefined {
  const mapping = TEAM_IDS[teamName];
  return mapping ? FLAGCDN_SVG(mapping.countryCode) : undefined;
}

// ---------------------------------------------------------------------------
// Caching Utilities (uses LOGO_CACHE defined at top of file)
// ---------------------------------------------------------------------------

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached logo URL or undefined
 */
export function getCachedLogo(cacheKey: string): string | undefined {
  const cached = LOGO_CACHE.get(cacheKey);
  if (!cached) return undefined;
  
  // Check if it's the new format with timestamp
  if ('timestamp' in cached && 'url' in cached) {
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.url;
    }
    return undefined;
  }
  
  // Old format - just return the LogoMeta
  return cached.url;
}

/**
 * Cache a logo URL with timestamp
 */
export function setCachedLogo(cacheKey: string, url: string): void {
  LOGO_CACHE.set(cacheKey, { url, timestamp: Date.now() } as any);
}

/**
 * Pre-warm cache for critical teams (call on app init)
 */
export function prewarmLogoCache(teamNames: string[]): void {
  teamNames.forEach(name => {
    const meta = resolveTeamLogo(name);
    if (meta.url) {
      setCachedLogo(meta.cacheKey, meta.url);
    }
  });
}

// Export constants for external use
export { FLAGCDN_SVG, FLAGCDN_PNG, API_SPORTS_TEAM_LOGO, THESPORTSDB_TEAM_BADGE };
