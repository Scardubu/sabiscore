import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, InfoIcon, TrendingUp } from "lucide-react";
import { useState } from "react";

interface UpcomingMatchesProps {
  selectedLeague: string | null;
  onMatchSelect: (matchId: string) => void;
  selectedMatch: string | null;
}

export default function UpcomingMatches({ selectedLeague, onMatchSelect, selectedMatch }: UpcomingMatchesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("today");

  const { data: matches, isLoading } = useQuery<any[]>({
    queryKey: ["/api/matches/upcoming", selectedLeague],
    enabled: !!selectedLeague,
  });

  const filteredMatches = matches?.filter((match: any) => {
    const searchMatch = searchTerm === "" || 
      match.homeTeam.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.awayTeam.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Time filtering
    if (timeFilter !== "today") {
      const matchDate = new Date(match.matchDate);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      if (timeFilter === "tomorrow") {
        const isMatchTomorrow = matchDate.toDateString() === tomorrow.toDateString();
        return searchMatch && isMatchTomorrow;
      }
      
      if (timeFilter === "week") {
        const weekFromNow = new Date(today);
        weekFromNow.setDate(today.getDate() + 7);
        const isMatchThisWeek = matchDate >= today && matchDate <= weekFromNow;
        return searchMatch && isMatchThisWeek;
      }
    }
    
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
              <SelectItem value="today">All Matches</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="week">Next 7 Days</SelectItem>
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
                  <div className="flex items-center space-x-2">
                    <div className="text-sm text-muted-foreground font-medium">
                      {match.league.name} • {formatMatchTime(match.matchDate)}
                    </div>
                    <Tooltip>
                      <TooltipTrigger>
                        <InfoIcon className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Prediction based on team form, head-to-head records,</p>
                        <p>player statistics, and advanced analytics models.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center space-x-2">
                    {confidence >= 70 && (
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center space-x-1 bg-success/10 text-success px-2 py-1 rounded-full">
                            <TrendingUp className="w-3 h-3" />
                            <span className="text-xs font-medium">Hot Pick</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>High confidence prediction!</p>
                          <p>This bet offers excellent value.</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Badge 
                      variant={confidenceBadge.variant} 
                      className="font-medium"
                      data-testid={`badge-confidence-${match.id}`}
                    >
                      {confidenceBadge.label}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center hover:bg-primary/20 transition-colors">
                          <span className="text-primary text-xl">{match.homeTeam.logo || '⚽'}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Home team advantage</p>
                        <p>Click for detailed team statistics</p>
                      </TooltipContent>
                    </Tooltip>
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
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center hover:bg-secondary/20 transition-colors">
                          <span className="text-secondary text-xl">{match.awayTeam.logo || '⚽'}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Away team challenge</p>
                        <p>Click for detailed team statistics</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                
                {match.prediction && (
                  <div className="space-y-4 border-t border-border/50 pt-4">
                    <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-muted-foreground">AI Prediction</span>
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="font-bold text-lg text-primary cursor-help" data-testid={`text-prediction-${match.id}`}>
                              {match.prediction.prediction.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>AI prediction based on:</p>
                            <p>• Recent team performance</p>
                            <p>• Head-to-head history</p>
                            <p>• Player form and injuries</p>
                            <p>• Home/away advantages</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Confidence Level</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-24 h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`confidence-bar h-full rounded-full ${confidenceColor} shadow-sm`}
                              style={{ width: `${confidence}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold min-w-[40px]" data-testid={`text-confidence-${match.id}`}>
                            {confidence}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-2 bg-card border border-border rounded">
                        <div className="text-xs text-muted-foreground mb-1">Expected Goals</div>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="font-bold text-lg cursor-help" data-testid={`text-expected-goals-${match.id}`}>
                              {match.prediction.expectedGoalsHome} - {match.prediction.expectedGoalsAway}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Expected Goals (xG) represents the quality</p>
                            <p>of scoring chances each team is likely to create.</p>
                            <p>Higher xG = more scoring opportunities expected.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-center p-2 bg-card border border-border rounded">
                        <div className="text-xs text-muted-foreground mb-1">Value Bets</div>
                        <div className="font-bold text-lg text-secondary">
                          {match.prediction.valueBets?.length || 0}
                        </div>
                      </div>
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
