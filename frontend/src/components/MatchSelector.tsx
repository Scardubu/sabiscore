import { memo, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import TeamPicker, { type Team } from './TeamPicker'
import SafeImage from './SafeImage'
import { getLeagueLabel } from '../lib/leagueMap'
import { apiClient, type UpcomingMatch } from '../lib/api'
import teamsData from '../data/teams.json'

interface MatchSelectorProps {
  onMatchSelect: (payload: { matchup: string; league: string }) => void
}

interface FormData {
  homeTeam: Team | null
  awayTeam: Team | null
  league: string
}

const MatchSelector = ({ onMatchSelect }: MatchSelectorProps) => {
  const [homeTeam, setHomeTeam] = useState<Team | null>(null)
  const [awayTeam, setAwayTeam] = useState<Team | null>(null)
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([])
  const [upcomingSource, setUpcomingSource] = useState<string | null>(null)
  const [isLoadingUpcoming, setIsLoadingUpcoming] = useState<boolean>(true)

  const teamMap = useMemo(() => {
    const map = new Map<string, Team>()
    ;(teamsData as Team[]).forEach((team) => {
      map.set(team.name.toLowerCase(), team)
    })
    return map
  }, [])

  const getLeagueBadgeColor = (league: string) => {
    switch (league) {
      case 'EPL': return 'from-blue-500 to-blue-700'
      case 'La Liga': return 'from-red-500 to-red-700'
      case 'Bundesliga': return 'from-black to-gray-800'
      case 'Serie A': return 'from-green-500 to-green-700'
      case 'Ligue 1': return 'from-blue-600 to-blue-800'
      case 'Eredivisie': return 'from-orange-500 to-orange-600'
      case 'Champions League': return 'from-yellow-400 to-yellow-600'
      case 'Europa League': return 'from-orange-500 to-orange-700'
      default: return 'from-gray-500 to-gray-700'
    }
  }

  const { handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      homeTeam: null,
      awayTeam: null,
      league: 'EPL'
    }
  })

  const handleHomeTeamSelect = (team: Team) => {
    setHomeTeam(team)
  }

  const handleAwayTeamSelect = (team: Team) => {
    setAwayTeam(team)
  }

  const onSubmit = () => {
    if (!homeTeam || !awayTeam) {
      toast.error('Please select both home and away teams')
      return
    }
    
    const matchup = `${homeTeam.name} vs ${awayTeam.name}`
    const league = homeTeam.league // Use home team's league
    onMatchSelect({ matchup, league })
    toast.success(`Analyzing: ${matchup}`)
  }

  useEffect(() => {
    let mounted = true
    const loadUpcoming = async () => {
      try {
        setIsLoadingUpcoming(true)
        const response = await apiClient.getUpcomingMatches(7, 6)
        if (!mounted) return
        setUpcomingMatches(response.matches || [])
        setUpcomingSource(response.source ?? null)
      } catch (error) {
        if (!mounted) return
        setUpcomingMatches([])
        setUpcomingSource(null)
      } finally {
        if (mounted) setIsLoadingUpcoming(false)
      }
    }

    loadUpcoming()
    return () => {
      mounted = false
    }
  }, [])

  const selectUpcomingFixture = (match: UpcomingMatch) => {
    const home = teamMap.get(match.home_team.toLowerCase())
    const away = teamMap.get(match.away_team.toLowerCase())

    if (home) setHomeTeam(home)
    if (away) setAwayTeam(away)

    onMatchSelect({
      matchup: `${match.home_team} vs ${match.away_team}`,
      league: match.league,
    })
    toast.success(`Loaded fixture: ${match.home_team} vs ${match.away_team}`)
  }

  return (
    <div className="glass-card p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-h2 mb-2 text-slate-100">Select Teams & League</h2>
        <p className="text-body text-slate-300/80">
          Choose your matchup and league to unlock AI-powered betting intelligence
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-start">
          <div>
            <label htmlFor="homeTeam" className="block text-sm font-medium mb-2">
              Home Team
            </label>
            <TeamPicker 
              onTeamSelect={handleHomeTeamSelect} 
              placeholder="Search home team..."
              id="homeTeam"
            />
            {!homeTeam && errors.homeTeam && (
              <p className="text-red-400 text-sm mt-1">{errors.homeTeam.message}</p>
            )}
          </div>

          <div className="flex items-center justify-center pt-2 md:pt-8">
            <div className="w-14 h-14 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center shadow-lg">
              <span className="text-xl font-semibold text-indigo-300 tracking-widest">VS</span>
            </div>
          </div>

          <div>
            <label htmlFor="awayTeam" className="block text-sm font-medium mb-2">
              Away Team
            </label>
            <TeamPicker 
              onTeamSelect={handleAwayTeamSelect} 
              placeholder="Search away team..."
              id="awayTeam"
            />
            {!awayTeam && errors.awayTeam && (
              <p className="text-red-400 text-sm mt-1">{errors.awayTeam.message}</p>
            )}
          </div>
        </div>

        <div className="text-center">
          <button 
            type="submit" 
            className="btn-primary w-full sm:w-auto"
            disabled={!homeTeam || !awayTeam}
          >
            <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analyze Match
          </button>
        </div>
      </form>

      <div className="mt-4">
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-100">Upcoming Fixtures</h3>
          {upcomingSource && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Source: {upcomingSource}
            </span>
          )}
        </div>
        {isLoadingUpcoming ? (
          <div className="text-sm text-slate-400">Loading upcoming matches...</div>
        ) : upcomingMatches.length === 0 ? (
          <div className="text-sm text-slate-400">No upcoming fixtures available right now.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcomingMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => selectUpcomingFixture(match)}
                className="text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-3"
              >
                <div className="text-sm font-semibold text-slate-100">
                  {match.home_team} vs {match.away_team}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {getLeagueLabel(match.league)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Match Preview */}
      {homeTeam && awayTeam && (
        <div className="mt-8 glass-card p-4 sm:p-6 border border-indigo-500/10 motion-safe:animate-fade-in">
          <h3 className="text-lg font-semibold mb-4 text-slate-100">Match Preview</h3>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center text-center gap-2 sm:gap-4 mb-4">
            <div className="flex flex-col items-center">
              {homeTeam.crest && (
                <SafeImage src={homeTeam.crest} alt={homeTeam.name} className="w-12 h-12 mb-2 object-contain" width={48} height={48} />
              )}
              <p className="font-semibold text-sm sm:text-lg text-slate-50 leading-tight">{homeTeam.name}</p>
              <p className="text-sm text-slate-400">{homeTeam.league}</p>
            </div>
            <div className="text-indigo-300 font-bold text-xl sm:text-2xl px-1 sm:px-4">vs</div>
            <div className="flex flex-col items-center">
              {awayTeam.crest && (
                <SafeImage src={awayTeam.crest} alt={awayTeam.name} className="w-12 h-12 mb-2 object-contain" width={48} height={48} />
              )}
              <p className="font-semibold text-sm sm:text-lg text-slate-50 leading-tight">{awayTeam.name}</p>
              <p className="text-sm text-slate-400">{awayTeam.league}</p>
            </div>
          </div>
          <div className='flex justify-center mb-4'>
            <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${getLeagueBadgeColor(homeTeam.league)} text-white text-sm font-semibold motion-safe:animate-pulse`}>
              {getLeagueLabel(homeTeam.league)}
            </div>
          </div>
          <p className="text-body-sm text-slate-300/80 mt-4 text-center">
            Click "Analyze Match" to visualize probabilities, xG projections, and betting value in seconds.
          </p>
        </div>
      )}
    </div>
  )
}

export default memo(MatchSelector)
