import React, { useState, useEffect, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import teamsData from '../data/teams.json';
import SafeImage from './SafeImage';

export interface Team {
  id: number;
  name: string;
  shortName: string;
  league: string;
  country: string;
  crest: string;
}

interface TeamPickerProps {
  onTeamSelect: (team: Team) => void;
  placeholder?: string;
  ariaLabel?: string;
  selectedTeam?: Team | null;
  id?: string;
}

const RECENT_TEAMS_KEY = 'sabiscore_recent_teams';
const MAX_RECENT_TEAMS = 3;

const TeamPicker: React.FC<TeamPickerProps> = ({
  onTeamSelect,
  placeholder = 'Search teams...',
  ariaLabel = 'Search 1,200 teams',
  selectedTeam = null,
  id,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Team[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [recentTeams, setRecentTeams] = useState<Team[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize Fuse.js
  const fuse = useRef(
    new Fuse(teamsData as Team[], {
      keys: [
        { name: 'name', weight: 2 },
        { name: 'shortName', weight: 1.5 },
        { name: 'league', weight: 1 },
        { name: 'country', weight: 0.5 },
      ],
      threshold: 0.3,
      distance: 100,
      minMatchCharLength: 2,
      includeScore: true,
    })
  ).current;

  // Load recent teams from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_TEAMS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentTeams(parsed);
      }
    } catch (error) {
      console.error('Failed to load recent teams:', error);
    }
  }, []);

  // Handle search
  // Debounce user input to reduce work on slower devices
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 120);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    const searchResults = fuse.search(debouncedQuery);
    const teams = searchResults.slice(0, 10).map((result) => result.item);
    setResults(teams);
  }, [debouncedQuery, fuse]);

  // Save team to recent
  const saveRecentTeam = useCallback((team: Team) => {
    try {
      const stored = localStorage.getItem(RECENT_TEAMS_KEY);
      let recent: Team[] = stored ? JSON.parse(stored) : [];

      // Remove if already exists
      recent = recent.filter((t) => t.id !== team.id);

      // Add to beginning
      recent.unshift(team);

      // Keep only last 3
      recent = recent.slice(0, MAX_RECENT_TEAMS);

      localStorage.setItem(RECENT_TEAMS_KEY, JSON.stringify(recent));
      setRecentTeams(recent);
    } catch (error) {
      console.error('Failed to save recent team:', error);
    }
  }, []);

  // Handle team selection
  const handleSelect = useCallback(
    (team: Team) => {
      onTeamSelect(team);
      saveRecentTeam(team);
      setQuery('');
      setIsOpen(false);
      setFocusedIndex(-1);
    },
    [onTeamSelect, saveRecentTeam]
  );

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && e.key === 'ArrowDown') {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    const displayResults = query.trim().length >= 2 ? results : recentTeams;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < displayResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && displayResults[focusedIndex]) {
          handleSelect(displayResults[focusedIndex]);
        } else if (displayResults.length > 0 && displayResults[0]) {
          // If nothing is focused, choose the top result for faster UX
          handleSelect(displayResults[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayResults = query.trim().length >= 2 ? results : recentTeams;
  const showRecents = query.trim().length < 2 && recentTeams.length > 0;

  const highlight = (text: string, term: string) => {
    if (!term || term.trim().length < 2) return text;
    try {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(${escaped})`, 'ig');
      return text.replace(re, '<mark>$1</mark>');
    } catch {
      return text;
    }
  }

  return (
    <div className="team-picker">
      <div className="team-picker-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="team-picker-input"
          placeholder={placeholder}
          aria-label={ariaLabel}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setFocusedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="words"
          spellCheck={false}
          id={id}
        />
        <svg
          className="team-picker-search-icon"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {selectedTeam && (
        <div className="team-picker-selected">
            <div className="team-chip">
            <SafeImage
              src={selectedTeam.crest}
              alt={`${selectedTeam.name} crest`}
              className="team-chip-crest"
              width={32}
              height={32}
              loading="lazy"
            />
            <div className="team-chip-info">
              <span className="team-chip-name">{selectedTeam.shortName}</span>
              <span className="team-chip-league">{selectedTeam.league}</span>
            </div>
            <button
              className="team-chip-remove"
              onClick={() => onTeamSelect(null as any)}
              aria-label={`Remove ${selectedTeam.name}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {isOpen && displayResults.length > 0 && (
        <div ref={dropdownRef} className="team-picker-dropdown">
          {showRecents && (
            <div className="team-picker-section-header">Recent Teams</div>
          )}
          <ul 
            className="team-picker-results" 
            role="listbox"
            aria-label="Team search results"
          >
            {displayResults.map((team, index) => {
              const isSelected = index === focusedIndex;
              return (
                <li
                  key={team.id}
                  className={`team-picker-result ${
                    isSelected ? 'focused' : ''
                  }`}
                  role="option"
                  aria-selected={isSelected ? 'true' : 'false'}
                  onClick={() => handleSelect(team)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                <SafeImage
                  src={team.crest}
                  alt={`${team.name} crest`}
                  className="team-result-crest"
                  width={32}
                  height={32}
                  loading="lazy"
                />
                <div className="team-result-info">
                  <span
                    className="team-result-name"
                    dangerouslySetInnerHTML={{ __html: highlight(team.name, debouncedQuery) }}
                  />
                  <span className="team-result-details">
                    {team.league} • {team.country}
                  </span>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {isOpen && query.trim().length >= 2 && results.length === 0 && (
        <div ref={dropdownRef} className="team-picker-dropdown">
          <div className="team-picker-empty">
            No teams found for "{query}"
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamPicker;
