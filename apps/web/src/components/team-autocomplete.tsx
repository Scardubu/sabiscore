"use client";

import { useEffect, useMemo, useRef, useState, useId } from "react";

interface TeamAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Lightweight combobox that keeps bundle size small while giving quick access to curated team lists.
 */
export function TeamAutocomplete({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled
}: TeamAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const uid = useId();

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Ensure menu closes when component becomes disabled
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }, [disabled]);

  const filteredOptions = useMemo(() => {
    const query = internalValue.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter((team) => team.toLowerCase().includes(query));
  }, [internalValue, options]);

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

  const handleSelect = (team: string) => {
    setInternalValue(team);
    onChange(team);
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
      // When opening via arrows, set an initial highlight for better UX
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
        handleSelect(filteredOptions[highlightedIndex]);
      } else {
        setIsOpen(false);
      }
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <label className="text-sm font-medium text-slate-300" htmlFor={`team-combobox-${uid}`}>{label}</label>
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
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls={isOpen ? `team-listbox-${uid}` : undefined}
          aria-activedescendant={isOpen && highlightedIndex >= 0 ? `team-option-${uid}-${highlightedIndex}` : undefined}
          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {isOpen && filteredOptions.length > 0 && (
          <ul
            id={`team-listbox-${uid}`}
            role="listbox"
            className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-slate-700 bg-slate-900/95 shadow-lg"
          >
            {filteredOptions.map((team, index) => (
              <li
                key={team}
                id={`team-option-${uid}-${index}`}
                role="option"
                aria-selected={highlightedIndex === index ? "true" : undefined}
                className={`cursor-pointer px-4 py-2 text-sm transition-colors ${
                  highlightedIndex === index
                    ? "bg-indigo-600 text-white"
                    : "text-slate-200 hover:bg-slate-800"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(team)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {team}
              </li>
            ))}
          </ul>
        )}

        {isOpen && filteredOptions.length === 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm text-slate-400 shadow-lg">
            No teams found. Keep typing to use a custom name.
          </div>
        )}
      </div>
    </div>
  );
}
