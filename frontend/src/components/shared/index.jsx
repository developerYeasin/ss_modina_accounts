import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Search as SearchIcon } from 'lucide-react';
import { Button, Card, Input, Badge } from '@/components/ui';
import { cn, money } from '@/lib/utils';

/** Screen header: title, optional back arrow, optional right-hand actions, optional প্রিন্ট. */
export function PageHeader({ title, subtitle, back, actions: extra, print, className }) {
  const actions = print ? <><PrintButton />{extra}</> : extra;
  const navigate = useNavigate();
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex items-start gap-2">
        {back && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 mt-0.5"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
            aria-label="ফিরে যান"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </Button>
        )}
        <div>
          <h1 className="font-heading text-xl font-bold sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/15 text-accent-foreground',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-sky-100 text-sky-700',
  muted: 'bg-muted text-muted-foreground',
};

/** The metric tiles used on the dashboard and report screens. */
export function StatCard({ label, value, icon: Icon, tone = 'primary', hint, to, currency }) {
  const body = (
    <Card className={cn('p-4 transition-shadow', to && 'cursor-pointer border-primary/30')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">
            {label}{to && <span className="ml-1 font-medium text-primary">→</span>}
          </p>
          <p className="num mt-1 font-heading text-xl font-bold sm:text-2xl">
            {currency === false ? value : money(value, currency || '৳')}
          </p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** Small section label used between card groups. */
export const SectionTitle = ({ children, className, action }) => (
  <div className={cn('mb-2 mt-6 flex items-center justify-between gap-2 first:mt-0', className)}>
    <p className="font-heading text-sm font-semibold text-muted-foreground">{children}</p>
    {action}
  </div>
);

export function SearchInput({ value, onChange, placeholder = 'খুঁজুন…', className }) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

const STATUS_STYLES = {
  New: 'info',
  'In Progress': 'warning',
  Ready: 'accent',
  Delivered: 'success',
  Cancelled: 'destructive',
  Draft: 'secondary',
  Sent: 'info',
  Accepted: 'success',
  Converted: 'default',
  Rejected: 'destructive',
  Active: 'success',
  Inactive: 'secondary',
};

const STATUS_LABELS = {
  New: 'নতুন',
  'In Progress': 'চলমান',
  Ready: 'প্রস্তুত',
  Delivered: 'ডেলিভারি',
  Cancelled: 'বাতিল',
  Draft: 'ড্রাফট',
  Sent: 'পাঠানো',
  Accepted: 'গৃহীত',
  Converted: 'অর্ডার হয়েছে',
  Rejected: 'বাতিল',
  Active: 'সক্রিয়',
  Inactive: 'নিষ্ক্রিয়',
};

export const StatusBadge = ({ status }) => (
  <Badge variant={STATUS_STYLES[status] || 'secondary'}>{STATUS_LABELS[status] || status}</Badge>
);

export const ORDER_STATUSES = ['New', 'In Progress', 'Ready', 'Delivered', 'Cancelled'];
export const ORDER_TYPES = ['Thai Glass', 'Aluminium', 'SS', 'Mixed', 'Other'];
export const PAYMENT_METHODS = ['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank', 'Other'];
export const UNITS = ['Pcs', 'ft', 'Sqft', 'Rft', 'kg', 'Set', 'Tube', 'Roll', 'Packet'];
export { STATUS_LABELS };

/** Responsive list: a real table on desktop, stacked cards on phones. */
export function DataTable({ columns, rows, empty, onRowClick, footer, mobileCard }) {
  if (!rows.length) return empty || null;
  return (
    <>
      <div className="table-wrap hidden sm:block">
        <table className="data-table">
          <thead>
            <tr>{columns.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>{c.label}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot className="border-t bg-muted/40 font-semibold">{footer}</tfoot>}
        </table>
      </div>

      <div className="space-y-2 sm:hidden">
        {rows.map((row, i) => (
          <Card
            key={row.id || i}
            className={cn('p-3', onRowClick && 'cursor-pointer active:bg-muted/50')}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {mobileCard ? mobileCard(row) : (
              <dl className="space-y-1 text-sm">
                {columns.map((c) => (
                  <div key={c.key} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{c.label}</dt>
                    <dd className="text-right font-medium">{c.render ? c.render(row) : row[c.key]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}

/** Label/value row used across detail screens. */
export const InfoRow = ({ label, value, className }) => (
  <div className={cn('flex items-start justify-between gap-3 py-1.5 text-sm', className)}>
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value ?? '—'}</span>
  </div>
);

// Re-exported so pages can pull layout and feedback pieces from one place.
export { EmptyState, Loading, ErrorState } from '@/components/ui';
export { PrintDoc, PrintTable, PrintTotals } from './PrintDoc';
export { StaffSelect } from './StaffSelect';
export { PaymentDialog } from './PaymentDialog';
export { CategorySelect } from './CategorySelect';

/** প্রিন্ট button for list screens — the page itself is the paper. */
export const PrintButton = ({ label = 'প্রিন্ট' }) => (
  <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}>
    <Printer className="h-4 w-4" /> {label}
  </Button>
);
