'use client';

export type AudienceType = 'all' | 'class' | 'level' | 'teachers';

export type AudienceValue = {
  audienceType: AudienceType;
  audienceIds: string[];
};

type ScopeOption = { value: AudienceType; label: string; icon: string };

const OPTIONS: ScopeOption[] = [
  { value: 'all',      label: 'Όλοι',         icon: '👥' },
  { value: 'class',    label: 'Τάξη',          icon: '🏫' },
  { value: 'level',    label: 'Βαθμίδα',       icon: '📚' },
  { value: 'teachers', label: 'Εκπαιδευτικοί', icon: '👩‍🏫' },
];

export function AudienceSelector({
  value,
  onChange,
  classes = [],
  levels = [],
  options = OPTIONS,
}: {
  value: AudienceValue;
  onChange: (v: AudienceValue) => void;
  classes?: { id: string; name: string }[];
  levels?: { id: string; name: string }[];
  options?: ScopeOption[];
}) {
  const toggleId = (id: string) => {
    const next = value.audienceIds.includes(id)
      ? value.audienceIds.filter(x => x !== id)
      : [...value.audienceIds, id];
    onChange({ ...value, audienceIds: next });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange({ audienceType: opt.value, audienceIds: [] })}
            className={`py-2.5 px-2 text-xs rounded-xl border-2 font-medium transition-colors text-center ${
              value.audienceType === opt.value
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-600 hover:border-indigo-200'
            }`}
          >
            <div className="text-base mb-0.5">{opt.icon}</div>
            {opt.label}
          </button>
        ))}
      </div>

      {value.audienceType === 'class' && classes.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
          {classes.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleId(c.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                value.audienceIds.includes(c.id)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {value.audienceType === 'level' && levels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {levels.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => toggleId(l.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                value.audienceIds.includes(l.id)
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-600 hover:border-indigo-200'
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function audienceLabel(
  audienceType: string,
  audienceIds: string | string[],
  classes: { id: string; name: string }[],
  levels: { id: string; name: string }[],
): string {
  const ids: string[] = typeof audienceIds === 'string'
    ? (() => { try { return JSON.parse(audienceIds); } catch { return []; } })()
    : audienceIds;

  if (audienceType === 'all') return 'Όλοι';
  if (audienceType === 'teachers') return 'Εκπαιδευτικοί';
  if (audienceType === 'class') {
    const names = ids.map(id => classes.find(c => c.id === id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : 'Συγκεκριμένες τάξεις';
  }
  if (audienceType === 'level') {
    const names = ids.map(id => levels.find(l => l.id === id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : 'Συγκεκριμένες βαθμίδες';
  }
  return 'Όλοι';
}
