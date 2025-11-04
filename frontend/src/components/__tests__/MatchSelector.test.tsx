import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, test } from '@jest/globals'
import MatchSelector from '../MatchSelector'

jest.mock('react-hot-toast', () => {
  const success = jest.fn()
  const error = jest.fn()
  const toast = Object.assign(jest.fn(), { success, error })
  return {
    __esModule: true,
    default: toast,
  }
})

jest.mock('@/lib/api', () => ({
  apiClient: {
    searchMatches: jest.fn().mockResolvedValue([]),
  },
}))

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  )
}

describe('MatchSelector', () => {
  test('renders team inputs and league selector', () => {
    renderWithClient(<MatchSelector onMatchSelect={jest.fn()} />)

    expect(screen.getByLabelText('Home Team')).toBeInTheDocument()
    expect(screen.getByLabelText('Away Team')).toBeInTheDocument()
    expect(screen.getByLabelText('League')).toBeInTheDocument()
  })

  test('auto-detects league when teams are entered', async () => {
    const user = userEvent.setup()
    renderWithClient(<MatchSelector onMatchSelect={jest.fn()} />)

    await user.type(screen.getByLabelText('Home Team'), 'Arsenal')
    await user.type(screen.getByLabelText('Away Team'), 'Chelsea')

    await waitFor(() => {
      const leagueSelect = screen.getByLabelText('League') as HTMLSelectElement
      expect(leagueSelect.value).toBe('EPL')
    })
  })

  test('triggers onMatchSelect with correct data', async () => {
    const mockOnSelect = jest.fn()
    const user = userEvent.setup()
    renderWithClient(<MatchSelector onMatchSelect={mockOnSelect} />)

    await user.type(screen.getByLabelText('Home Team'), 'Arsenal')
    await user.type(screen.getByLabelText('Away Team'), 'Chelsea')
    await user.click(screen.getByText('Analyze Match'))
    
    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith({
        matchup: 'Arsenal vs Chelsea',
        league: 'EPL'
      })
    })
  })
})
