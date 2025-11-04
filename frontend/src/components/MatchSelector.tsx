import { memo, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import TeamPicker, { type Team } from './TeamPicker'
import SafeImage from './SafeImage'
import { getLeagueLabel } from '../lib/leagueMap'

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

  const getLeagueBadgeColor = (league: string) => {
    switch (league) {
      case 'EPL': return 'from-blue-500 to-blue-700'
      case 'La Liga': return 'from-red-500 to-red-700'
      case 'Bundesliga': return 'from-black to-gray-800'
      case 'Serie A': return 'from-green-500 to-green-700'
      case 'Ligue 1': return 'from-blue-600 to-blue-800'
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

  return (
    <div className="glass-card p-8 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-h2 mb-2 text-slate-100">Select Teams & League</h2>
        <p className="text-body text-slate-300/80">
          Choose your matchup and league to unlock AI-powered betting intelligence
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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

          <div className="flex items-center justify-center pt-8">
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
            className="btn-primary"
            disabled={!homeTeam || !awayTeam}
          >
            <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analyze Match
          </button>
        </div>
      </form>

      {/* Match Preview */}
      {homeTeam && awayTeam && (
        <div className="mt-8 glass-card p-6 border border-indigo-500/10 animate-fade-in">
          <h3 className="text-lg font-semibold mb-4 text-slate-100">Match Preview</h3>
          <div className="flex items-center justify-between text-center mb-4">
            <div className="flex flex-col items-center">
              {homeTeam.crest && (
                <SafeImage src={homeTeam.crest} alt={homeTeam.name} className="w-12 h-12 mb-2 object-contain" width={48} height={48} />
              )}
              <p className="font-semibold text-lg text-slate-50">{homeTeam.name}</p>
              <p className="text-sm text-slate-400">{homeTeam.league}</p>
            </div>
            <div className="text-indigo-300 font-bold text-2xl px-4">vs</div>
            <div className="flex flex-col items-center">
              {awayTeam.crest && (
                <SafeImage src={awayTeam.crest} alt={awayTeam.name} className="w-12 h-12 mb-2 object-contain" width={48} height={48} />
              )}
              <p className="font-semibold text-lg text-slate-50">{awayTeam.name}</p>
              <p className="text-sm text-slate-400">{awayTeam.league}</p>
            </div>
          </div>
          <div className='flex justify-center mb-4'>
            <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${getLeagueBadgeColor(homeTeam.league)} text-white text-sm font-semibold animate-pulse`}>
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
