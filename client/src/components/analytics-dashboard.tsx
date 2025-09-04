import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function AnalyticsDashboard() {
  const valueBets = [
    {
      bet: "Man City Win vs Real Madrid",
      expected: 1.85,
      market: 2.20,
      value: 18.9,
      confidence: 78,
      type: "high"
    },
    {
      bet: "Over 2.5 Goals - Bayern vs Liverpool", 
      expected: 1.75,
      market: 1.95,
      value: 11.4,
      confidence: 65,
      type: "medium"
    },
    {
      bet: "BTTS Yes - Arsenal vs Chelsea",
      expected: 1.90,
      market: 2.00,
      value: 5.3,
      confidence: 58,
      type: "low"
    }
  ];

  const marketMovements = [
    { bet: "Man City Win", change: 0.15, from: 2.05, to: 2.20, direction: "up" },
    { bet: "Draw", change: -0.10, from: 3.40, to: 3.30, direction: "down" }
  ];

  const todayStats = [
    { label: "Predictions Made", value: "24", testId: "stat-predictions" },
    { label: "Success Rate", value: "73%", testId: "stat-success-rate", color: "text-success" },
    { label: "Value Bets", value: "8", testId: "stat-value-bets", color: "text-secondary" },
    { label: "Avg Confidence", value: "68%", testId: "stat-avg-confidence" }
  ];

  const performance = [
    { period: "This Week", value: "+12.3%", progress: 75 },
    { period: "This Month", value: "+8.7%", progress: 60 },
    { period: "All Time", value: "+15.2%", progress: 85 }
  ];

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
            <CardTitle>Betting Insights</CardTitle>
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
            <CardTitle>Today's Stats</CardTitle>
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
            <CardTitle>Performance</CardTitle>
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
