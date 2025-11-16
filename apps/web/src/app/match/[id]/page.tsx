import { notFound } from "next/navigation";
import { InsightsDisplayWrapper } from "@/components/insights-display-wrapper";
import { getMatchInsights } from "@/lib/api";

// Edge runtime disabled to prevent styled-jsx SSR errors during build
// export const runtime = "edge";
// export const preferredRegion = ["iad1", "lhr1", "fra1"];
export const revalidate = 15; // ISR: revalidate every 15 seconds
export const fetchCache = "force-no-store"; // Always fresh for live data

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ league?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = (await searchParams) || {};
  const { id } = resolvedParams;
  const { league } = resolvedSearch;

  const matchup = decodeURIComponent(id);

  return {
    title: `${matchup} - Insights | Sabiscore`,
    description: `AI-powered betting insights and predictions for ${matchup} in ${league || "EPL"}`,
  };
}

export default async function MatchInsightsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearch = (await searchParams) || {};
  const { id } = resolvedParams;
  const { league = "EPL" } = resolvedSearch;

  const matchup = decodeURIComponent(id);

  try {
    const insights = await getMatchInsights(matchup, league);

    return (
      <div className="max-w-6xl mx-auto">
        <InsightsDisplayWrapper insights={insights} />
      </div>
    );
  } catch (error) {
    console.error("Failed to fetch insights:", error);
    notFound();
  }
}
