import { describe, expect, test } from '@jest/globals'
import { LEAGUE_OPTIONS, getLeagueLabel, inferLeagueFromTeams } from '../leagueMap'

describe('leagueMap utilities', () => {
  test('LEAGUE_OPTIONS contains expected leagues', () => {
    expect(LEAGUE_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'EPL', label: 'Premier League' }),
        expect.objectContaining({ value: 'La Liga', label: 'La Liga' }),
        expect.objectContaining({ value: 'Champions League', label: 'Champions League' })
      ])
    )
  })

  test('getLeagueLabel returns correct label', () => {
    expect(getLeagueLabel('EPL')).toBe('Premier League')
    expect(getLeagueLabel('invalid')).toBe('invalid') // fallback
  })

  test('inferLeagueFromTeams detects leagues', () => {
    // Same league
    expect(inferLeagueFromTeams('Arsenal', 'Chelsea')).toBe('EPL')
    expect(inferLeagueFromTeams('Real Madrid', 'Barcelona')).toBe('La Liga')

    // Cross-league becomes Champions League
    expect(inferLeagueFromTeams('Arsenal', 'Real Madrid')).toBe('Champions League')

    // Single team detection
    expect(inferLeagueFromTeams('Arsenal', 'Unknown Team')).toBe('EPL')
    expect(inferLeagueFromTeams('Unknown', 'Barcelona')).toBe('La Liga')

    // Unknown teams
    expect(inferLeagueFromTeams('Unknown A', 'Unknown B')).toBeNull()
  })
})
