import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

interface DetailedAnalysisProps {
  matchId: string;
}

export default function DetailedAnalysis({ matchId }: DetailedAnalysisProps) {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ["/api/matches", matchId, "analysis"],
    enabled: !!matchId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-96" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  const { homeTeam, awayTeam, homeStats, awayStats, prediction } = analysis;

  const metrics = [
    {
      name: "Goals Per Game",
      home: homeStats?.goalsPerGame || "0.0",
      away: awayStats?.goalsPerGame || "0.0",
      homePercentage: 55,
      awayPercentage: 45
    },
    {
      name: "Expected Goals (xG)",
      home: homeStats?.expectedGoals || "0.0", 
      away: awayStats?.expectedGoals || "0.0",
      homePercentage: 58,
      awayPercentage: 42
    },
    {
      name: "Possession %",
      home: `${homeStats?.possessionPercent || 0}%`,
      away: `${awayStats?.possessionPercent || 0}%`,
      homePercentage: 52,
      awayPercentage: 48
    },
    {
      name: "Shots on Target",
      home: homeStats?.shotsOnTarget || "0.0",
      away: awayStats?.shotsOnTarget || "0.0",
      homePercentage: 52,
      awayPercentage: 48
    }
  ];

  const getFormLetter = (letter: string) => {
    switch (letter) {
      case "W": return { letter: "W", color: "bg-success text-white" };
      case "D": return { letter: "D", color: "bg-muted text-white" };
      case "L": return { letter: "L", color: "bg-destructive text-white" };
      default: return { letter: "?", color: "bg-muted text-white" };
    }
  };

  const calculateFormPoints = (form: string) => {
    return form.split("").reduce((points, result) => {
      if (result === "W") return points + 3;
      if (result === "D") return points + 1;
      return points;
    }, 0);
  };

  const insights = prediction?.insights || [
    "Teams well matched based on recent form",
    "Historical data suggests competitive match",
    "Both teams strong in their respective areas"
  ];

  return (
    <Card data-testid="detailed-analysis">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle data-testid="analysis-title">
            Team Analysis: {homeTeam?.name} vs {awayTeam?.name}
          </CardTitle>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Full Report
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Team Comparison */}
          <div>
            <h4 className="font-semibold mb-4">Key Metrics Comparison</h4>
            <div className="space-y-4">
              {metrics.map((metric, index) => (
                <div key={index} data-testid={`metric-${index}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{metric.name}</span>
                    <span>{metric.home} vs {metric.away}</span>
                  </div>
                  <div className="flex space-x-1">
                    <div 
                      className="h-2 bg-primary rounded-full transition-all duration-1000"
                      style={{ width: `${metric.homePercentage}%` }}
                    />
                    <div 
                      className="h-2 bg-secondary rounded-full transition-all duration-1000"
                      style={{ width: `${metric.awayPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{homeTeam?.name}</span>
                    <span>{awayTeam?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Recent Form */}
          <div>
            <h4 className="font-semibold mb-4">Recent Form (Last 5 Games)</h4>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{homeTeam?.name}</span>
                  <div className="flex space-x-1" data-testid="home-team-form">
                    {(homeStats?.recentForm || "WWDWW").split("").map((result, i) => {
                      const form = getFormLetter(result);
                      return (
                        <Badge 
                          key={i}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${form.color}`}
                        >
                          {form.letter}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {homeStats?.recentForm ? 
                    `${homeStats.recentForm.split("W").length - 1}W-${homeStats.recentForm.split("D").length - 1}D-${homeStats.recentForm.split("L").length - 1}L • ${calculateFormPoints(homeStats.recentForm)} points` :
                    "4W-1D-0L • 13 points"
                  }
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{awayTeam?.name}</span>
                  <div className="flex space-x-1" data-testid="away-team-form">
                    {(awayStats?.recentForm || "WWWLW").split("").map((result, i) => {
                      const form = getFormLetter(result);
                      return (
                        <Badge 
                          key={i}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${form.color}`}
                        >
                          {form.letter}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {awayStats?.recentForm ? 
                    `${awayStats.recentForm.split("W").length - 1}W-${awayStats.recentForm.split("D").length - 1}D-${awayStats.recentForm.split("L").length - 1}L • ${calculateFormPoints(awayStats.recentForm)} points` :
                    "4W-0D-1L • 12 points"
                  }
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <h5 className="font-semibold text-primary mb-2">Key Insights</h5>
              <ul className="text-sm text-muted-foreground space-y-1" data-testid="key-insights">
                {insights.map((insight, index) => (
                  <li key={index}>• {insight}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
