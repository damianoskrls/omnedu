'use client';

interface Time24InputProps {
  value: string; // "HH:MM" in 24h format
  onChange: (value: string) => void;
  className?: string;
}

export function Time24Input({ value, onChange, className }: Time24InputProps) {
  const [hStr, mStr] = value && value.includes(':') ? value.split(':') : ['', ''];
  const hours = hStr !== '' ? parseInt(hStr, 10) : -1;
  const minutes = mStr !== '' ? parseInt(mStr, 10) : -1;

  const setHour = (h: number) => {
    const m = minutes >= 0 ? minutes : 0;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const setMinute = (m: number) => {
    const h = hours >= 0 ? hours : 0;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const selectCls = className ?? '';

  return (
    <div className="flex gap-1">
      <select
        value={hours >= 0 ? hours : ''}
        onChange={e => setHour(parseInt(e.target.value, 10))}
        className={selectCls}
      >
        <option value="">ΩΩ</option>
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
        ))}
      </select>
      <select
        value={minutes >= 0 ? minutes : ''}
        onChange={e => setMinute(parseInt(e.target.value, 10))}
        className={selectCls}
      >
        <option value="">ΛΛ</option>
        {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  );
}
