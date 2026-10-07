'use client';

import { useState } from 'react';

const tones: Record<string, string> = {
  purple: 'bg-gradient-to-br from-indigo-400 to-violet-500 text-white',
  green: 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white',
  rose: 'bg-gradient-to-br from-rose-400 to-pink-500 text-white',
  violet: 'bg-violet-100 text-violet-600',
  soft: 'bg-indigo-100 text-indigo-700',
  brand: 'bg-[#f3e8f7] text-[#77328D]',
};

export function PersonAvatar({
  name,
  src,
  className = 'h-9 w-9 rounded-xl text-xs',
  tone = 'purple',
  letters = 2,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
  tone?: keyof typeof tones;
  letters?: number;
}) {
  const [failed, setFailed] = useState(false);
  const label = (name ?? '').trim();
  const initials = (label.slice(0, letters).toUpperCase() || '?');
  const photo = src && !failed ? src : '';

  if (photo) {
    return (
      <img
        src={photo}
        alt={label}
        onError={() => setFailed(true)}
        className={`${className} object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div className={`${className} ${tones[tone]} flex items-center justify-center font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}
