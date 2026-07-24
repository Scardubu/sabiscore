import { notFound } from "next/navigation";
import { InsightsDisplayWrapper } from "@/components/insights-display-wrapper";
import { FullAnalysisSection } from "@/components/full-analysis-section";
import { Phase8AnalyticsSection } from "@/components/phase8-analytics-section";
import { InsightsErrorState } from "@/components/insights-error-state";
import { getMatchInsights, APIError } from "@/lib/api";
import {
  classifyAnalysisError,
  type AnalysisErrorCategory,
} from "@/lib/full-analysis-contract";

// Force fully-dynamic rendering: each request fetches live data.
// Removing revalidate + fetchCache = "force-no-store" eliminates the ISR
// conflict that caused stale error pages to be served for up to 15 s.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params?: Promise<{ id: string }>;
  searchParams?: Promise<{ league?: string }>;
};

export async function generateMetadata({ params, searchParams }: PageProps) {
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
  if (!params) notFound();

  let id: string;
  let league: string = "EPL";

  try {
    const resolvedParams = await params;
    id = resolvedParams.id;
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    league = resolvedSearchParams?.league || "EPL";
  } catch {
    notFound();
  }

  const matchup = decodeURIComponent(id);

  // ── Fetch insights ─────────────────────────────────────────────────────────
  // Handle backend errors inline rather than throwing to error.tsx.
  // In Next.js 15 production mode, error.tsx receives a sanitised error object
  // (message is stripped, digest is an opaque hash), so the error page cannot
  // distinguish timeout from server-error from unknown. Rendering inline lets
  // us show the correct copy for each explicit error class.
  let errorType: AnalysisErrorCategory | null = null;

  try {
    const insights = await getMatchInsights(matchup, league);

    return (
      <div className="max-w-6xl mx-auto space-y-12">
        <InsightsDisplayWrapper insights={insights} />
        <FullAnalysisSection matchId={matchup} league={league} />
        <Phase8AnalyticsSection matchId={matchup} league={league} />
      </div>
    );
  } catch (error) {
    if (error instanceof APIError) {
      // True 404s / invalid matchup format → show the 404 page
      if (
        error.status === 404 ||
        error.code === "INVALID_MATCHUP" ||
        error.code === "INVALID_MATCHUP_FORMAT"
      ) {
        notFound();
      }

      // Preserve status and code: HTTP 500 remains an internal error, while
      // only explicit/recognized wake-up failures receive cold-start copy.
      errorType = classifyAnalysisError({
        status: error.status,
        code: error.code,
      });
    } else if (error instanceof Error) {
      // A generic network failure is unavailable, not proof of a cold start.
      errorType = classifyAnalysisError({ networkError: true });
    } else {
      errorType = "unknown";
    }

    console.error(
      "[MatchInsightsPage] Backend error:",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Render inline error — FullAnalysisSection still mounts so Phase 7 data
  // can load independently (it has its own error boundary + retry).
  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <InsightsErrorState errorType={errorType ?? "unknown"} matchup={matchup} />
      <FullAnalysisSection matchId={matchup} league={league} />
      <Phase8AnalyticsSection matchId={matchup} league={league} />
    </div>
  );
}
