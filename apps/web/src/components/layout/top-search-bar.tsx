'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { schoolNav, superAdminNav, navGroupsToSearchItems } from '@/lib/nav-items';
import type { SearchItem } from '@/lib/nav-items';

const schoolItems = navGroupsToSearchItems(schoolNav);
const superAdminItems = navGroupsToSearchItems(superAdminNav);

const trendingHrefs: Record<string, string[]> = {
  school: [
    '/school/students',
    '/school/dashboard',
    '/school/messages',
    '/school/billing',
    '/school/notifications',
  ],
  'super-admin': [
    '/super-admin/schools',
    '/super-admin/dashboard',
    '/super-admin/users',
  ],
};

const MAX_RECENT = 5;

function recentKey(variant: string) {
  return `search_recent_${variant}`;
}

function getRecent(variant: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey(variant)) ?? '[]');
  } catch {
    return [];
  }
}

function pushRecent(variant: string, href: string) {
  try {
    const prev = getRecent(variant).filter((h) => h !== href);
    localStorage.setItem(recentKey(variant), JSON.stringify([href, ...prev].slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

export function TopSearchBar({ variant }: { variant: 'super-admin' | 'school' }) {
  const router = useRouter();
  const allItems = variant === 'super-admin' ? superAdminItems : schoolItems;
  const trending = trendingHrefs[variant] ?? [];

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setRecentHrefs(getRecent(variant));
  }, [open, variant]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const results: SearchItem[] = query.trim()
    ? allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  const recentItems = recentHrefs
    .map((h) => allItems.find((i) => i.href === h))
    .filter(Boolean) as SearchItem[];

  const trendingItems = trending
    .map((h) => allItems.find((i) => i.href === h))
    .filter(Boolean) as SearchItem[];

  const handleSelect = useCallback(
    (item: SearchItem) => {
      pushRecent(variant, item.href);
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
      router.push(item.href);
    },
    [router, variant],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (query.trim() && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex]);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative w-56 sm:w-72">
      {/* Input */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border bg-white px-3 py-2 transition-all',
          open
            ? 'border-[#77328d]/40 shadow-[0_0_0_3px_rgba(119,50,141,0.08)]'
            : 'border-[#77328d]/15 shadow-sm',
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-[#a89890]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Αναζήτηση..."
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f2a28] placeholder:text-[#c0b4ac] focus:outline-none"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="search-dropdown"
          aria-activedescendant={activeIndex >= 0 ? `search-option-${activeIndex}` : undefined}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            className="rounded-md p-0.5 text-[#a89890] transition-colors hover:bg-[#f6f1ea] hover:text-[#6b625c]"
            aria-label="Καθαρισμός"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          id="search-dropdown"
          role="listbox"
          aria-label="Αποτελέσματα αναζήτησης"
          className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[18rem] rounded-2xl border border-[#77328d]/10 bg-white shadow-[0_8px_32px_-8px_rgba(119,50,141,0.18),0_2px_8px_-2px_rgba(0,0,0,0.06)]"
        >
          {/* Typing: results */}
          {query.trim() && (
            <div className="p-2">
              {results.length > 0 ? (
                results.map((item, idx) => (
                  <ResultRow
                    key={item.href}
                    id={`search-option-${idx}`}
                    item={item}
                    active={idx === activeIndex}
                    onSelect={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                  <Search className="h-7 w-7 text-[#d9cfc8]" />
                  <p className="text-sm font-semibold text-[#6b625c]">Δεν βρέθηκαν αποτελέσματα</p>
                  <p className="text-xs text-[#a89890]">Δοκιμάστε διαφορετική αναζήτηση</p>
                </div>
              )}
            </div>
          )}

          {/* Empty: Recent + Trending */}
          {!query.trim() && (
            <div className="p-2">
              <SectionHeader icon={Clock} label="Πρόσφατα" />
              {recentItems.length > 0 ? (
                recentItems.map((item) => (
                  <ResultRow key={item.href} item={item} active={false} onSelect={() => handleSelect(item)} />
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-[#c0b4ac]">Καμία πρόσφατη αναζήτηση</p>
              )}

              <div className="mt-2">
                <SectionHeader icon={TrendingUp} label="Δημοφιλή" />
                {trendingItems.map((item) => (
                  <ResultRow key={item.href} item={item} active={false} onSelect={() => handleSelect(item)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 px-3 py-1">
      <Icon className="h-3 w-3 text-[#a89890]" />
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a89890]">{label}</p>
    </div>
  );
}

function ResultRow({
  id,
  item,
  active,
  onSelect,
  onMouseEnter,
}: {
  id?: string;
  item: SearchItem;
  active: boolean;
  onSelect: () => void;
  onMouseEnter?: () => void;
}) {
  const Icon = item.icon;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onClick={onSelect}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors',
        active ? 'bg-[#f3e8f7]' : 'hover:bg-[#faf6f2]',
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
          active ? 'bg-white text-[#77328D]' : 'bg-[#f6f1ea] text-[#8a756c]',
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#2f2a28]">{item.label}</p>
      </div>
      <span className="shrink-0 rounded-md bg-[#f3e8f7] px-1.5 py-0.5 text-[10px] font-semibold text-[#77328d]">
        {item.category}
      </span>
    </div>
  );
}
