import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { useState } from "react";

interface UpcomingMatchesProps {
  selectedLeague: string | null;
  onMatchSelect: (matchId: string) => void;
  selectedMatch: string | null;
}

export default function UpcomingMatches({ selectedLeague, onMatchSelect, selectedMatch }: UpcomingMatchesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("today");

  const { data: matches, isLoading } = useQuery({
    queryKey: ["/api/matches/upcoming", selectedLeague],
    enabled: !!selectedLeague,
  });

  const filteredMatches = matches?.filter((match: any) => {
    const searchMatch = searchTerm === "" || 
      match.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return searchMatch;
  });

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 70) return { label: "High Confidence", variant: "default" as const };
    if (confidence >= 50) return { label: "Medium Confidence", variant: "secondary" as const };
    return { label: "Low Confidence", variant: "destructive" as const };
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "bg-success";
    if (confidence >= 50) return "bg-secondary";
    return "bg-destructive";
  };

  const formatMatchTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Upcoming Matches</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Upcoming Matches</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
              data-testid="input-search-teams"
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          </div>
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-32" data-testid="select-time-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMatches?.map((match: any) => {
          const confidence = match.prediction?.confidence || 0;
          const confidenceBadge = getConfidenceBadge(confidence);
          const confidenceColor = getConfidenceColor(confidence);

          return (
            <Card
              key={match.id}
              className={`prediction-card cursor-pointer hover:shadow-lg transition-all ${
                selectedMatch === match.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => onMatchSelect(match.id)}
              data-testid={`card-match-${match.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    {match.league.name} • {formatMatchTime(match.matchDate)}
                  </div>
                  <Badge variant={confidenceBadge.variant} data-testid={`badge-confidence-${match.id}`}>
                    {confidenceBadge.label}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-primary text-xl">⚽</span>
                    </div>
                    <div>
                      <div className="font-semibold" data-testid={`text-home-team-${match.id}`}>
                        {match.homeTeam.name}
                      </div>
                      <div className="text-sm text-muted-foreground">Home</div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-foreground">VS</div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="font-semibold" data-testid={`text-away-team-${match.id}`}>
                        {match.awayTeam.name}
                      </div>
                      <div className="text-sm text-muted-foreground">Away</div>
                    </div>
                    <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                      <span className="text-secondary text-xl">⚽</span>
                    </div>
                  </div>
                </div>
                
                {match.prediction && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Prediction:</span>
                      <span className="font-semibold text-primary" data-testid={`text-prediction-${match.id}`}>
                        {match.prediction.prediction.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Confidence:</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`confidence-bar h-full rounded-full ${confidenceColor}`}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium" data-testid={`text-confidence-${match.id}`}>
                          {confidence}%
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Expected Goals:</span>
                      <span className="text-sm" data-testid={`text-expected-goals-${match.id}`}>
                        {match.prediction.expectedGoalsHome} - {match.prediction.expectedGoalsAway}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
