'use client';
import { useEffect, useState } from 'react';

/** Keep the server/first client render identical, then use the owner's browser timezone. */
export default function AdminDate({ value }: { value: string | null }) {
  const [zone, setZone] = useState('UTC');
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);
  if (!value) return <>—</>;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return <>—</>;
  const text = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone,
    timeZoneName: 'short',
  }).format(date);
  return (
    <time
      dateTime={date.toISOString()}
      title={`${zone} · UTC: ${date.toISOString()}`}
    >
      {text}
    </time>
  );
}
