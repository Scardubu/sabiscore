"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Team flag mappings for major leagues
 * Using country flags for international recognition
 */
const TEAM_FLAGS: Record<string, string> = {
  // Premier League
  Arsenal: "🔴",
  "Aston Villa": "🟣",
  Bournemouth: "🍒",
  Brentford: "🐝",
  Brighton: "🔵",
  "Brighton & Hove Albion": "🔵",
  Chelsea: "🔵",
  "Crystal Palace": "🦅",
  Everton: "🔵",
  Fulham: "⚪",
  Liverpool: "🔴",
  "Luton Town": "🧡",
  "Man City": "🔵",
  "Manchester City": "🔵",
  "Man United": "🔴",
  "Manchester United": "🔴",
  Newcastle: "⚫",
  "Newcastle United": "⚫",
  "Nottingham Forest": "🔴",
  "Nott'm Forest": "🔴",
  Sheffield: "🔴",
  "Sheffield United": "🔴",
  Tottenham: "⚪",
  "Tottenham Hotspur": "⚪",
  "West Ham": "🍷",
  "West Ham United": "🍷",
  Wolves: "🟠",
  Wolverhampton: "🟠",
  Ipswich: "🔵",
  "Ipswich Town": "🔵",
  Southampton: "🔴",
  Leicester: "🔵",
  "Leicester City": "🔵",
  Burnley: "🍷",

  // La Liga
  "Real Madrid": "⚪",
  Barcelona: "🔵🔴",
  "Atletico Madrid": "🔴⚪",
  Sevilla: "⚪🔴",
  Valencia: "🦇",
  Villarreal: "🟡",
  "Real Sociedad": "🔵⚪",
  "Real Betis": "💚",
  "Athletic Bilbao": "🔴⚪",
  Getafe: "🔵",
  Osasuna: "🔴",
  Celta: "🔵",
  "Celta Vigo": "🔵",
  Mallorca: "🔴",
  "Rayo Vallecano": "⚪🔴",
  Girona: "🔴⚪",
  "Las Palmas": "🟡",
  Alaves: "🔵⚪",
  Cadiz: "🟡",
  Granada: "🔴⚪",
  Almeria: "🔴",

  // Serie A
  "AC Milan": "🔴⚫",
  Inter: "🔵⚫",
  "Inter Milan": "🔵⚫",
  Juventus: "⚫⚪",
  Napoli: "🔵",
  Roma: "🟡🔴",
  "AS Roma": "🟡🔴",
  Lazio: "🔵⚪",
  Atalanta: "🔵⚫",
  Fiorentina: "💜",
  Torino: "🍷",
  Bologna: "🔴🔵",
  Udinese: "⚪⚫",
  Sassuolo: "💚⚫",
  Monza: "🔴⚪",
  Lecce: "🟡🔴",
  Genoa: "🔴🔵",
  Verona: "💛🔵",
  "Hellas Verona": "💛🔵",
  Empoli: "🔵",
  Cagliari: "🔴🔵",
  Frosinone: "🟡🔵",
  Salernitana: "🍷",

  // Bundesliga
  "Bayern Munich": "🔴",
  "Bayern München": "🔴",
  "Borussia Dortmund": "🟡",
  Dortmund: "🟡",
  "RB Leipzig": "🔴⚪",
  Leipzig: "🔴⚪",
  "Bayer Leverkusen": "🔴⚫",
  Leverkusen: "🔴⚫",
  Frankfurt: "⚫🔴",
  "Eintracht Frankfurt": "⚫🔴",
  Wolfsburg: "💚",
  "VfL Wolfsburg": "💚",
  "Borussia Mönchengladbach": "⚪⚫💚",
  Gladbach: "⚪⚫💚",
  "Union Berlin": "🔴⚪",
  Freiburg: "⚫🔴",
  "SC Freiburg": "⚫🔴",
  Mainz: "🔴⚪",
  "Mainz 05": "🔴⚪",
  Hoffenheim: "🔵",
  "TSG Hoffenheim": "🔵",
  Augsburg: "🔴💚⚪",
  "FC Augsburg": "🔴💚⚪",
  Werder: "💚⚪",
  "Werder Bremen": "💚⚪",
  Stuttgart: "⚪🔴",
  "VfB Stuttgart": "⚪🔴",
  Köln: "⚪🔴",
  "FC Köln": "⚪🔴",
  Bochum: "🔵",
  "VfL Bochum": "🔵",
  Heidenheim: "🔴🔵",
  "FC Heidenheim": "🔴🔵",
  Darmstadt: "🔵⚪",
  "Darmstadt 98": "🔵⚪",

  // Ligue 1
  PSG: "🔵🔴",
  "Paris Saint-Germain": "🔵🔴",
  Marseille: "🔵⚪",
  "Olympique Marseille": "🔵⚪",
  Lyon: "🔵⚪🔴",
  "Olympique Lyon": "🔵⚪🔴",
  Monaco: "🔴⚪",
  "AS Monaco": "🔴⚪",
  Lille: "🔴",
  LOSC: "🔴",
  Nice: "🔴⚫",
  "OGC Nice": "🔴⚫",
  Rennes: "🔴⚫",
  "Stade Rennais": "🔴⚫",
  Lens: "🟡🔴",
  "RC Lens": "🟡🔴",
  Strasbourg: "🔵",
  "RC Strasbourg": "🔵",
  Nantes: "🟡💚",
  "FC Nantes": "🟡💚",
  Montpellier: "🔵🟠",
  Reims: "🔴⚪",
  "Stade de Reims": "🔴⚪",
  Toulouse: "💜",
  Brest: "🔴⚪",
  "Stade Brestois": "🔴⚪",
  Lorient: "🟠",
  "FC Lorient": "🟠",
  Clermont: "🔴🔵",
  "Clermont Foot": "🔴🔵",
  Metz: "🍷",
  "FC Metz": "🍷",
  "Le Havre": "🔵",
  "Le Havre AC": "🔵",
};

/**
 * Team brand colors for backgrounds
 */
const TEAM_COLORS: Record<string, string> = {
  // Premier League
  Arsenal: "bg-red-600",
  "Aston Villa": "bg-purple-900",
  Bournemouth: "bg-red-700",
  Brentford: "bg-red-600",
  Brighton: "bg-blue-500",
  Chelsea: "bg-blue-700",
  "Crystal Palace": "bg-blue-700",
  Everton: "bg-blue-600",
  Fulham: "bg-slate-100",
  Liverpool: "bg-red-600",
  "Man City": "bg-sky-500",
  "Manchester City": "bg-sky-500",
  "Man United": "bg-red-700",
  "Manchester United": "bg-red-700",
  Newcastle: "bg-slate-900",
  "Newcastle United": "bg-slate-900",
  "Nottingham Forest": "bg-red-700",
  Tottenham: "bg-slate-100",
  "West Ham": "bg-purple-900",
  Wolves: "bg-amber-500",
  
  // La Liga
  "Real Madrid": "bg-slate-100",
  Barcelona: "bg-blue-800",
  "Atletico Madrid": "bg-red-600",
  Sevilla: "bg-slate-100",
  
  // Serie A
  "AC Milan": "bg-red-700",
  Inter: "bg-blue-900",
  Juventus: "bg-slate-900",
  Napoli: "bg-blue-600",
  Roma: "bg-yellow-600",
  
  // Bundesliga
  "Bayern Munich": "bg-red-600",
  "Borussia Dortmund": "bg-yellow-400",
  Dortmund: "bg-yellow-400",
  
  // Ligue 1
  PSG: "bg-blue-900",
  Marseille: "bg-sky-400",
  Lyon: "bg-blue-600",
};

interface TeamDisplayProps {
  teamName: string;
  showFlag?: boolean;
  showColor?: boolean;
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
 * Get team logo URL (placeholder - can be replaced with actual logo CDN)
 */
function getTeamLogoUrl(_teamName: string): string | null {
  // Using a placeholder - in production, replace with actual team logo CDN
  // Example: return `https://logos.sabiscore.com/teams/${encodeURIComponent(_teamName.toLowerCase())}.png`;
  return null;
}

/**
 * TeamDisplay Component
 * 
 * Renders team name with optional flag emoji and brand color indicator.
 * Provides consistent team display across the application.
 */
export function TeamDisplay({
  teamName,
  showFlag = true,
  showColor = false,
  size = "md",
  variant = "default",
  className,
}: TeamDisplayProps) {
  const flag = TEAM_FLAGS[teamName] ?? "⚽";
  const color = TEAM_COLORS[teamName] ?? "bg-slate-600";
  const sizes = sizeClasses[size];
  const logoUrl = getTeamLogoUrl(teamName);

  if (variant === "compact") {
    return (
      <span
        className={cn(
          "inline-flex items-center",
          sizes.spacing,
          className
        )}
      >
        {showFlag && <span className={sizes.flag}>{flag}</span>}
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
          {showFlag && (
            <span className="text-xs text-slate-400">{flag}</span>
          )}
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={cn(
        "flex items-center",
        sizes.spacing,
        className
      )}
    >
      {showFlag && (
        <span className={cn(sizes.flag, "flex-shrink-0")}>{flag}</span>
      )}
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
        >
          {getTeamAbbreviation(teamName)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("font-medium text-slate-200", sizes.text)}>
        {teamName}
      </span>
    </div>
  );
}

/**
 * TeamVsDisplay Component
 * 
 * Renders a matchup between two teams
 */
interface TeamVsDisplayProps {
  homeTeam: string;
  awayTeam: string;
  size?: TeamDisplayProps["size"];
  className?: string;
}

export function TeamVsDisplay({
  homeTeam,
  awayTeam,
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
      <TeamDisplay teamName={homeTeam} size={size} />
      <span
        className={cn(
          "px-2 font-bold text-slate-500",
          sizes.text
        )}
      >
        vs
      </span>
      <TeamDisplay teamName={awayTeam} size={size} />
    </div>
  );
}

export { TEAM_FLAGS, TEAM_COLORS };
