import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { League } from "@shared/schema";

interface LeagueSelectorProps {
  selectedLeague: string | null;
  onLeagueSelect: (leagueId: string) => void;
}

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
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground mb-6">Select League</h2>
      <div className="league-selector grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {leagues?.map((league) => (
          <Button
            key={league.id}
            variant="outline"
            className={`h-auto p-4 flex flex-col items-center justify-center hover:border-primary hover:bg-primary/5 transition-all group ${
              selectedLeague === league.id 
                ? "bg-primary/5 border-primary" 
                : "bg-card border-border"
            }`}
            onClick={() => onLeagueSelect(league.id)}
            data-testid={`button-league-${league.id}`}
          >
            <div className={`text-2xl mb-2 transition-colors ${
              selectedLeague === league.id 
                ? "text-primary" 
                : "group-hover:text-primary"
            }`}>
              {league.flag}
            </div>
            <div className={`font-semibold text-sm text-center ${
              selectedLeague === league.id 
                ? "text-primary" 
                : "group-hover:text-primary"
            }`}>
              {league.name}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
