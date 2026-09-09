import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastContext = createContext(null);

const ICONS = {
  success: CheckCircle2,
  destructive: AlertCircle,
  info: Info,
};

const STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
  info: 'border-border bg-card text-foreground',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(({ title, description, variant = 'success', duration = 3200 }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((list) => [...list, { id, title, description, variant }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant] || Info;
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex animate-fade-in items-start gap-2.5 rounded-lg border p-3 shadow-lg',
                STYLES[t.variant],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 opacity-80">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="বন্ধ করুন">
                <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
