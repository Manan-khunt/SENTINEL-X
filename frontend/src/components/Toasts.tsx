// Toasts: bottom-right, 4s, for approval results and errors (DESIGN.md §5).
// Success/failure always comes from the backend response — never optimistic.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

const Ctx = createContext<{ push: (kind: ToastKind, title: string, body?: string) => void }>({
  push: () => {},
});

export function useToasts() {
  return useContext(Ctx);
}

const KIND_STYLE: Record<ToastKind, string> = {
  success: 'border-success/40 text-success',
  error: 'border-danger/40 text-danger',
  info: 'border-info/40 text-info',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-4), { id, kind, title, body }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[320px] pointer-events-none"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto rounded border bg-surface px-3 py-2 ${KIND_STYLE[t.kind]}`}
          >
            <div className="font-mono text-[11px] font-bold tracking-wider">{t.title}</div>
            {t.body && (
              <div className="font-mono text-[10px] text-muted mt-0.5 break-words">{t.body}</div>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
