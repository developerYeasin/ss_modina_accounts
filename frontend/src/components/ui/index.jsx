import { forwardRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ChevronDown, Check, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------- Button ------------------------------- */

const BUTTON_VARIANTS = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
  outline: 'border border-white/60 bg-white/70 hover:bg-white/90',
  ghost: 'hover:bg-muted',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  link: 'text-primary underline-offset-4 hover:underline',
};

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs',
  default: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
  icon: 'h-9 w-9',
};

export const Button = forwardRef(function Button(
  { className, variant = 'default', size = 'default', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50',
        BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});

/* -------------------------------- Card -------------------------------- */

export const Card = ({ className, ...props }) => (
  <div className={cn('glass-card rounded-xl', className)} {...props} />
);
export const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-1 p-4 pb-2', className)} {...props} />
);
export const CardTitle = ({ className, ...props }) => (
  <h3 className={cn('text-base font-semibold leading-tight', className)} {...props} />
);
export const CardDescription = ({ className, ...props }) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...props} />
);
export const CardContent = ({ className, ...props }) => (
  <div className={cn('p-4 pt-2', className)} {...props} />
);
export const CardFooter = ({ className, ...props }) => (
  <div className={cn('flex items-center gap-2 p-4 pt-0', className)} {...props} />
);

/* ------------------------------- Inputs ------------------------------- */

const fieldClass =
  'flex h-10 w-full rounded-md border border-white/60 bg-white/70 px-3 py-2 text-sm ' +
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldClass, className)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldClass, 'min-h-[80px] py-2', className)} {...props} />;
});

/** Password field with an eye toggle, so a typo can be checked before submitting. */
export const PasswordInput = forwardRef(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn(fieldClass, 'pr-10', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
        title={visible ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
        className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldClass, 'appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
});

export function Label({ className, children, required, ...props }) {
  return (
    <label className={cn('text-sm font-medium text-foreground', className)} {...props}>
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

/** Label + control + optional hint, the layout every form row uses. */
export function Field({ label, required, hint, error, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <Label required={required}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className, ...props }) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center gap-2 text-sm', className)}>
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-white/60 bg-white/70',
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={!!checked}
        onChange={(e) => onChange?.(e.target.checked)}
        {...props}
      />
      {label}
    </label>
  );
}

/* -------------------------------- Badge ------------------------------- */

const BADGE_VARIANTS = {
  default: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary text-secondary-foreground',
  accent: 'bg-accent/15 text-accent-foreground',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-sky-100 text-sky-800',
  destructive: 'bg-destructive/10 text-destructive',
  outline: 'border text-foreground',
};

export const Badge = ({ className, variant = 'default', ...props }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      BADGE_VARIANTS[variant], className,
    )}
    {...props}
  />
);

/* -------------------------------- Dialog ------------------------------ */

export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          'glass relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl shadow-xl sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b p-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="বন্ধ করুন">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'মুছে ফেলুন' }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title || 'নিশ্চিত করুন'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>বাতিল</Button>
          <Button
            variant="destructive"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(); onClose?.(); } finally { setBusy(false); }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{message || 'এই কাজটি আর ফেরানো যাবে না।'}</p>
    </Dialog>
  );
}

/* ------------------------------- Tabs --------------------------------- */

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cn('flex gap-1 overflow-x-auto rounded-xl bg-white/50 p-1 backdrop-blur', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cn(
            'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === t.value
              ? 'bg-white/90 text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="ml-1.5 text-xs opacity-70">({t.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Feedback ------------------------------ */

export const Spinner = ({ className }) => (
  <Loader2 className={cn('h-5 w-5 animate-spin text-muted-foreground', className)} />
);

export const Loading = ({ label = 'লোড হচ্ছে…' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
    <Spinner /> {label}
  </div>
);

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/70 bg-white/50 px-6 py-14 text-center backdrop-blur">
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/60" />}
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="font-medium text-destructive">সমস্যা হয়েছে</p>
      <p className="mt-1 text-muted-foreground">{error?.message || 'তথ্য আনা যায়নি।'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          আবার চেষ্টা করুন
        </Button>
      )}
    </div>
  );
}

export const Skeleton = ({ className }) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
);
