import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Download, Trash2, Pencil } from 'lucide-react';
import { Expense } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Select, Input, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard } from '@/components/shared';
import { bnDate, downloadCsv, isoDate, money, monthStart, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function Expenses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency, expenseCategories } = useSettings();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [range, setRange] = useState({ from: monthStart(), to: isoDate() });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: expenses = [], isLoading, error, refetch } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => Expense.filter({ archived: false }, '-date', 1000),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return expenses.filter((x) => {
      if (category && x.category !== category) return false;
      if (range.from && x.date < range.from) return false;
      if (range.to && x.date > range.to) return false;
      if (!term) return true;
      return [x.category, x.description, x.person]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [expenses, search, category, range]);

  const categories = useMemo(() => {
    const set = new Set([...expenseCategories, ...expenses.map((x) => x.category)]);
    return [...set].filter(Boolean);
  }, [expenseCategories, expenses]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="খরচ"
        print
        subtitle={`${filtered.length} টি এন্ট্রি`}
        actions={
          <>
            <Button
              variant="outline" size="sm"
              onClick={() => downloadCsv('expenses', filtered, [
                { key: 'date', label: 'Date' },
                { key: 'category', label: 'Category' },
                { key: 'description', label: 'Description' },
                { key: 'person', label: 'Person' },
                { key: 'method', label: 'Method' },
                { key: 'amount', label: 'Amount' },
              ])}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/settings?tab=categories')}>
              <Pencil className="h-4 w-4" /> খরচের খাত যোগ / সম্পাদনা
            </Button>
            <Button size="sm" onClick={() => navigate('/expenses/new')}>
              <Plus className="h-4 w-4" /> নতুন খরচ
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="মোট খরচ" value={sum(filtered, 'amount')} currency={currency} tone="danger" icon={Receipt} />
        <StatCard label="এন্ট্রি" value={filtered.length} currency={false} tone="info" />
        <StatCard
          label="সর্বোচ্চ খাত"
          value={(() => {
            const byCat = {};
            filtered.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + Number(x.amount); });
            const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
            return top ? top[0] : '—';
          })()}
          currency={false}
          tone="accent"
        />
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SearchInput value={search} onChange={setSearch} placeholder="খাত, বিবরণ বা ব্যক্তি…" />
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">সব খাত</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
      </div>

      <DataTable
        columns={[
          { key: 'date', label: 'তারিখ', render: (x) => bnDate(x.date) },
          { key: 'category', label: 'খাত', render: (x) => <span className="font-medium">{x.category}</span> },
          { key: 'description', label: 'বিবরণ', render: (x) => x.description || '—' },
          { key: 'person', label: 'ব্যক্তি', render: (x) => x.person || '—' },
          { key: 'method', label: 'মাধ্যম' },
          { key: 'amount', label: 'পরিমাণ', align: 'right', render: (x) => (
            <span className="num font-semibold text-destructive">{money(x.amount, currency)}</span>
          ) },
          { key: 'actions', label: '', align: 'right', render: (x) => (
            <Button
              variant="ghost" size="icon"
              onClick={(e) => { e.stopPropagation(); setDeleteTarget(x); }}
              aria-label="মুছুন"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          ) },
        ]}
        rows={filtered}
        onRowClick={(x) => navigate(`/expenses/${x.id}/edit`)}
        empty={
          <EmptyState
            icon={Receipt}
            title="কোনো খরচ নেই"
            description="এই সময়ের মধ্যে কোনো খরচ পাওয়া যায়নি।"
            action={<Link to="/expenses/new"><Button size="sm"><Plus className="h-4 w-4" /> নতুন খরচ</Button></Link>}
          />
        }
        mobileCard={(x) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{x.category}</span>
              <span className="num font-semibold text-destructive">{money(x.amount, currency)}</span>
            </div>
            {x.description && <p className="text-sm">{x.description}</p>}
            <p className="text-xs text-muted-foreground">
              {[bnDate(x.date), x.method, x.person].filter(Boolean).join(' · ')}
            </p>
          </div>
        )}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="খরচ মুছবেন?"
        message={`${deleteTarget?.category} — ${money(deleteTarget?.amount, currency)}`}
        onConfirm={async () => {
          await Expense.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['expenses'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          toast({ title: 'খরচ মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}
