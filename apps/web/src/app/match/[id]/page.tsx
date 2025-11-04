import { notFound } from "next/navigation";
import { InsightsDisplay } from "@/components/insights-display";
import { Header } from "@/components/header";
import { getMatchInsights } from "@/lib/api";

export const runtime = "edge";
export const preferredRegion = ["iad1", "lhr1", "fra1"];
export const revalidate = 15; // ISR: revalidate every 15 seconds
export const fetchCache = "force-no-store"; // Always fresh for live data

interface PageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    league?: string;
  }>;
}

export async function generateMetadata({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { league } = await searchParams;
  
  const matchup = decodeURIComponent(id);
  
  return {
    title: `${matchup} - Insights | Sabiscore`,
    description: `AI-powered betting insights and predictions for ${matchup} in ${league || "EPL"}`,
  };
}

export default async function MatchInsightsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { league = "EPL" } = await searchParams;
  
  const matchup = decodeURIComponent(id);

  try {
    const insights = await getMatchInsights(matchup, league);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Header />
        
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <InsightsDisplay insights={insights} />
          </div>
        </main>
      </div>
    );
  } catch (error) {
    console.error("Failed to fetch insights:", error);
    notFound();
  }
}
