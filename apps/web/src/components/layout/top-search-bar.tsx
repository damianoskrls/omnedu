'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Clock, TrendingUp, GraduationCap, Baby, Users, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, studentsApi, staffApi } from '@/lib/api';
import { useStoredUser } from '@/lib/auth';
import { PersonAvatar } from '@/components/PersonAvatar';
import { schoolNav, superAdminNav, navGroupsToSearchItems } from '@/lib/nav-items';
import type { SearchItem } from '@/lib/nav-items';

// ─── Nav items ────────────────────────────────────────────────────────────────
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

// ─── Entity types ─────────────────────────────────────────────────────────────
type Student = { id: string; fullName: string; className?: string; avatarUrl?: string; isActive?: boolean };
type Parent = { id: string; fullName: string; phone?: string | null; email?: string; children?: { fullName: string }[] };
type StaffMember = { id: string; fullName: string; phone?: string; role?: string; avatarUrl?: string };

type EntityResult = {
  kind: 'student' | 'parent' | 'staff' | 'nav';
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  icon?: LucideIcon;
  category?: string;
};

const ROLE_LABELS: Record<string, string> = {
  school_admin: 'Διαχειριστής',
  teacher: 'Εκπαιδευτικός',
  owner: 'Ιδιοκτήτης',
  driver: 'Οδηγός σχολικού',
};

// ─── Module-level entity cache ────────────────────────────────────────────────
type EntityCache = { students: Student[]; parents: Parent[]; staff: StaffMember[] };
const entityCache: {
  schoolId?: string;
  data?: EntityCache;
  fetchedAt?: number;
  inflight?: Promise<EntityCache>;
} = {};
const CACHE_TTL = 5 * 60 * 1000;

async function fetchEntities(schoolId: string): Promise<EntityCache> {
  const now = Date.now();
  if (
    entityCache.schoolId === schoolId &&
    entityCache.data &&
    entityCache.fetchedAt &&
    now - entityCache.fetchedAt < CACHE_TTL
  ) {
    return entityCache.data;
  }
  // Deduplicate concurrent callers: return the in-flight promise if one exists
  if (entityCache.schoolId === schoolId && entityCache.inflight) {
    return entityCache.inflight;
  }
  const promise = Promise.all([
    studentsApi.list(schoolId).catch(() => []),
    api.get(`/schools/${schoolId}/parents`).catch(() => []),
    staffApi.list(schoolId).catch(() => []),
  ]).then(([students, parents, staff]) => {
    const data: EntityCache = {
      students: Array.isArray(students) ? students : [],
      parents: Array.isArray(parents) ? parents : [],
      staff: Array.isArray(staff) ? staff : [],
    };
    entityCache.schoolId = schoolId;
    entityCache.data = data;
    entityCache.fetchedAt = Date.now();
    entityCache.inflight = undefined;
    return data;
  });
  entityCache.schoolId = schoolId;
  entityCache.inflight = promise;
  return promise;
}

// Strip Greek (and other) diacritics so "γιωργος" matches "Γιώργος"
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function filterEntities(data: EntityCache, q: string, navItems: SearchItem[]): EntityResult[] {
  const lower = normalize(q);
  const results: EntityResult[] = [];

  // Students — active and inactive (archive may be searched intentionally)
  const students = data.students
    .filter((s) => normalize(s.fullName).includes(lower))
    .slice(0, 5);
  for (const s of students) {
    results.push({
      kind: 'student',
      id: s.id,
      label: s.fullName,
      subtitle: s.className ?? (s.isActive === false ? 'Αρχειοθετημένος' : undefined),
      href: `/school/students/${s.id}`,
    });
  }

  // Parents — match name, phone, email, or child's name
  const parents = data.parents
    .filter((p) => {
      const haystack = [
        p.fullName,
        p.phone ?? '',
        p.email ?? '',
        ...(p.children ?? []).map((c) => c.fullName),
      ].map(normalize).join(' ');
      return haystack.includes(lower);
    })
    .slice(0, 5);
  for (const p of parents) {
    results.push({
      kind: 'parent',
      id: p.id,
      label: p.fullName,
      subtitle: p.phone ?? p.email,
      href: `/school/parents/${p.id}`,
    });
  }

  // Staff
  const staff = data.staff
    .filter((m) => {
      const haystack = [m.fullName, m.phone ?? '', m.role ?? ''].map(normalize).join(' ');
      return haystack.includes(lower);
    })
    .slice(0, 3);
  for (const m of staff) {
    results.push({
      kind: 'staff',
      id: m.id,
      label: m.fullName,
      subtitle: m.role ? ROLE_LABELS[m.role] ?? m.role : undefined,
      href: `/school/staff/${m.id}`,
    });
  }

  // Nav items
  const nav = navItems
    .filter((item) =>
      normalize(item.label).includes(lower) || normalize(item.category).includes(lower),
    )
    .slice(0, 3);
  for (const item of nav) {
    results.push({
      kind: 'nav',
      id: item.href,
      label: item.label,
      subtitle: item.category,
      href: item.href,
      icon: item.icon,
      category: item.category,
    });
  }

  return results;
}

// ─── Recent ───────────────────────────────────────────────────────────────────
const MAX_RECENT = 5;

function recentKey(variant: string) { return `search_recent_${variant}`; }

function getRecent(variant: string): string[] {
  try { return JSON.parse(localStorage.getItem(recentKey(variant)) ?? '[]'); }
  catch { return []; }
}

function pushRecent(variant: string, href: string) {
  try {
    const prev = getRecent(variant).filter((h) => h !== href);
    localStorage.setItem(recentKey(variant), JSON.stringify([href, ...prev].slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TopSearchBar({ variant }: { variant: 'super-admin' | 'school' }) {
  const router = useRouter();
  const user = useStoredUser();
  const schoolId = user?.schoolId ?? '';
  const navItems = variant === 'super-admin' ? superAdminItems : schoolItems;
  const trending = trendingHrefs[variant] ?? [];

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<EntityResult[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Generation counter: lets async callbacks detect they're stale
  const genRef = useRef(0);

  useEffect(() => {
    if (open) setRecentHrefs(getRecent(variant));
  }, [open, variant]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setActiveIndex(-1);
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    const gen = ++genRef.current;

    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (variant !== 'school' || !schoolId) {
      setResults(filterEntities({ students: [], parents: [], staff: [] }, q, navItems));
      return;
    }

    // Warm cache: filter synchronously, no spinner
    if (
      entityCache.schoolId === schoolId &&
      entityCache.data &&
      entityCache.fetchedAt &&
      Date.now() - entityCache.fetchedAt < CACHE_TTL
    ) {
      setResults(filterEntities(entityCache.data, q, navItems));
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetchEntities(schoolId)
        .then((data) => {
          if (genRef.current !== gen) return; // stale — a newer query is in-flight
          setResults(filterEntities(data, q, navItems));
        })
        .catch(() => {
          if (genRef.current !== gen) return;
          setResults([]);
        })
        .finally(() => {
          if (genRef.current !== gen) return;
          setLoading(false);
        });
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, variant, schoolId, navItems]);

  // Prefetch entity data silently when dropdown opens (warms the cache)
  useEffect(() => {
    if (open && variant === 'school' && schoolId) {
      fetchEntities(schoolId).catch(() => {});
    }
  }, [open, variant, schoolId]);

  const recentNavItems = recentHrefs
    .map((h) => navItems.find((i) => i.href === h))
    .filter(Boolean) as SearchItem[];

  const trendingItems = trending
    .map((h) => navItems.find((i) => i.href === h))
    .filter(Boolean) as SearchItem[];

  const handleSelect = useCallback(
    (href: string) => {
      pushRecent(variant, href);
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
      setResults([]);
      router.push(href);
    },
    [router, variant],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
      setResults([]);
      inputRef.current?.blur();
      return;
    }
    if (query.trim().length >= 2 && results.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, -1));
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        handleSelect(results[activeIndex].href);
      }
    }
  }

  const showSearch = query.trim().length >= 2;

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
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#a89890]" />}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setActiveIndex(-1);
              setResults([]);
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
          className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[22rem] rounded-2xl border border-[#77328d]/10 bg-white shadow-[0_8px_32px_-8px_rgba(119,50,141,0.18),0_2px_8px_-2px_rgba(0,0,0,0.06)]"
        >
          {/* ── Search results ── */}
          {showSearch && (
            <div className="p-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-[#a89890]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Αναζήτηση...
                </div>
              ) : results.length > 0 ? (
                <ResultGroups
                  results={results}
                  activeIndex={activeIndex}
                  onSelect={handleSelect}
                  onMouseEnter={setActiveIndex}
                />
              ) : (
                <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
                  <Search className="h-7 w-7 text-[#d9cfc8]" />
                  <p className="text-sm font-semibold text-[#6b625c]">Δεν βρέθηκαν αποτελέσματα</p>
                  <p className="text-xs text-[#a89890]">Δοκιμάστε διαφορετική αναζήτηση</p>
                </div>
              )}
            </div>
          )}

          {/* ── Hint for 1-char query ── */}
          {query.trim().length === 1 && (
            <p className="px-5 py-4 text-xs text-[#a89890]">Συνεχίστε να πληκτρολογείτε...</p>
          )}

          {/* ── Empty state: Recent + Trending (only when query is fully empty) ── */}
          {query.trim().length === 0 && (
            <div className="p-2">
              <SectionHeader icon={Clock} label="Πρόσφατα" />
              {recentNavItems.length > 0 ? (
                recentNavItems.map((item) => (
                  <NavRow key={item.href} item={item} onSelect={() => handleSelect(item.href)} />
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-[#c0b4ac]">Καμία πρόσφατη αναζήτηση</p>
              )}
              <div className="mt-2">
                <SectionHeader icon={TrendingUp} label="Δημοφιλή" />
                {trendingItems.map((item) => (
                  <NavRow key={item.href} item={item} onSelect={() => handleSelect(item.href)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Grouped result renderer ──────────────────────────────────────────────────
const KIND_CONFIG = {
  student: { label: 'Μαθητές', icon: GraduationCap },
  parent: { label: 'Γονείς', icon: Baby },
  staff: { label: 'Προσωπικό', icon: Users },
  nav: { label: 'Ενότητες', icon: Search },
};

function ResultGroups({
  results,
  activeIndex,
  onSelect,
  onMouseEnter,
}: {
  results: EntityResult[];
  activeIndex: number;
  onSelect: (href: string) => void;
  onMouseEnter: (idx: number) => void;
}) {
  const kinds: (keyof typeof KIND_CONFIG)[] = ['student', 'parent', 'staff', 'nav'];
  let globalIdx = 0;

  return (
    <>
      {kinds.map((kind) => {
        const group = results.filter((r) => r.kind === kind);
        if (!group.length) return null;
        const config = KIND_CONFIG[kind];
        const startIdx = globalIdx;
        globalIdx += group.length;
        return (
          <div key={kind}>
            <SectionHeader icon={config.icon} label={config.label} />
            {group.map((item, i) => {
              const idx = startIdx + i;
              return (
                <EntityRow
                  key={item.id}
                  id={`search-option-${idx}`}
                  result={item}
                  active={idx === activeIndex}
                  onSelect={() => onSelect(item.href)}
                  onMouseEnter={() => onMouseEnter(idx)}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ─── Row components ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 px-3 py-1">
      <Icon className="h-3 w-3 text-[#a89890]" />
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#a89890]">{label}</p>
    </div>
  );
}

function EntityRow({
  id,
  result,
  active,
  onSelect,
  onMouseEnter,
}: {
  id?: string;
  result: EntityResult;
  active: boolean;
  onSelect: () => void;
  onMouseEnter?: () => void;
}) {
  const isNav = result.kind === 'nav';
  const Icon = result.icon;

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
      {isNav && Icon ? (
        <span
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
            active ? 'bg-white text-[#77328D]' : 'bg-[#f6f1ea] text-[#8a756c]',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      ) : (
        <PersonAvatar
          name={result.label}
          className={cn('h-6 w-6 rounded-full text-[9px]', active ? 'opacity-100' : '')}
          tone="brand"
          letters={2}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#2f2a28]">{result.label}</p>
        {result.subtitle && (
          <p className="truncate text-[11px] text-[#a89890]">{result.subtitle}</p>
        )}
      </div>

      {isNav && result.category && (
        <span className="shrink-0 rounded-md bg-[#f3e8f7] px-1.5 py-0.5 text-[10px] font-semibold text-[#77328d]">
          {result.category}
        </span>
      )}
    </div>
  );
}

// NavRow reuses EntityRow by fabricating an EntityResult — keeps styling in sync
function NavRow({ item, onSelect }: { item: SearchItem; onSelect: () => void }) {
  const result: EntityResult = {
    kind: 'nav',
    id: item.href,
    label: item.label,
    subtitle: item.category,
    href: item.href,
    icon: item.icon,
    category: item.category,
  };
  return <EntityRow result={result} active={false} onSelect={onSelect} />;
}
