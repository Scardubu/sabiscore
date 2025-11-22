"use client";

import { useEffect, useMemo, useRef, useState, useId } from "react";
import { useQuery } from "@tanstack/react-query";

interface TeamResult {
  id: string;
  name: string;
  league_id: string;
  country?: string;
  stadium?: string;
}

interface TeamAutocompleteApiProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  league?: string;
  placeholder?: string;
  disabled?: boolean;
  apiUrl?: string;
}

/**
 * API-backed team autocomplete with debounced search.
 * Queries the backend /matches/teams/search endpoint for real-time fuzzy matching.
 */
export function TeamAutocompleteApi({
  label,
  value,
  onChange,
  league,
  placeholder,
  disabled,
  apiUrl = "/api/v1/matches/teams/search",
}: TeamAutocompleteApiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const uid = useId();

  // Debounce search query (300ms)
  useEffect(() => {
    const trimmed = internalValue.trim();
    if (trimmed.length < 2) {
      setSearchQuery("");
      return;
    }

    const timer = setTimeout(() => {
      setSearchQuery(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [internalValue]);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }, [disabled]);

  // Fetch teams from backend
  const { data: teams, isLoading, isError } = useQuery<TeamResult[]>({
    queryKey: ["teams", searchQuery, league],
    queryFn: async () => {
      const params = new URLSearchParams({ query: searchQuery, limit: "10" });
      if (league) {
        params.append("league", league);
      }

      const response = await fetch(`${apiUrl}?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Team search failed: ${response.status}`);
      }

      return response.json();
    },
    enabled: searchQuery.length >= 2 && !disabled,
    staleTime: 60 * 1000, // Cache for 60s
    retry: 1,
  });

  const filteredOptions = useMemo(() => {
    return teams || [];
  }, [teams]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) {
        return;
      }

      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (teamName: string) => {
    setInternalValue(teamName);
    onChange(teamName);
    setIsOpen(false);
    setHighlightedIndex(-1);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setInternalValue(nextValue);
    onChange(nextValue);
    if (!isOpen) {
      setIsOpen(true);
    }
    setHighlightedIndex(-1);
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(event.key === "ArrowDown" ? 0 : Math.max(0, filteredOptions.length - 1));
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current < 0 ? 0 : current + 1 >= filteredOptions.length ? 0 : current + 1
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current < 0 ? Math.max(0, filteredOptions.length - 1) : current <= 0 ? filteredOptions.length - 1 : current - 1
      );
    }

    if (event.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        event.preventDefault();
        handleSelect(filteredOptions[highlightedIndex].name);
      } else {
        setIsOpen(false);
      }
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const showDropdown = isOpen && searchQuery.length >= 2;
  const showLoading = showDropdown && isLoading;
  const showResults = showDropdown && !isLoading && filteredOptions.length > 0;
  const showEmpty = showDropdown && !isLoading && !isError && filteredOptions.length === 0;
  const showError = showDropdown && isError;

  return (
    <div ref={containerRef} className="space-y-2">
      <label className="text-sm font-medium text-slate-300" htmlFor={`team-combobox-${uid}`}>
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={`team-combobox-${uid}`}
          value={internalValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown ? true : undefined}
          aria-haspopup="listbox"
          aria-controls={showDropdown ? `team-listbox-${uid}` : undefined}
          aria-activedescendant={showDropdown && highlightedIndex >= 0 ? `team-option-${uid}-${highlightedIndex}` : undefined}
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-600"
        />

        {showLoading && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-indigo-500/30 bg-slate-900/98 px-4 py-3 text-sm shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span className="text-slate-300">Searching teams...</span>
            </div>
          </div>
        )}

        {showResults && (
          <ul
            id={`team-listbox-${uid}`}
            role="listbox"
            className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 backdrop-blur-sm shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {filteredOptions.map((team, index) => (
              <li
                key={team.id}
                id={`team-option-${uid}-${index}`}
                role="option"
                aria-selected={highlightedIndex === index ? true : undefined}
                className={`cursor-pointer px-4 py-2 transition-all duration-200 ${
                  highlightedIndex === index
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-200 hover:bg-slate-800 hover:shadow-sm"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(team.name)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="text-sm font-medium">{team.name}</div>
                {team.country && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    {team.country} • {team.league_id}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {showEmpty && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/98 px-4 py-3 text-sm shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>No teams found. Try a different search.</span>
            </div>
          </div>
        )}

        {showError && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-amber-600/50 bg-slate-900/98 px-4 py-3 text-sm shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 text-amber-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Unable to load teams. You can still enter a custom name.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
