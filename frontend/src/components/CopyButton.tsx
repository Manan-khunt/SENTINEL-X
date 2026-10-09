// Copy button for truncated hashes (DESIGN.md §3: `3f9a…c1` + copy).
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard?.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="inline-flex items-center text-muted hover:text-text ml-1 align-middle"
    >
      {done ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function truncHash(h: string): string {
  if (!h) return '—';
  return h.length > 10 ? `${h.slice(0, 4)}…${h.slice(-2)}` : h;
}
