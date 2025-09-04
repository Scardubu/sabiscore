import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function AnalyticsDashboard() {
  const { data: analyticsData, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64" />
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { valueBets = [], marketMovements = [], todayStats = [], performance = [] } = analyticsData || {};

  const getValueBetVariant = (type: string) => {
    switch (type) {
      case "high": return "default";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getValueBetColor = (type: string) => {
    switch (type) {
      case "high": return "text-success";
      case "medium": return "text-secondary";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
      {/* Betting Insights Panel */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Betting Insights</CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Value bets are calculated based on our prediction model vs market odds.</p>
                  <p>Higher confidence predictions offer better value opportunities.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Value Bets */}
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Top Value Bets</h4>
              <div className="space-y-3">
                {valueBets.map((bet, index) => (
                  <div 
                    key={index}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      bet.type === "high" ? "bg-success/5 border-success/20" :
                      bet.type === "medium" ? "bg-secondary/5 border-secondary/20" :
                      "bg-muted/5 border-border"
                    }`}
                    data-testid={`value-bet-${index}`}
                  >
                    <div>
                      <div className="font-medium">{bet.bet}</div>
                      <div className="text-sm text-muted-foreground">
                        Expected: {bet.expected} • Market: {bet.market}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${getValueBetColor(bet.type)}`}>
                        +{bet.value}% Value
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {bet.confidence}% Confidence
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Market Movements */}
            <div>
              <h4 className="font-semibold mb-3 text-foreground">Market Movements</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {marketMovements.map((movement, index) => (
                  <div 
                    key={index}
                    className="p-3 bg-card border border-border rounded-lg"
                    data-testid={`market-movement-${index}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{movement.bet}</span>
                      <div className="flex items-center space-x-1">
                        {movement.direction === "up" ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                        <span className={`text-sm ${
                          movement.direction === "up" ? "text-success" : "text-destructive"
                        }`}>
                          {movement.direction === "up" ? "+" : ""}{movement.change}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {movement.from} → {movement.to}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Quick Stats */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today's Stats</CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Real-time statistics updated every 15 minutes.</p>
                  <p>Success rate based on completed matches from our predictions.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-muted-foreground">{stat.label}</span>
                <span 
                  className={`font-bold text-xl ${stat.color || ""}`}
                  data-testid={stat.testId}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Performance</CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <InfoIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Performance tracking based on value bet returns.</p>
                  <p>Calculated using Kelly Criterion for optimal bet sizing.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {performance.map((perf, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{perf.period}</span>
                  <span className="text-success">{perf.value}</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full transition-all duration-1000"
                    style={{ width: `${perf.progress}%` }}
                    data-testid={`performance-bar-${index}`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
