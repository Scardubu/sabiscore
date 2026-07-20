/**
 * Logo & Flag Resolution System for SabiScore
 * ============================================
 * 
 * Tiered asset resolution with caching and fallbacks:
 * 1. API-Football team logos (free tier: 100 req/day)
 * 2. FlagCDN country flags (SVG, unlimited)
 * 3. Emoji fallback (reliable render)
 * 
 * @version 1.2.0 - Removed TheSportsDB (unreliable URL patterns)
 */

type LogoCacheEntry = LogoMeta | { url: string; timestamp: number };

// In-memory cache for resolved logos (reduces lookup overhead)
const LOGO_CACHE = new Map<string, LogoCacheEntry>();
// Reserved for future LRU eviction
const _CACHE_MAX_SIZE = 200;
const _CACHE_KEYS: string[] = [];

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export interface LogoMeta {
  /** Primary URL to fetch (may be undefined if all sources unavailable) */
  url?: string;
  /** Optional cache timestamp for TTL handling */
  timestamp?: number;
  /** Fallback URLs in priority order */
  fallbackUrls: string[];
  /** Emoji placeholder for error states */
  placeholder: string;
  /** Source identifier for analytics/debugging */
  source: 'api-sports' | 'flagcdn' | 'placeholder';
  /** Cache key for localStorage/memory */
  cacheKey: string;
  /** Team/league colors for gradient fallback */
  colors?: string;
}

export interface TeamIdMapping {
  apiSportsId?: number;      // API-Football team ID
  countryCode: string;       // ISO 3166-1 alpha-2 (e.g., 'GB', 'ES')
  emoji: string;             // Fallback emoji
  colors?: string;           // Team colors for gradient
}

export interface LeagueIdMapping {
  apiSportsId?: number;
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
  "Arsenal": { apiSportsId: 42, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Aston Villa": { apiSportsId: 66, countryCode: "GB", emoji: "🟣", colors: "🟣🔵" },
  "Bournemouth": { apiSportsId: 35, countryCode: "GB", emoji: "🍒", colors: "🍒⚫" },
  "Brentford": { apiSportsId: 55, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Brighton": { apiSportsId: 51, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Chelsea": { apiSportsId: 49, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Crystal Palace": { apiSportsId: 52, countryCode: "GB", emoji: "🔴", colors: "🔴🔵" },
  "Everton": { apiSportsId: 45, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Fulham": { apiSportsId: 36, countryCode: "GB", emoji: "⚪", colors: "⚪⚫" },
  "Ipswich Town": { apiSportsId: 57, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Leicester City": { apiSportsId: 46, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Liverpool": { apiSportsId: 40, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Manchester City": { apiSportsId: 50, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  "Manchester United": { apiSportsId: 33, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Newcastle United": { apiSportsId: 34, countryCode: "GB", emoji: "⚫", colors: "⚫⚪" },
  "Nottingham Forest": { apiSportsId: 65, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Southampton": { apiSportsId: 41, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },
  "Tottenham Hotspur": { apiSportsId: 47, countryCode: "GB", emoji: "⚪", colors: "⚪🔵" },
  "West Ham United": { apiSportsId: 48, countryCode: "GB", emoji: "🍷", colors: "🍷🔵" },
  "Wolverhampton": { apiSportsId: 39, countryCode: "GB", emoji: "🟠", colors: "🟠⚫" },
  
  // Additional EPL teams
  "Burnley": { apiSportsId: 44, countryCode: "GB", emoji: "🍷", colors: "🍷🔵" },
  "Luton Town": { apiSportsId: 1359, countryCode: "GB", emoji: "🟠", colors: "🟠⚪" },
  "Sheffield United": { apiSportsId: 62, countryCode: "GB", emoji: "🔴", colors: "🔴⚪" },

  // ═══════════════════════════════════════════════════════════════════════════
  // LA LIGA (Spain)
  // ═══════════════════════════════════════════════════════════════════════════
  "Real Madrid": { apiSportsId: 541, countryCode: "ES", emoji: "⚪", colors: "⚪💜" },
  "Barcelona": { apiSportsId: 529, countryCode: "ES", emoji: "🔵", colors: "🔵🔴" },
  "Atletico Madrid": { apiSportsId: 530, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },
  "Sevilla": { apiSportsId: 536, countryCode: "ES", emoji: "⚪", colors: "⚪🔴" },
  "Real Sociedad": { apiSportsId: 548, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Real Betis": { apiSportsId: 543, countryCode: "ES", emoji: "💚", colors: "💚⚪" },
  "Athletic Club": { apiSportsId: 531, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },
  "Villarreal": { apiSportsId: 533, countryCode: "ES", emoji: "🟡", colors: "🟡🔵" },
  "Valencia": { apiSportsId: 532, countryCode: "ES", emoji: "🟠", colors: "⚪🟠" },
  "Girona": { apiSportsId: 547, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },

  // ═══════════════════════════════════════════════════════════════════════════
  // SERIE A (Italy)
  // ═══════════════════════════════════════════════════════════════════════════
  "Inter Milan": { apiSportsId: 505, countryCode: "IT", emoji: "🔵", colors: "🔵⚫" },
  "Milan": { apiSportsId: 489, countryCode: "IT", emoji: "🔴", colors: "🔴⚫" },
  "Juventus": { apiSportsId: 496, countryCode: "IT", emoji: "⚫", colors: "⚫⚪" },
  "Napoli": { apiSportsId: 492, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Roma": { apiSportsId: 497, countryCode: "IT", emoji: "🟡", colors: "🟡🔴" },
  "Lazio": { apiSportsId: 487, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Atalanta": { apiSportsId: 499, countryCode: "IT", emoji: "🔵", colors: "🔵⚫" },
  "Fiorentina": { apiSportsId: 502, countryCode: "IT", emoji: "💜", colors: "💜⚪" },
  "Bologna": { apiSportsId: 500, countryCode: "IT", emoji: "🔴", colors: "🔴🔵" },
  "Torino": { apiSportsId: 503, countryCode: "IT", emoji: "🍷", colors: "🍷⚪" },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUNDESLIGA (Germany)
  // ═══════════════════════════════════════════════════════════════════════════
  "Bayern Munich": { apiSportsId: 157, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Borussia Dortmund": { apiSportsId: 165, countryCode: "DE", emoji: "🟡", colors: "🟡⚫" },
  "RB Leipzig": { apiSportsId: 173, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Bayer Leverkusen": { apiSportsId: 168, countryCode: "DE", emoji: "🔴", colors: "🔴⚫" },
  "Eintracht Frankfurt": { apiSportsId: 169, countryCode: "DE", emoji: "⚫", colors: "⚫⚪🔴" },
  "VfL Wolfsburg": { apiSportsId: 161, countryCode: "DE", emoji: "💚", colors: "💚⚪" },
  "Borussia Monchengladbach": { apiSportsId: 163, countryCode: "DE", emoji: "⚫", colors: "⚫⚪💚" },
  "Union Berlin": { apiSportsId: 182, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Freiburg": { apiSportsId: 160, countryCode: "DE", emoji: "🔴", colors: "🔴⚫" },
  "Stuttgart": { apiSportsId: 172, countryCode: "DE", emoji: "⚪", colors: "⚪🔴" },

  // ═══════════════════════════════════════════════════════════════════════════
  // LIGUE 1 (France)
  // ═══════════════════════════════════════════════════════════════════════════
  "Paris Saint-Germain": { apiSportsId: 85, countryCode: "FR", emoji: "🔵", colors: "🔵🔴" },
  "Marseille": { apiSportsId: 81, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
  "Lyon": { apiSportsId: 80, countryCode: "FR", emoji: "🔵", colors: "🔵⚪🔴" },
  "Monaco": { apiSportsId: 91, countryCode: "MC", emoji: "🔴", colors: "🔴⚪" },
  "Lille": { apiSportsId: 79, countryCode: "FR", emoji: "🔴", colors: "🔴⚪" },
  "Nice": { apiSportsId: 84, countryCode: "FR", emoji: "🔴", colors: "🔴⚫" },
  "Rennes": { apiSportsId: 94, countryCode: "FR", emoji: "🔴", colors: "🔴⚫" },
  "Lens": { apiSportsId: 116, countryCode: "FR", emoji: "🟡", colors: "🟡🔴" },
  "Brest": { apiSportsId: 106, countryCode: "FR", emoji: "🔴", colors: "🔴⚪" },
  "Strasbourg": { apiSportsId: 95, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PORTUGUESE PRIMEIRA LIGA
  // ═══════════════════════════════════════════════════════════════════════════
  "Benfica": { apiSportsId: 211, countryCode: "PT", emoji: "🔴", colors: "🔴⚪" },
  "Porto": { apiSportsId: 212, countryCode: "PT", emoji: "🔵", colors: "🔵⚪" },
  "Sporting CP": { apiSportsId: 228, countryCode: "PT", emoji: "💚", colors: "💚⚪" },
  "Braga": { apiSportsId: 217, countryCode: "PT", emoji: "🔴", colors: "🔴⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EREDIVISIE (Netherlands)
  // ═══════════════════════════════════════════════════════════════════════════
  "Ajax": { apiSportsId: 194, countryCode: "NL", emoji: "🔴", colors: "🔴⚪" },
  "PSV Eindhoven": { apiSportsId: 197, countryCode: "NL", emoji: "🔴", colors: "🔴⚪" },
  "Feyenoord": { apiSportsId: 215, countryCode: "NL", emoji: "🔴", colors: "🔴⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SCOTTISH PREMIERSHIP
  // ═══════════════════════════════════════════════════════════════════════════
  "Celtic": { apiSportsId: 247, countryCode: "GB", emoji: "💚", colors: "💚⚪" },
  "Rangers": { apiSportsId: 257, countryCode: "GB", emoji: "🔵", colors: "🔵⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL LA LIGA TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Celta Vigo": { apiSportsId: 538, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Espanyol": { apiSportsId: 540, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Getafe": { apiSportsId: 546, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Osasuna": { apiSportsId: 727, countryCode: "ES", emoji: "🔴", colors: "🔴🔵" },
  "Mallorca": { apiSportsId: 798, countryCode: "ES", emoji: "🔴", colors: "🔴⚫" },
  "Alaves": { apiSportsId: 542, countryCode: "ES", emoji: "🔵", colors: "🔵⚪" },
  "Las Palmas": { apiSportsId: 534, countryCode: "ES", emoji: "🟡", colors: "🟡🔵" },
  "Rayo Vallecano": { apiSportsId: 728, countryCode: "ES", emoji: "🔴", colors: "🔴⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL SERIE A TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Udinese": { apiSportsId: 494, countryCode: "IT", emoji: "⚫", colors: "⚫⚪" },
  "Sassuolo": { apiSportsId: 488, countryCode: "IT", emoji: "💚", colors: "💚⚫" },
  "Empoli": { apiSportsId: 511, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Verona": { apiSportsId: 504, countryCode: "IT", emoji: "🟡", colors: "🟡🔵" },
  "Lecce": { apiSportsId: 867, countryCode: "IT", emoji: "🟡", colors: "🟡🔴" },
  "Monza": { apiSportsId: 1579, countryCode: "IT", emoji: "🔴", colors: "🔴⚪" },
  "Cagliari": { apiSportsId: 490, countryCode: "IT", emoji: "🔴", colors: "🔴🔵" },
  "Genoa": { apiSportsId: 495, countryCode: "IT", emoji: "🔴", colors: "🔴🔵" },
  "Parma": { apiSportsId: 523, countryCode: "IT", emoji: "🟡", colors: "🟡🔵" },
  "Como": { apiSportsId: 1543, countryCode: "IT", emoji: "🔵", colors: "🔵⚪" },
  "Venezia": { apiSportsId: 517, countryCode: "IT", emoji: "🟠", colors: "🟠💚⚫" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL BUNDESLIGA TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Hoffenheim": { apiSportsId: 167, countryCode: "DE", emoji: "🔵", colors: "🔵⚪" },
  "Werder Bremen": { apiSportsId: 162, countryCode: "DE", emoji: "💚", colors: "💚⚪" },
  "Mainz": { apiSportsId: 164, countryCode: "DE", emoji: "🔴", colors: "🔴⚪" },
  "Augsburg": { apiSportsId: 170, countryCode: "DE", emoji: "🔴", colors: "🔴💚⚪" },
  "Heidenheim": { apiSportsId: 180, countryCode: "DE", emoji: "🔴", colors: "🔴🔵" },
  "St Pauli": { apiSportsId: 186, countryCode: "DE", emoji: "🟤", colors: "🟤⚪" },
  "Holstein Kiel": { apiSportsId: 192, countryCode: "DE", emoji: "🔵", colors: "🔵⚪" },
  "Bochum": { apiSportsId: 176, countryCode: "DE", emoji: "🔵", colors: "🔵⚪" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ADDITIONAL LIGUE 1 TEAMS
  // ═══════════════════════════════════════════════════════════════════════════
  "Toulouse": { apiSportsId: 96, countryCode: "FR", emoji: "💜", colors: "💜⚪" },
  "Montpellier": { apiSportsId: 82, countryCode: "FR", emoji: "🟠", colors: "🟠🔵" },
  "Nantes": { apiSportsId: 83, countryCode: "FR", emoji: "🟡", colors: "🟡💚" },
  "Reims": { apiSportsId: 93, countryCode: "FR", emoji: "🔴", colors: "🔴⚪" },
  "Auxerre": { apiSportsId: 99, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
  "Angers": { apiSportsId: 77, countryCode: "FR", emoji: "⚫", colors: "⚫⚪" },
  "Saint-Etienne": { apiSportsId: 1063, countryCode: "FR", emoji: "💚", colors: "💚⚪" },
  "Le Havre": { apiSportsId: 103, countryCode: "FR", emoji: "🔵", colors: "🔵⚪" },
};

// ---------------------------------------------------------------------------
// League ID Mappings
// ---------------------------------------------------------------------------

export const LEAGUE_IDS: Record<string, LeagueIdMapping> = {
  "EPL": { apiSportsId: 39, countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "Premier League": { apiSportsId: 39, countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "La Liga": { apiSportsId: 140, countryCode: "ES", emoji: "🇪🇸" },
  "Serie A": { apiSportsId: 135, countryCode: "IT", emoji: "🇮🇹" },
  "Bundesliga": { apiSportsId: 78, countryCode: "DE", emoji: "🇩🇪" },
  "Ligue 1": { apiSportsId: 61, countryCode: "FR", emoji: "🇫🇷" },
  "Champions League": { apiSportsId: 2, countryCode: "EU", emoji: "🇪🇺" },
  "Europa League": { apiSportsId: 3, countryCode: "EU", emoji: "🇪🇺" },
  "Conference League": { apiSportsId: 848, countryCode: "EU", emoji: "🇪🇺" },
  // Additional leagues
  "Primeira Liga": { apiSportsId: 94, countryCode: "PT", emoji: "🇵🇹" },
  "Eredivisie": { apiSportsId: 88, countryCode: "NL", emoji: "🇳🇱" },
  "Scottish Premiership": { apiSportsId: 179, countryCode: "GB", emoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  "FA Cup": { apiSportsId: 45, countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "EFL Cup": { apiSportsId: 48, countryCode: "GB", emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "Copa del Rey": { apiSportsId: 143, countryCode: "ES", emoji: "🇪🇸" },
  "Coppa Italia": { apiSportsId: 137, countryCode: "IT", emoji: "🇮🇹" },
  "DFB Pokal": { apiSportsId: 81, countryCode: "DE", emoji: "🇩🇪" },
  "Coupe de France": { apiSportsId: 66, countryCode: "FR", emoji: "🇫🇷" },
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
  
  // Priority 1: API-Sports (best quality, reliable)
  if (mapping.apiSportsId) {
    urls.push(API_SPORTS_TEAM_LOGO(mapping.apiSportsId));
  }
  
  // Priority 2: Country flag from FlagCDN (always reliable)
  urls.push(FLAGCDN_SVG(mapping.countryCode));

  return {
    url: urls[0],
    fallbackUrls: urls.slice(1),
    placeholder: mapping.emoji,
    source: mapping.apiSportsId ? 'api-sports' : 'flagcdn',
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
  
  // Fallback to country flag (skip for EU-wide competitions)
  if (mapping.countryCode !== 'EU') {
    urls.push(FLAGCDN_SVG(mapping.countryCode));
  }

  return {
    url: urls[0],
    fallbackUrls: urls.slice(1),
    placeholder: mapping.emoji,
    source: mapping.apiSportsId ? 'api-sports' : 'flagcdn',
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
  if (typeof cached === 'object' && cached !== null && 'timestamp' in cached && 'url' in cached) {
    const entry = cached as { url: string; timestamp: number };
    if (Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.url;
    }
    return undefined;
  }
  
  // Old format - just return the LogoMeta
  return (cached as { url?: string }).url;
}

/**
 * Cache a logo URL with timestamp
 */
export function setCachedLogo(cacheKey: string, url: string): void {
  LOGO_CACHE.set(cacheKey, { url, timestamp: Date.now() });
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
export { FLAGCDN_SVG, FLAGCDN_PNG, API_SPORTS_TEAM_LOGO };

