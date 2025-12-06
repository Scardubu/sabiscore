"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TeamLogo, CountryFlag } from "@/components/ui/cached-logo";
import { resolveTeamLogo, TEAM_IDS } from "@/lib/assets/logo-resolver";
import { cn } from "@/lib/utils";

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * TEAM & LEAGUE ASSET SYSTEM v2.0 (ASSET_AUDIT_V2)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This module provides comprehensive team/league display utilities with:
 * - Complete coverage for 5 major European leagues + European competitions
 * - Consistent dark-mode optimized color schemes
 * - Alternative name resolution for API/data source compatibility
 * - Type-safe configuration with validation utilities
 * 
 * @version 2.0.0
 * @since Part 3 - Asset Audit & Future-proofing
 */

/**
 * League configuration with proper country flags and metadata
 * Each league uses its host country's flag emoji
 * 
 * Dark-mode optimized colors:
 * - Use bg-{color}-600/700 for primary colors (good contrast)
 * - Avoid light colors (100-300) that don't show on dark backgrounds
 */
export interface LeagueConfig {
  flag: string;
  countryCode: string;     // ISO 3166-1 alpha-2 country code for FlagCDN
  country: string;
  fullName: string;
  color: string;           // Primary Tailwind bg class
  darkModeColor?: string;  // Alternative for dark mode if needed
}

const LEAGUE_CONFIG: Record<string, LeagueConfig> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ENGLAND 🇬🇧 (using UK flag for universal rendering support)
  // ═══════════════════════════════════════════════════════════════════════════
  EPL: { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "Premier League", color: "bg-purple-600" },
  "Premier League": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "Premier League", color: "bg-purple-600" },
  "English Premier League": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "Premier League", color: "bg-purple-600" },
  "Championship": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "EFL Championship", color: "bg-orange-600" },
  "EFL Championship": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "EFL Championship", color: "bg-orange-600" },
  "League One": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "EFL League One", color: "bg-red-600" },
  "League Two": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "EFL League Two", color: "bg-blue-600" },
  "FA Cup": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "FA Cup", color: "bg-red-700" },
  "EFL Cup": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "EFL Cup", color: "bg-green-600" },
  "Carabao Cup": { flag: "🇬🇧", countryCode: "gb", country: "England", fullName: "EFL Cup", color: "bg-green-600" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SPAIN 🇪🇸
  // ═══════════════════════════════════════════════════════════════════════════
  "La Liga": { flag: "🇪🇸", countryCode: "es", country: "Spain", fullName: "La Liga", color: "bg-orange-600" },
  LaLiga: { flag: "🇪🇸", countryCode: "es", country: "Spain", fullName: "La Liga", color: "bg-orange-600" },
  "La Liga Santander": { flag: "🇪🇸", countryCode: "es", country: "Spain", fullName: "La Liga", color: "bg-orange-600" },
  "La Liga EA Sports": { flag: "🇪🇸", countryCode: "es", country: "Spain", fullName: "La Liga", color: "bg-orange-600" },
  "Segunda Division": { flag: "🇪🇸", countryCode: "es", country: "Spain", fullName: "Segunda División", color: "bg-green-600" },
  "Copa del Rey": { flag: "🇪🇸", countryCode: "es", country: "Spain", fullName: "Copa del Rey", color: "bg-red-700" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ITALY 🇮🇹
  // ═══════════════════════════════════════════════════════════════════════════
  "Serie A": { flag: "🇮🇹", countryCode: "it", country: "Italy", fullName: "Serie A", color: "bg-blue-700" },
  SerieA: { flag: "🇮🇹", countryCode: "it", country: "Italy", fullName: "Serie A", color: "bg-blue-700" },
  "Serie B": { flag: "🇮🇹", countryCode: "it", country: "Italy", fullName: "Serie B", color: "bg-green-700" },
  "Coppa Italia": { flag: "🇮🇹", countryCode: "it", country: "Italy", fullName: "Coppa Italia", color: "bg-emerald-700" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GERMANY 🇩🇪
  // ═══════════════════════════════════════════════════════════════════════════
  Bundesliga: { flag: "🇩🇪", countryCode: "de", country: "Germany", fullName: "Bundesliga", color: "bg-red-600" },
  "Bundesliga 1": { flag: "🇩🇪", countryCode: "de", country: "Germany", fullName: "Bundesliga", color: "bg-red-600" },
  "2. Bundesliga": { flag: "🇩🇪", countryCode: "de", country: "Germany", fullName: "2. Bundesliga", color: "bg-red-700" },
  "Bundesliga 2": { flag: "🇩🇪", countryCode: "de", country: "Germany", fullName: "2. Bundesliga", color: "bg-red-700" },
  "DFB Pokal": { flag: "🇩🇪", countryCode: "de", country: "Germany", fullName: "DFB-Pokal", color: "bg-yellow-600" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FRANCE 🇫🇷
  // ═══════════════════════════════════════════════════════════════════════════
  "Ligue 1": { flag: "🇫🇷", countryCode: "fr", country: "France", fullName: "Ligue 1", color: "bg-blue-700" },
  Ligue1: { flag: "🇫🇷", countryCode: "fr", country: "France", fullName: "Ligue 1", color: "bg-blue-700" },
  "Ligue 2": { flag: "🇫🇷", countryCode: "fr", country: "France", fullName: "Ligue 2", color: "bg-emerald-700" },
  "Coupe de France": { flag: "🇫🇷", countryCode: "fr", country: "France", fullName: "Coupe de France", color: "bg-red-700" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // EUROPEAN COMPETITIONS 🇪🇺
  // ═══════════════════════════════════════════════════════════════════════════
  "Champions League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Champions League", color: "bg-blue-800" },
  UCL: { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Champions League", color: "bg-blue-800" },
  "UEFA Champions League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Champions League", color: "bg-blue-800" },
  "Europa League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Europa League", color: "bg-orange-600" },
  UEL: { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Europa League", color: "bg-orange-600" },
  "UEFA Europa League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Europa League", color: "bg-orange-600" },
  "Conference League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Conference League", color: "bg-green-600" },
  UECL: { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Conference League", color: "bg-green-600" },
  "UEFA Conference League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Conference League", color: "bg-green-600" },
  "UEFA Super Cup": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Super Cup", color: "bg-purple-700" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER EUROPEAN LEAGUES
  // ═══════════════════════════════════════════════════════════════════════════
  // Netherlands
  "Eredivisie": { flag: "🇳🇱", countryCode: "nl", country: "Netherlands", fullName: "Eredivisie", color: "bg-orange-600" },
  
  // Portugal
  "Primeira Liga": { flag: "🇵🇹", countryCode: "pt", country: "Portugal", fullName: "Primeira Liga", color: "bg-green-700" },
  "Liga Portugal": { flag: "🇵🇹", countryCode: "pt", country: "Portugal", fullName: "Liga Portugal", color: "bg-green-700" },
  "Liga Portugal Betclic": { flag: "🇵🇹", countryCode: "pt", country: "Portugal", fullName: "Liga Portugal", color: "bg-green-700" },
  
  // Scotland (using UK flag for universal rendering support)
  "Scottish Premiership": { flag: "🇬🇧", countryCode: "gb", country: "Scotland", fullName: "Scottish Premiership", color: "bg-blue-600" },
  "SPFL": { flag: "🇬🇧", countryCode: "gb", country: "Scotland", fullName: "Scottish Premiership", color: "bg-blue-600" },
  
  // Belgium
  "Belgian Pro League": { flag: "🇧🇪", countryCode: "be", country: "Belgium", fullName: "Belgian Pro League", color: "bg-red-700" },
  "Jupiler Pro League": { flag: "🇧🇪", countryCode: "be", country: "Belgium", fullName: "Belgian Pro League", color: "bg-red-700" },
  
  // Turkey
  "Super Lig": { flag: "🇹🇷", countryCode: "tr", country: "Turkey", fullName: "Süper Lig", color: "bg-red-600" },
  "Süper Lig": { flag: "🇹🇷", countryCode: "tr", country: "Turkey", fullName: "Süper Lig", color: "bg-red-600" },
  
  // Austria
  "Austrian Bundesliga": { flag: "🇦🇹", countryCode: "at", country: "Austria", fullName: "Austrian Bundesliga", color: "bg-red-600" },
  
  // Switzerland
  "Swiss Super League": { flag: "🇨🇭", countryCode: "ch", country: "Switzerland", fullName: "Swiss Super League", color: "bg-red-600" },
  
  // Greece
  "Greek Super League": { flag: "🇬🇷", countryCode: "gr", country: "Greece", fullName: "Greek Super League", color: "bg-blue-700" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // NORTH/SOUTH AMERICA
  // ═══════════════════════════════════════════════════════════════════════════
  "MLS": { flag: "🇺🇸", countryCode: "us", country: "USA", fullName: "Major League Soccer", color: "bg-blue-600" },
  "Major League Soccer": { flag: "🇺🇸", countryCode: "us", country: "USA", fullName: "Major League Soccer", color: "bg-blue-600" },
  "Liga MX": { flag: "🇲🇽", countryCode: "mx", country: "Mexico", fullName: "Liga MX", color: "bg-green-700" },
  "Brasileirao": { flag: "🇧🇷", countryCode: "br", country: "Brazil", fullName: "Brasileirão Série A", color: "bg-yellow-600" },
  "Brasileirão": { flag: "🇧🇷", countryCode: "br", country: "Brazil", fullName: "Brasileirão Série A", color: "bg-yellow-600" },
  "Argentine Primera": { flag: "🇦🇷", countryCode: "ar", country: "Argentina", fullName: "Argentine Primera División", color: "bg-sky-600" },
  "Copa Libertadores": { flag: "🌎", countryCode: "un", country: "South America", fullName: "Copa Libertadores", color: "bg-amber-600" },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNATIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  "World Cup": { flag: "🌍", countryCode: "un", country: "World", fullName: "FIFA World Cup", color: "bg-emerald-700" },
  "European Championship": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Euro", color: "bg-blue-700" },
  "Euro": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Euro", color: "bg-blue-700" },
  "Euro 2024": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Euro 2024", color: "bg-blue-700" },
  "Nations League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Nations League", color: "bg-indigo-700" },
  "UEFA Nations League": { flag: "🇪🇺", countryCode: "eu", country: "Europe", fullName: "UEFA Nations League", color: "bg-indigo-700" },
  "Friendlies": { flag: "⚽", countryCode: "un", country: "International", fullName: "International Friendlies", color: "bg-slate-600" },
  "World Cup Qualifiers": { flag: "🌍", countryCode: "un", country: "World", fullName: "World Cup Qualifiers", color: "bg-emerald-700" },
};

// Legacy export for backward compatibility
const LEAGUE_FLAGS: Record<string, string> = Object.fromEntries(
  Object.entries(LEAGUE_CONFIG).map(([key, value]) => [key, value.flag])
);

/**
 * Comprehensive team data with country flags (based on club's nation),
 * team colors, and alternative names for robust matching
 * 
 * Each team has:
 * - flag: Country flag emoji where the club is based
 * - colors: Primary team colors as emoji representation  
 * - bgColor: Tailwind background class for brand color
 * - altNames: Alternative spellings/short names for matching
 */
interface TeamData {
  flag: string;      // Country flag where club is based
  countryCode?: string; // ISO 3166-1 alpha-2 country code for FlagCDN (optional - derived from flag if not set)
  colors: string;    // Team color emojis
  bgColor: string;   // Tailwind bg class
  altNames?: string[]; // Alternative names for matching
}

const TEAM_DATA: Record<string, TeamData> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // PREMIER LEAGUE (England 🇬🇧) - All 20 teams 2024/25
  // ═══════════════════════════════════════════════════════════════════════════
  "Arsenal": { 
    flag: "🇬🇧", countryCode: "gb", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["AFC", "The Gunners", "Gunners"]
  },
  "Aston Villa": { 
    flag: "🇬🇧", countryCode: "gb", colors: "🟣🔵", bgColor: "bg-purple-800",
    altNames: ["Villa", "AVFC"]
  },
  "Bournemouth": { 
    flag: "🇬🇧", countryCode: "gb", colors: "🍒⚫", bgColor: "bg-red-700",
    altNames: ["AFC Bournemouth", "The Cherries"]
  },
  "Brentford": { 
    flag: "🇬🇧", countryCode: "gb", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["The Bees", "BFC"]
  },
  "Brighton": { 
    flag: "🇬🇧", colors: "🔵⚪", bgColor: "bg-blue-500",
    altNames: ["Brighton & Hove Albion", "Seagulls", "BHAFC"]
  },
  "Chelsea": { 
    flag: "🇬🇧", colors: "🔵⚪", bgColor: "bg-blue-700",
    altNames: ["CFC", "The Blues"]
  },
  "Crystal Palace": { 
    flag: "🇬🇧", colors: "🔴🔵", bgColor: "bg-blue-700",
    altNames: ["Palace", "CPFC", "Eagles"]
  },
  "Everton": { 
    flag: "🇬🇧", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["EFC", "The Toffees", "Toffees"]
  },
  "Fulham": { 
    flag: "🇬🇧", colors: "⚪⚫", bgColor: "bg-slate-100",
    altNames: ["FFC", "Cottagers"]
  },
  "Ipswich Town": { 
    flag: "🇬🇧", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Ipswich", "ITFC", "Tractor Boys"]
  },
  "Leicester City": { 
    flag: "🇬🇧", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Leicester", "LCFC", "Foxes"]
  },
  "Liverpool": { 
    flag: "🇬🇧", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["LFC", "The Reds", "Reds"]
  },
  "Manchester City": { 
    flag: "🇬🇧", colors: "🔵⚪", bgColor: "bg-sky-500",
    altNames: ["Man City", "City", "MCFC", "Citizens"]
  },
  "Manchester United": { 
    flag: "🇬🇧", colors: "🔴⚪", bgColor: "bg-red-700",
    altNames: ["Man United", "Man Utd", "United", "MUFC", "Red Devils"]
  },
  "Newcastle United": { 
    flag: "🇬🇧", colors: "⚫⚪", bgColor: "bg-slate-900",
    altNames: ["Newcastle", "NUFC", "Magpies", "Toon"]
  },
  "Nottingham Forest": { 
    flag: "🇬🇧", colors: "🔴⚪", bgColor: "bg-red-700",
    altNames: ["Forest", "NFFC", "Nott'm Forest"]
  },
  "Southampton": { 
    flag: "🇬🇧", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Saints", "SFC"]
  },
  "Tottenham Hotspur": { 
    flag: "🇬🇧", colors: "⚪🔵", bgColor: "bg-slate-100",
    altNames: ["Tottenham", "Spurs", "THFC"]
  },
  "West Ham United": { 
    flag: "🇬🇧", colors: "🍷🔵", bgColor: "bg-purple-900",
    altNames: ["West Ham", "Hammers", "WHUFC", "Irons"]
  },
  "Wolverhampton": { 
    flag: "🇬🇧", colors: "🟠⚫", bgColor: "bg-amber-500",
    altNames: ["Wolves", "Wolverhampton Wanderers", "WWFC"]
  },
  // Additional EPL teams (promoted/relegated)
  "Burnley": { 
    flag: "🇬🇧", colors: "🍷🔵", bgColor: "bg-purple-900",
    altNames: ["BFC", "Clarets"]
  },
  "Luton Town": { 
    flag: "🇬🇧", colors: "🟠⚪", bgColor: "bg-orange-500",
    altNames: ["Luton", "LTFC", "Hatters"]
  },
  "Sheffield United": { 
    flag: "🇬🇧", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Sheffield", "Blades", "SUFC"]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LA LIGA (Spain 🇪🇸) - All 20 teams 2024/25
  // ═══════════════════════════════════════════════════════════════════════════
  "Real Madrid": { 
    flag: "🇪🇸", colors: "⚪💜", bgColor: "bg-slate-100",
    altNames: ["Madrid", "Real", "Los Blancos", "Merengues"]
  },
  "Barcelona": { 
    flag: "🇪🇸", colors: "🔵🔴", bgColor: "bg-blue-800",
    altNames: ["Barca", "Barça", "FCB", "Blaugrana"]
  },
  "Atletico Madrid": { 
    flag: "🇪🇸", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Atleti", "Atlético Madrid", "Colchoneros"]
  },
  "Sevilla": { 
    flag: "🇪🇸", colors: "⚪🔴", bgColor: "bg-red-100",
    altNames: ["SFC", "Sevillistas"]
  },
  "Real Sociedad": { 
    flag: "🇪🇸", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["La Real", "Txuri-urdin"]
  },
  "Real Betis": { 
    flag: "🇪🇸", colors: "💚⚪", bgColor: "bg-green-600",
    altNames: ["Betis", "Verdiblancos"]
  },
  "Athletic Club": { 
    flag: "🇪🇸", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Athletic Bilbao", "Athletic", "Los Leones"]
  },
  "Villarreal": { 
    flag: "🇪🇸", colors: "🟡🔵", bgColor: "bg-yellow-400",
    altNames: ["Yellow Submarine", "Submarino Amarillo"]
  },
  "Valencia": { 
    flag: "🇪🇸", colors: "⚪🟠", bgColor: "bg-orange-100",
    altNames: ["VCF", "Los Che", "Murciélagos"]
  },
  "Getafe": { 
    flag: "🇪🇸", colors: "🔵⚪", bgColor: "bg-blue-700",
    altNames: ["Geta", "Azulones"]
  },
  "Osasuna": { 
    flag: "🇪🇸", colors: "🔴🔵", bgColor: "bg-red-700",
    altNames: ["CA Osasuna", "Rojillos"]
  },
  "Celta Vigo": { 
    flag: "🇪🇸", colors: "🔵⚪", bgColor: "bg-sky-500",
    altNames: ["Celta", "RC Celta", "Celestes"]
  },
  "Mallorca": { 
    flag: "🇪🇸", colors: "🔴⚫", bgColor: "bg-red-700",
    altNames: ["RCD Mallorca", "Bermellones"]
  },
  "Rayo Vallecano": { 
    flag: "🇪🇸", colors: "⚪🔴", bgColor: "bg-red-100",
    altNames: ["Rayo", "Vallecanos", "Franjirrojos"]
  },
  "Girona": { 
    flag: "🇪🇸", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Girona FC", "Blanc-i-vermells"]
  },
  "Las Palmas": { 
    flag: "🇪🇸", colors: "🟡🔵", bgColor: "bg-yellow-400",
    altNames: ["UD Las Palmas", "Amarillos"]
  },
  "Alaves": { 
    flag: "🇪🇸", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Deportivo Alavés", "Babazorros"]
  },
  "Leganes": { 
    flag: "🇪🇸", colors: "🔵⚪", bgColor: "bg-blue-700",
    altNames: ["CD Leganés", "Pepineros"]
  },
  "Espanyol": { 
    flag: "🇪🇸", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["RCD Espanyol", "Periquitos"]
  },
  "Elche": { 
    flag: "🇪🇸", colors: "💚⚪", bgColor: "bg-green-600",
    altNames: ["Elche CF", "Franjiverdes"]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SERIE A (Italy 🇮🇹) - All 20 teams 2024/25
  // ═══════════════════════════════════════════════════════════════════════════
  "Inter Milan": { 
    flag: "🇮🇹", colors: "🔵⚫", bgColor: "bg-blue-900",
    altNames: ["Inter", "Internazionale", "Nerazzurri"]
  },
  "Milan": { 
    flag: "🇮🇹", colors: "🔴⚫", bgColor: "bg-red-700",
    altNames: ["AC Milan", "Rossoneri"]
  },
  "Juventus": { 
    flag: "🇮🇹", colors: "⚫⚪", bgColor: "bg-slate-900",
    altNames: ["Juve", "Bianconeri", "Old Lady"]
  },
  "Napoli": { 
    flag: "🇮🇹", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["SSC Napoli", "Partenopei", "Azzurri"]
  },
  "Roma": { 
    flag: "🇮🇹", colors: "🟡🔴", bgColor: "bg-yellow-600",
    altNames: ["AS Roma", "Giallorossi", "Lupi"]
  },
  "Lazio": { 
    flag: "🇮🇹", colors: "🔵⚪", bgColor: "bg-sky-500",
    altNames: ["SS Lazio", "Biancocelesti", "Aquile"]
  },
  "Atalanta": { 
    flag: "🇮🇹", colors: "🔵⚫", bgColor: "bg-blue-800",
    altNames: ["La Dea", "Nerazzurri Bergamaschi"]
  },
  "Fiorentina": { 
    flag: "🇮🇹", colors: "💜⚪", bgColor: "bg-purple-600",
    altNames: ["Viola", "ACF Fiorentina"]
  },
  "Bologna": { 
    flag: "🇮🇹", colors: "🔴🔵", bgColor: "bg-red-700",
    altNames: ["BFC", "Rossoblù"]
  },
  "Torino": { 
    flag: "🇮🇹", colors: "🍷⚪", bgColor: "bg-purple-900",
    altNames: ["Toro", "Granata"]
  },
  "Monza": { 
    flag: "🇮🇹", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["AC Monza", "Biancorossi"]
  },
  "Genoa": { 
    flag: "🇮🇹", colors: "🔴🔵", bgColor: "bg-red-700",
    altNames: ["Genoa CFC", "Grifone", "Rossoblù"]
  },
  "Lecce": { 
    flag: "🇮🇹", colors: "🟡🔴", bgColor: "bg-yellow-500",
    altNames: ["US Lecce", "Giallorossi", "Salentini"]
  },
  "Udinese": { 
    flag: "🇮🇹", colors: "⚪⚫", bgColor: "bg-slate-100",
    altNames: ["Zebrette", "Friulani"]
  },
  "Empoli": { 
    flag: "🇮🇹", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Empoli FC", "Azzurri"]
  },
  "Cagliari": { 
    flag: "🇮🇹", colors: "🔴🔵", bgColor: "bg-red-700",
    altNames: ["Casteddu", "Rossoblù"]
  },
  "Sassuolo": { 
    flag: "🇮🇹", colors: "💚⚫", bgColor: "bg-green-700",
    altNames: ["US Sassuolo", "Neroverdi"]
  },
  "Salernitana": { 
    flag: "🇮🇹", colors: "🍷⚪", bgColor: "bg-purple-900",
    altNames: ["US Salernitana", "Granata"]
  },
  "Como": { 
    flag: "🇮🇹", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Como 1907", "Lariani"]
  },
  "Parma": { 
    flag: "🇮🇹", colors: "🟡🔵", bgColor: "bg-yellow-400",
    altNames: ["Parma Calcio", "Crociati", "Ducali"]
  },
  "Verona": {
    flag: "🇮🇹", colors: "🟡🔵", bgColor: "bg-yellow-500",
    altNames: ["Hellas Verona", "Gialloblu", "Mastini"]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUNDESLIGA (Germany 🇩🇪) - All 18 teams 2024/25
  // ═══════════════════════════════════════════════════════════════════════════
  "Bayern Munich": { 
    flag: "🇩🇪", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Bayern", "Bayern München", "FCB", "Die Roten"]
  },
  "Borussia Dortmund": { 
    flag: "🇩🇪", colors: "🟡⚫", bgColor: "bg-yellow-400",
    altNames: ["Dortmund", "BVB", "Die Schwarzgelben"]
  },
  "RB Leipzig": { 
    flag: "🇩🇪", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Leipzig", "RBL", "Die Roten Bullen"]
  },
  "Bayer Leverkusen": { 
    flag: "🇩🇪", colors: "🔴⚫", bgColor: "bg-red-700",
    altNames: ["Leverkusen", "B04", "Werkself"]
  },
  "Eintracht Frankfurt": { 
    flag: "🇩🇪", colors: "⚫⚪🔴", bgColor: "bg-slate-900",
    altNames: ["Frankfurt", "SGE", "Die Adler"]
  },
  "VfL Wolfsburg": { 
    flag: "🇩🇪", colors: "💚⚪", bgColor: "bg-green-600",
    altNames: ["Wolfsburg", "Die Wölfe"]
  },
  "Borussia Monchengladbach": { 
    flag: "🇩🇪", colors: "⚫⚪💚", bgColor: "bg-slate-900",
    altNames: ["Gladbach", "Borussia Mönchengladbach", "BMG", "Die Fohlen"]
  },
  "Union Berlin": { 
    flag: "🇩🇪", colors: "🔴⚪", bgColor: "bg-red-700",
    altNames: ["Union", "Die Eisernen"]
  },
  "Freiburg": { 
    flag: "🇩🇪", colors: "🔴⚫", bgColor: "bg-red-700",
    altNames: ["SC Freiburg", "Breisgau-Brasilianer"]
  },
  "Mainz": { 
    flag: "🇩🇪", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Mainz 05", "FSV Mainz 05", "Nullfünfer"]
  },
  "Hoffenheim": { 
    flag: "🇩🇪", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["TSG Hoffenheim", "TSG", "Die Kraichgauer"]
  },
  "Augsburg": { 
    flag: "🇩🇪", colors: "🔴💚⚪", bgColor: "bg-red-600",
    altNames: ["FC Augsburg", "FCA", "Fuggerstädter"]
  },
  "Werder Bremen": { 
    flag: "🇩🇪", colors: "💚⚪", bgColor: "bg-green-600",
    altNames: ["Bremen", "Werder", "Die Grün-Weißen"]
  },
  "Stuttgart": { 
    flag: "🇩🇪", colors: "⚪🔴", bgColor: "bg-red-100",
    altNames: ["VfB Stuttgart", "VfB", "Schwaben"]
  },
  "Bochum": { 
    flag: "🇩🇪", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["VfL Bochum", "Die Unabsteigbaren"]
  },
  "FC Heidenheim": { 
    flag: "🇩🇪", colors: "🔴🔵", bgColor: "bg-red-700",
    altNames: ["Heidenheim", "FCH"]
  },
  "Darmstadt": { 
    flag: "🇩🇪", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Darmstadt 98", "SV Darmstadt", "Die Lilien"]
  },
  "Holstein Kiel": { 
    flag: "🇩🇪", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Kiel", "KSV", "Die Störche"]
  },
  "St. Pauli": { 
    flag: "🇩🇪", colors: "🟤⚪", bgColor: "bg-amber-800",
    altNames: ["FC St. Pauli", "Kiezkicker"]
  },
  "Hamburg": { 
    flag: "🇩🇪", colors: "🔵⚪🔴", bgColor: "bg-blue-700",
    altNames: ["HSV", "Hamburger SV", "Rothosen"]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LIGUE 1 (France 🇫🇷) - All 18 teams 2024/25
  // ═══════════════════════════════════════════════════════════════════════════
  "Paris Saint-Germain": { 
    flag: "🇫🇷", colors: "🔵🔴", bgColor: "bg-blue-900",
    altNames: ["PSG", "Paris SG", "Les Parisiens"]
  },
  "Marseille": { 
    flag: "🇫🇷", colors: "🔵⚪", bgColor: "bg-sky-400",
    altNames: ["OM", "Olympique Marseille", "Les Phocéens"]
  },
  "Lyon": { 
    flag: "🇫🇷", colors: "🔵⚪🔴", bgColor: "bg-blue-600",
    altNames: ["OL", "Olympique Lyon", "Les Gones"]
  },
  "Monaco": { 
    flag: "🇲🇨", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["AS Monaco", "ASM", "Les Monégasques"]
  },
  "Lille": { 
    flag: "🇫🇷", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["LOSC", "LOSC Lille", "Les Dogues"]
  },
  "Nice": { 
    flag: "🇫🇷", colors: "🔴⚫", bgColor: "bg-red-700",
    altNames: ["OGC Nice", "Les Aiglons"]
  },
  "Rennes": { 
    flag: "🇫🇷", colors: "🔴⚫", bgColor: "bg-red-700",
    altNames: ["Stade Rennais", "SRFC", "Les Rennais"]
  },
  "Lens": { 
    flag: "🇫🇷", colors: "🟡🔴", bgColor: "bg-yellow-500",
    altNames: ["RC Lens", "Les Sang et Or"]
  },
  "Nantes": { 
    flag: "🇫🇷", colors: "🟡💚", bgColor: "bg-yellow-400",
    altNames: ["FC Nantes", "Les Canaris"]
  },
  "Montpellier": { 
    flag: "🇫🇷", colors: "🔵🟠", bgColor: "bg-blue-700",
    altNames: ["MHSC", "La Paillade"]
  },
  "Reims": { 
    flag: "🇫🇷", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Stade de Reims", "SDR"]
  },
  "Toulouse": { 
    flag: "🇫🇷", colors: "💜⚪", bgColor: "bg-purple-600",
    altNames: ["TFC", "Téfécé", "Les Violets"]
  },
  "Brest": { 
    flag: "🇫🇷", colors: "🔴⚪", bgColor: "bg-red-600",
    altNames: ["Stade Brestois", "SB29"]
  },
  "Havre": { 
    flag: "🇫🇷", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["Le Havre", "Le Havre AC", "HAC"]
  },
  "Metz": { 
    flag: "🇫🇷", colors: "🍷⚪", bgColor: "bg-purple-900",
    altNames: ["FC Metz", "Les Grenats"]
  },
  "Lorient": { 
    flag: "🇫🇷", colors: "🟠⚫", bgColor: "bg-orange-500",
    altNames: ["FC Lorient", "Les Merlus"]
  },
  "Clermont": { 
    flag: "🇫🇷", colors: "🔴🔵", bgColor: "bg-red-600",
    altNames: ["Clermont Foot", "CF63"]
  },
  "Strasbourg": { 
    flag: "🇫🇷", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["RC Strasbourg", "Racing"]
  },
  "Angers": { 
    flag: "🇫🇷", colors: "⚫⚪", bgColor: "bg-slate-900",
    altNames: ["Angers SCO", "SCO", "Le Sco"]
  },
  "Auxerre": { 
    flag: "🇫🇷", colors: "🔵⚪", bgColor: "bg-blue-600",
    altNames: ["AJ Auxerre", "AJA"]
  },
  "Saint-Etienne": { 
    flag: "🇫🇷", colors: "💚⚪", bgColor: "bg-green-600",
    altNames: ["ASSE", "Les Verts"]
  },
};

/**
 * Build reverse lookup maps for alternative names
 */
const ALT_NAME_LOOKUP: Record<string, string> = {};
Object.entries(TEAM_DATA).forEach(([teamName, data]) => {
  if (data.altNames) {
    data.altNames.forEach(alt => {
      ALT_NAME_LOOKUP[alt.toLowerCase()] = teamName;
    });
  }
});

/**
 * Resolve team name to canonical name (handles abbreviations and alternatives)
 */
function resolveTeamName(input: string): string {
  // Direct match
  if (TEAM_DATA[input]) return input;
  
  // Lowercase lookup in alternatives
  const lowerInput = input.toLowerCase();
  if (ALT_NAME_LOOKUP[lowerInput]) {
    return ALT_NAME_LOOKUP[lowerInput];
  }
  
  // Fuzzy match on primary names (contains check)
  for (const teamName of Object.keys(TEAM_DATA)) {
    if (teamName.toLowerCase().includes(lowerInput) || lowerInput.includes(teamName.toLowerCase())) {
      return teamName;
    }
  }
  
  return input; // Return original if no match
}

/**
 * Map emoji flag to ISO 3166-1 alpha-2 country code
 */
function emojiToCountryCode(flag: string): string {
  const flagMap: Record<string, string> = {
    "🇬🇧": "gb",
    "🇪🇸": "es",
    "🇮🇹": "it",
    "🇩🇪": "de",
    "🇫🇷": "fr",
    "🇵🇹": "pt",
    "🇳🇱": "nl",
    "🇧🇪": "be",
    "🇹🇷": "tr",
    "🇦🇹": "at",
    "🇨🇭": "ch",
    "🇬🇷": "gr",
    "🇺🇸": "us",
    "🇲🇽": "mx",
    "🇧🇷": "br",
    "🇦🇷": "ar",
    "🇲🇨": "mc", // Monaco
    "🇪🇺": "eu",
    "🌍": "un",
    "🌎": "un",
    "⚽": "un",
  };
  return flagMap[flag] || "un";
}

/**
 * Get team data with fallback for unknown teams
 */
function getTeamData(teamName: string): TeamData & { countryCode: string } {
  const canonical = resolveTeamName(teamName);
  const data = TEAM_DATA[canonical];
  if (data) {
    return {
      ...data,
      countryCode: data.countryCode || emojiToCountryCode(data.flag)
    };
  }
  return {
    flag: "⚽",
    countryCode: "un",
    colors: "⚪⚫",
    bgColor: "bg-slate-600"
  };
}

// Legacy exports for backward compatibility
const TEAM_FLAGS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    const data = getTeamData(prop);
    return data.colors; // Return team colors as "flag"
  }
});

// Legacy TEAM_COLORS - now uses getTeamData internally
const TEAM_COLORS: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_, prop: string) {
    const data = getTeamData(prop);
    return data.bgColor;
  }
});

interface TeamDisplayProps {
  teamName: string;
  league?: string;         // Optional league to show country flag
  showFlag?: boolean;      // Show country flag (true) or team colors (false)
  showTeamColors?: boolean; // Show team color indicator
  showColor?: boolean;     // Legacy: show background color
  showLeaguePill?: boolean; // Show a league badge/abbr beside the team
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "compact" | "full";
  className?: string;
}

const sizeClasses = {
  xs: {
    avatar: "h-5 w-5",
    text: "text-xs",
    flag: "text-sm",
    spacing: "gap-1",
  },
  sm: {
    avatar: "h-6 w-6",
    text: "text-sm",
    flag: "text-base",
    spacing: "gap-1.5",
  },
  md: {
    avatar: "h-8 w-8",
    text: "text-base",
    flag: "text-lg",
    spacing: "gap-2",
  },
  lg: {
    avatar: "h-10 w-10",
    text: "text-lg",
    flag: "text-xl",
    spacing: "gap-2.5",
  },
  xl: {
    avatar: "h-12 w-12",
    text: "text-xl",
    flag: "text-2xl",
    spacing: "gap-3",
  },
};

/**
 * Get team abbreviation for avatar fallback
 */
function getTeamAbbreviation(teamName: string): string {
  const words = teamName.split(" ");
  if (words.length === 1) {
    return teamName.slice(0, 3).toUpperCase();
  }
  return words
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

/**
 * Get team logo metadata using the logo resolver
 * Returns URLs from API-Sports, TheSportsDB, or FlagCDN with fallbacks
 */
function getTeamLogoMeta(teamName: string) {
  return resolveTeamLogo(teamName);
}

/**
 * Get team logo URL from the resolver (primary URL)
 */
function getTeamLogoUrl(teamName: string): string | null {
  const meta = resolveTeamLogo(teamName);
  return meta.url || null;
}

/**
 * Check if team has API-based logo available
 */
function hasRealLogo(teamName: string): boolean {
  return TEAM_IDS[teamName]?.apiSportsId !== undefined;
}

/**
 * League abbreviation helper (ensures EPL/UEL/UCL etc.)
 */
function getLeagueAbbreviation(league?: string): string | undefined {
  if (!league) return undefined;
  const normalized = league.toLowerCase();
  if (normalized.includes("premier")) return "EPL";
  if (normalized.includes("championship") && normalized.includes("efl")) return "EFL";
  if (normalized.includes("la liga")) return "LL";
  if (normalized.includes("bundesliga")) return "BUN";
  if (normalized.includes("ligue 1")) return "L1";
  if (normalized.includes("serie a")) return "SA";
  if (normalized.includes("champions league") || normalized === "ucl") return "UCL";
  if (normalized.includes("europa league") || normalized === "uel") return "UEL";
  if (normalized.includes("conference")) return "UECL";
  if (normalized.includes("mls")) return "MLS";
  if (normalized.includes("libertadores")) return "LIB";
  return league.slice(0, 3).toUpperCase();
}

/**
 * TeamDisplay Component
 * 
 * Renders team name with proper country flag and brand color indicator.
 * Provides consistent team display across the application.
 * 
 * Features:
 * - Country flag based on where the club is located
 * - Team color emojis for visual recognition
 * - Alternative name resolution for flexible matching
 * - Multiple display variants (default, compact, full)
 */
export function TeamDisplay({
  teamName,
  league,
  showFlag = true,
  showTeamColors = false,
  showColor = false,
  showLeaguePill = false,
  size = "md",
  variant = "default",
  className,
}: TeamDisplayProps) {
  const teamData = getTeamData(teamName);
  const leagueConfig = league ? LEAGUE_CONFIG[league] : undefined;
  const flagFromLeague = leagueConfig?.flag;
  const displayFlag = showTeamColors ? teamData.colors : (flagFromLeague ?? teamData.flag);
  const color = teamData.bgColor;
  const sizes = sizeClasses[size];
  const logoUrl = getTeamLogoUrl(teamName);
  const canonicalName = resolveTeamName(teamName);
  const leagueAbbr = getLeagueAbbreviation(league);

  if (variant === "compact") {
    // Determine which country code to show - from league or team
    const displayCountryCode = leagueConfig?.countryCode || teamData.countryCode;
    const flagSize = size === 'xs' ? 14 : size === 'sm' ? 16 : size === 'md' ? 20 : 24;
    
    return (
      <span
        className={cn(
          "inline-flex items-center",
          sizes.spacing,
          className
        )}
      >
        {showFlag && displayCountryCode && (
          <CountryFlag 
            countryCode={displayCountryCode} 
            size={flagSize}
            className="rounded-sm flex-shrink-0"
          />
        )}
        <span className={cn("font-medium text-slate-200", sizes.text)}>
          {teamName}
        </span>
      </span>
    );
  }

  if (variant === "full") {
    return (
      <div
        className={cn(
          "flex items-center rounded-lg p-2 transition-colors",
          showColor && color,
          showColor ? "bg-opacity-20" : "",
          sizes.spacing,
          className
        )}
      >
        <Avatar className={sizes.avatar}>
          {logoUrl ? (
            <AvatarImage src={logoUrl} alt={teamName} />
          ) : null}
          <AvatarFallback
            className={cn(
              "text-xs font-bold",
              color,
              "text-white bg-opacity-80"
            )}
          >
            {getTeamAbbreviation(teamName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className={cn("font-semibold text-white", sizes.text)}>
            {teamName}
          </span>
          <div className="flex items-center gap-1">
            {showFlag && teamData.countryCode && (
              <CountryFlag countryCode={teamData.countryCode} size={14} className="rounded-sm" />
            )}
            {showTeamColors && (
              <span className="text-xs text-slate-400">{teamData.colors}</span>
            )}
            {league && LEAGUE_CONFIG[league] && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <CountryFlag countryCode={LEAGUE_CONFIG[league].countryCode} size={12} className="rounded-sm" />
                {LEAGUE_CONFIG[league].fullName}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Get logo metadata for the team
  const logoMeta = getTeamLogoMeta(canonicalName);
  const avatarSizePixels = size === 'xs' ? 20 : size === 'sm' ? 24 : size === 'md' ? 32 : size === 'lg' ? 40 : 48;
  const flagSize = size === 'xs' ? 14 : size === 'sm' ? 16 : size === 'md' ? 20 : size === 'lg' ? 24 : 28;
  
  // Determine country code for flag display
  const displayCountryCode = leagueConfig?.countryCode || teamData.countryCode;

  // Default variant
  return (
    <div
      className={cn(
        "flex items-center",
        sizes.spacing,
        className
      )}
    >
      {showFlag && !showTeamColors && displayCountryCode && (
        <CountryFlag 
          countryCode={displayCountryCode} 
          size={flagSize}
          className="rounded-sm flex-shrink-0"
        />
      )}
      {showFlag && showTeamColors && (
        <span className={cn(sizes.flag, "flex-shrink-0")} title={`${canonicalName}`}>{teamData.colors}</span>
      )}
      {/* Use TeamLogo with real API logos when available, fallback to Avatar */}
      {hasRealLogo(canonicalName) ? (
        <TeamLogo
          teamName={canonicalName}
          logoUrl={logoMeta.url}
          fallbackUrls={logoMeta.fallbackUrls}
          placeholder={logoMeta.placeholder}
          colors={logoMeta.colors}
          size={avatarSizePixels}
          className="flex-shrink-0"
        />
      ) : (
        <Avatar className={cn(sizes.avatar, "flex-shrink-0")}>
          {logoUrl ? (
            <AvatarImage src={logoUrl} alt={teamName} />
          ) : null}
          <AvatarFallback
            className={cn(
              "text-[0.6rem] font-bold",
              color,
              "text-white"
            )}
            aria-label={`${canonicalName} badge`}
          >
            {getTeamAbbreviation(teamName)}
          </AvatarFallback>
        </Avatar>
      )}
      <span className={cn("font-medium text-slate-200", sizes.text)}>
        {teamName}
      </span>
      {showLeaguePill && leagueConfig && leagueAbbr && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[0.65rem] font-semibold text-white shadow-sm",
            leagueConfig.color,
            "bg-opacity-90"
          )}
          title={leagueConfig.fullName}
        >
          {leagueAbbr}
        </span>
      )}
    </div>
  );
}

/**
 * TeamVsDisplay Component
 * 
 * Renders a matchup between two teams with proper flags
 */
interface TeamVsDisplayProps {
  homeTeam: string;
  awayTeam: string;
  league?: string;
  showCountryFlags?: boolean;  // Show country flags instead of team colors
  size?: TeamDisplayProps["size"];
  className?: string;
}

export function TeamVsDisplay({
  homeTeam,
  awayTeam,
  league,
  showCountryFlags = true,
  size = "md",
  className,
}: TeamVsDisplayProps) {
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        sizes.spacing,
        className
      )}
    >
      <TeamDisplay 
        teamName={homeTeam} 
        league={league}
        size={size} 
        showTeamColors={!showCountryFlags}
        showLeaguePill={Boolean(league)}
      />
      <span
        className={cn(
          "px-2 font-bold text-slate-500",
          sizes.text
        )}
      >
        vs
      </span>
      <TeamDisplay 
        teamName={awayTeam} 
        league={league}
        size={size} 
        showTeamColors={!showCountryFlags}
        showLeaguePill={Boolean(league)}
      />
    </div>
  );
}

/**
 * LeagueDisplay Component
 * 
 * Renders a league with its proper country flag
 */
interface LeagueDisplayProps {
  league: string;
  showFullName?: boolean;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

export function LeagueDisplay({
  league,
  showFullName = false,
  size = "md",
  className,
}: LeagueDisplayProps) {
  const config = LEAGUE_CONFIG[league];
  const sizes = sizeClasses[size];
  const flagSize = size === 'xs' ? 14 : size === 'sm' ? 16 : size === 'md' ? 20 : 24;
  
  if (!config) {
    return (
      <span className={cn("text-slate-400", sizes.text, className)}>
        ⚽ {league}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center",
        sizes.spacing,
        className
      )}
    >
      {config.countryCode ? (
        <CountryFlag countryCode={config.countryCode} size={flagSize} className="rounded-sm" />
      ) : (
        <span className={sizes.flag} title={config.country}>{config.flag}</span>
      )}
      <span className={cn("font-medium text-slate-300", sizes.text)}>
        {showFullName ? config.fullName : league}
      </span>
    </span>
  );
}

/**
 * TeamWithLeague Component
 * 
 * Displays a team with its league context
 */
interface TeamWithLeagueProps {
  teamName: string;
  league: string;
  size?: TeamDisplayProps["size"];
  className?: string;
}

export function TeamWithLeague({
  teamName,
  league,
  size = "md",
  className,
}: TeamWithLeagueProps) {
  const leagueConfig = LEAGUE_CONFIG[league];
  const sizes = sizeClasses[size];

  return (
    <div className={cn("flex flex-col", className)}>
      <TeamDisplay teamName={teamName} size={size} showTeamColors />
      {leagueConfig && (
        <span className={cn("text-slate-500 flex items-center gap-1", sizes.text === "text-base" ? "text-xs" : "text-[0.65rem]")}>
          {leagueConfig.countryCode ? (
            <CountryFlag countryCode={leagueConfig.countryCode} size={12} className="rounded-sm" />
          ) : (
            <span>{leagueConfig.flag}</span>
          )}
          <span>{leagueConfig.fullName}</span>
        </span>
      )}
    </div>
  );
}

// Export everything for use across the app
export { 
  TEAM_FLAGS, 
  TEAM_COLORS, 
  LEAGUE_FLAGS,
  LEAGUE_CONFIG,
  TEAM_DATA,
  getTeamData,
  resolveTeamName,
};
