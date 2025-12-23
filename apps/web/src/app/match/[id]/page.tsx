import { notFound } from "next/navigation";
import { InsightsDisplayWrapper } from "@/components/insights-display-wrapper";
import { getMatchInsights, APIError } from "@/lib/api";

// Use Node.js runtime for stability - Edge can cause hydration issues
export const runtime = "nodejs";
export const revalidate = 15; // ISR: revalidate every 15 seconds
export const fetchCache = "force-no-store"; // Always fresh for live data

type PageProps = {
  params?: Promise<{ id: string }>;
  searchParams?: Promise<{ league?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps) {
  // Handle undefined params gracefully
  if (!params) {
    return {
      title: "Match Not Found | Sabiscore",
      description: "The requested match could not be found.",
    };
  }

  try {
    const { id } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const { league } = resolvedSearchParams || {};

    const matchup = decodeURIComponent(id);

    return {
      title: `${matchup} - Insights | Sabiscore`,
      description: `AI-powered betting insights and predictions for ${matchup} in ${league || "EPL"}`,
    };
  } catch {
    return {
      title: "Match Insights | Sabiscore",
      description: "AI-powered betting insights and predictions.",
    };
  }
}

export default async function MatchInsightsPage({ params, searchParams }: PageProps) {
  // Guard against undefined params - this can happen during build
  if (!params) {
    notFound();
  }

  let id: string;
  let league: string = "EPL";
  
  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    league = resolvedSearchParams?.league || "EPL";
  } catch {
    // If params resolution fails, show not found
    notFound();
  }

  const matchup = decodeURIComponent(id);

  try {
    const insights = await getMatchInsights(matchup, league);

    return (
      <div className="max-w-6xl mx-auto">
        <InsightsDisplayWrapper insights={insights} />
      </div>
    );
  } catch (error) {
    // Log error safely (avoid logging full error objects in production)
    console.error("Failed to fetch insights:", 
      error instanceof Error ? error.message : "Unknown error"
    );
    
    // Only show notFound for genuine 404 errors (match not found/invalid)
    if (error instanceof APIError) {
      if (error.status === 404 || error.code === "INVALID_MATCHUP" || error.code === "INVALID_MATCHUP_FORMAT") {
        notFound();
      }
    }
    
    // For server errors, timeouts, or network issues, throw a plain Error
    // to ensure proper serialization across Server/Client boundary
    // IMPORTANT: Only pass serializable data - no custom error classes
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to load match insights. Please try again.";
    
    // Create a simple Error that can be safely serialized
    const safeError = new Error(errorMessage);
    
    // Use a simple string digest for tracking (no complex objects)
    if (error instanceof APIError && error.status) {
      Object.defineProperty(safeError, 'digest', {
        value: `api-${error.status}-${error.code || 'unknown'}`,
        enumerable: false,
        writable: false,
      });
    }
    
    throw safeError;
  }
}
