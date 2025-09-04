import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { TrophyIcon } from "lucide-react";
import type { League } from "@shared/schema";

interface LeagueSelectorProps {
  selectedLeague: string | null;
  onLeagueSelect: (leagueId: string) => void;
}

const getLeagueInfo = (league: League) => {
  const info = {
    "1": { matches: 6, description: "England's top flight with the world's best players" },
    "2": { matches: 2, description: "Spain's premier league featuring El Clasico" },
    "3": { matches: 2, description: "Germany's Bundesliga with high-scoring matches" },
    "4": { matches: 2, description: "Italy's Serie A tactical masterclass" },
    "5": { matches: 2, description: "France's Ligue 1 with rising stars" },
    "6": { matches: 3, description: "Europe's elite competition" }
  };
  return info[league.id as keyof typeof info] || { matches: 0, description: "Top-level football" };
};

export default function LeagueSelector({ selectedLeague, onLeagueSelect }: LeagueSelectorProps) {
  const { data: leagues, isLoading } = useQuery<League[]>({
    queryKey: ["/api/leagues"],
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">Select League</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="relative">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="absolute -top-1 -right-1 h-4 w-6 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground flex items-center space-x-2">
          <TrophyIcon className="w-6 h-6 text-secondary" />
          <span>Select League</span>
        </h2>
        <div className="text-sm text-muted-foreground">
          {selectedLeague && leagues ? 
            `${getLeagueInfo(leagues.find(l => l.id === selectedLeague)!).matches} matches available` : 
            'Choose a league to view upcoming matches'
          }
        </div>
      </div>
      <div className="league-selector grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {leagues?.map((league) => {
          const leagueInfo = getLeagueInfo(league);
          const isSelected = selectedLeague === league.id;
          
          return (
            <Tooltip key={league.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className={`h-auto p-4 flex flex-col items-center justify-center hover:border-primary hover:bg-primary/5 transition-all group relative ${
                    isSelected 
                      ? "bg-primary/5 border-primary ring-2 ring-primary/20" 
                      : "bg-card border-border hover:shadow-md"
                  }`}
                  onClick={() => onLeagueSelect(league.id)}
                  data-testid={`button-league-${league.id}`}
                >
                  {leagueInfo.matches > 0 && (
                    <Badge 
                      variant="secondary" 
                      className="absolute -top-2 -right-2 text-xs px-1 py-0 min-w-[20px] h-5"
                    >
                      {leagueInfo.matches}
                    </Badge>
                  )}
                  <div className={`text-3xl mb-2 transition-all duration-200 ${
                    isSelected 
                      ? "text-primary scale-110" 
                      : "group-hover:text-primary group-hover:scale-105"
                  }`}>
                    {league.flag}
                  </div>
                  <div className={`font-semibold text-sm text-center transition-colors ${
                    isSelected 
                      ? "text-primary" 
                      : "group-hover:text-primary"
                  }`}>
                    {league.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {league.country}
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{league.name}</p>
                <p className="text-sm">{leagueInfo.description}</p>
                <p className="text-xs mt-1">💡 {leagueInfo.matches} upcoming matches with predictions</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
