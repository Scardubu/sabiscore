import { useEffect, useRef, useState } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { toast, Toaster } from 'react-hot-toast'
import { lazy, Suspense } from 'react'

// Lazy load components for better performance
const MatchSelector = lazy(() => import('./components/MatchSelector'))
const InsightsDisplay = lazy(() => import('./components/InsightsDisplay'))
const ErrorScreen = lazy(() => import('./components/ErrorScreen'))
const Header = lazy(() => import('./components/Header'))
const ErrorBoundary = lazy(() => import('./components/ErrorBoundary'))
const LoadingCard = lazy(() => import('./components/ui/LoadingCard'))
import LoadingSpinner from './components/ui/LoadingSpinner'
import { InsightsResponse, apiClient } from './lib/api'

// Fallback loading component for Suspense boundaries
const SuspenseFallback = () => (
  <div className="min-h-screen bg-app-surface flex items-center justify-center">
    <LoadingSpinner size="lg" variant="primary" message="Loading application..." />
  </div>
);

function App() {
  const [selectedRequest, setSelectedRequest] = useState<{ matchup: string; league: string } | null>(null)
  const [currentInsights, setCurrentInsights] = useState<InsightsResponse | null>(null)
  const lastInsightsTimestampRef = useRef<string | null>(null)
  const hasNotifiedInsightsErrorRef = useRef(false)
  const hasNotifiedHealthErrorRef = useRef(false)

  // Health check query with better error handling
  const { isLoading: healthLoading, error: healthError }: UseQueryResult<Awaited<ReturnType<typeof apiClient.healthCheck>>> = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.healthCheck(),
    retry: (failureCount, error) => {
      // Don't retry on certain errors
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        return failureCount < 2
      }
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Insights query with better error handling
  const { data: insights, isLoading: insightsLoading, isFetching, error: insightsError, refetch: refetchInsights }: UseQueryResult<InsightsResponse> = useQuery({
    queryKey: ['insights', selectedRequest?.matchup, selectedRequest?.league],
    queryFn: async () => {
      if (!selectedRequest) {
        throw new Error('No matchup selected')
      }
      try {
        return await apiClient.generateInsights(selectedRequest.matchup, selectedRequest.league)
      } catch (error) {
        // Log the error for debugging
        console.error('Insights API error:', error)
        throw error
      }
    },
    enabled: !!selectedRequest,
    retry: (failureCount, error) => {
      // Don't retry on validation errors (400 series)
      if (error instanceof Error && error.message.includes('400')) {
        return false
      }
      // Don't retry timeout errors more than once
      if (error instanceof Error && error.message.includes('timeout')) {
        return failureCount < 1
      }
      return failureCount < 2
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })

  useEffect(() => {
    if (!insights) return
    if (lastInsightsTimestampRef.current === insights.generated_at) {
      return
    }
    lastInsightsTimestampRef.current = insights.generated_at
    setCurrentInsights(insights)
    toast.success('Insights generated successfully!')
  }, [insights])

  useEffect(() => {
    if (!insightsError) return
    if (hasNotifiedInsightsErrorRef.current) {
      return
    }
    hasNotifiedInsightsErrorRef.current = true
    toast.error('Failed to generate insights. Please try again.')
  }, [insightsError])

  useEffect(() => {
    if (!healthError) {
      hasNotifiedHealthErrorRef.current = false
      return
    }
    if (hasNotifiedHealthErrorRef.current) {
      return
    }
    hasNotifiedHealthErrorRef.current = true
    toast.error('Failed to connect to backend. Please check if the server is running.')
  }, [healthError])

  useEffect(() => {
    if (!insightsError) {
      hasNotifiedInsightsErrorRef.current = false
    }
  }, [insightsError])

  const handleMatchSelect = ({ matchup, league }: { matchup: string; league: string }) => {
    setCurrentInsights(null)
    setSelectedRequest({ matchup, league })
  }

  const handleRetry = () => {
    if (selectedRequest) {
      void refetchInsights()
    }
  }

  if (healthLoading) {
    return (
      <div className="min-h-screen bg-app-surface flex items-center justify-center">
        <LoadingSpinner size="xl" variant="primary" message="Connecting to server..." />
      </div>
    )
  }

  if (healthError) {
    return (
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorScreen onRetry={() => window.location.reload()} />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-app-surface text-slate-100">
      <Suspense fallback={<SuspenseFallback />}>
        <ErrorBoundary>
          <Header />
          <main className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto space-y-8">
              <MatchSelector onMatchSelect={handleMatchSelect} />

              {(insightsLoading || isFetching) && (
                <Suspense fallback={<div className="glass-card p-8"><LoadingSpinner size="lg" /></div>}>
                  <LoadingCard 
                    variant="enhanced" 
                    title="Analyzing Match Data" 
                    message="Our AI is processing thousands of data points to generate your insights..."
                  />
                </Suspense>
              )}

              {insightsError && (
                <div className="glass-card p-8 border-red-500/20 animate-fade-in">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-2">
                      <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-red-400">Generation Failed</h3>
                    <p className="text-gray-300 max-w-md mx-auto">
                      Unable to generate insights for this matchup. This could be due to insufficient data or a temporary server issue.
                    </p>
                    <button
                      onClick={handleRetry}
                      className="btn-primary inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {currentInsights && !insightsLoading && (
                <InsightsDisplay insights={currentInsights} />
              )}
            </div>
          </main>
        </ErrorBoundary>
      </Suspense>
      <Toaster position="top-right" />
    </div>
  )
}

export default App
