import { useState } from "react";
import Header from "@/components/header";
import LeagueSelector from "@/components/league-selector";
import UpcomingMatches from "@/components/upcoming-matches";
import AnalyticsDashboard from "@/components/analytics-dashboard";
import DetailedAnalysis from "@/components/detailed-analysis";
import Footer from "@/components/footer";

export default function Dashboard() {
  const [selectedLeague, setSelectedLeague] = useState<string | null>("6"); // Default to Champions League
  const [selectedMatch, setSelectedMatch] = useState<string | null>("1"); // Default to first match

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <LeagueSelector selectedLeague={selectedLeague} onLeagueSelect={setSelectedLeague} />
        <UpcomingMatches 
          selectedLeague={selectedLeague} 
          onMatchSelect={setSelectedMatch}
          selectedMatch={selectedMatch}
        />
        <AnalyticsDashboard />
        {selectedMatch && <DetailedAnalysis matchId={selectedMatch} />}
      </main>
      <Footer />
    </div>
  );
}
