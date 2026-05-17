"use client";

import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { MAJOR_OPTIONS } from "@/lib/major-keywords";
import { cn } from "@/lib/utils";

// Searchable major dropdown. Rolled custom because Base UI Select doesn't
// natively support a search input inside its popup, and we have 50 majors
// — scrolling alone is annoying.
//
// Behavior:
//   - Click trigger → opens popover with search input + filtered list
//   - Type to filter (case-insensitive substring)
//   - Click an item → selects + closes + clears query
//   - Click outside / ESC → closes
//   - Up/Down arrows → navigate highlighted index
//   - Enter → pick highlighted item
//
// Controlled component: the selected major lives in the parent (typically
// derived from a URL param). `onChange` fires with the new major (or null
// when cleared) so the parent can navigate / update state.

type Props = {
  major: string | null;
  onChange: (major: string | null) => void;
};

export function MajorCombobox({ major, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter the option list against the search query (case-insensitive).
  // Memoized so typing doesn't recompute when unrelated state changes.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MAJOR_OPTIONS;
    return MAJOR_OPTIONS.filter((m) => m.toLowerCase().includes(q));
  }, [query]);

  // Click-outside to close. Only listens while open.
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Focus the search input when the popover opens. State reset (query +
  // highlight) happens in the toggle handler itself, not here — keeping
  // setState out of the effect avoids the cascading-render lint and the
  // logic reads more obviously.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function toggleOpen() {
    if (!open) {
      setQuery("");
      setHighlight(0);
    }
    setOpen((o) => !o);
  }

  function pick(next: string | null) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const picked = filtered[highlight];
      if (picked) pick(picked);
      return;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — matches the styling of the Base UI Select trigger
          so the sidebar looks consistent. */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
      >
        <span
          className={cn(
            "truncate text-left",
            !major && "text-muted-foreground",
          )}
        >
          {major ?? "Pick a major"}
        </span>
        <div className="flex items-center gap-1">
          {major ? (
            // Inline clear button. stopPropagation so clicking it doesn't
            // toggle the popover open/closed in the same click.
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear major"
              onClick={(e) => {
                e.stopPropagation();
                pick(null);
              }}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </span>
          ) : null}
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </div>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md ring-1 ring-foreground/10">
          {/* Search input at the top of the popover. */}
          <div className="relative border-b">
            <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search majors…"
              className="h-9 w-full bg-transparent pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Filtered list. Capped height so 50 items don't blow out the
              viewport — overflow-y-auto for the rest. */}
          <ul
            role="listbox"
            aria-label="Major options"
            className="max-h-64 overflow-y-auto p-1 text-sm"
          >
            {/* "No umbrella" option — explicit way to clear the filter. */}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={major === null}
                onMouseDown={(e) => {
                  // mousedown beats the click-outside listener that would
                  // otherwise close the popover before the click fires.
                  e.preventDefault();
                  pick(null);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-accent",
                  major === null && "bg-accent/60",
                )}
              >
                <span className="text-muted-foreground">None</span>
                {major === null ? <CheckIcon className="size-3.5" /> : null}
              </button>
            </li>

            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                No matches
              </li>
            ) : (
              filtered.map((m, i) => {
                const selected = m === major;
                const highlighted = i === highlight;
                return (
                  <li key={m}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setHighlight(i)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(m);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left",
                        highlighted && "bg-accent",
                        selected && !highlighted && "bg-accent/60",
                      )}
                    >
                      <span className="truncate">{m}</span>
                      {selected ? <CheckIcon className="size-3.5" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
