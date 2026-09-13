import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Printer, ArrowRightLeft, Trash2, Pencil } from 'lucide-react';
import { Quotation, Quotations as QuotationsApi } from '@/api/entities';
import {
  Button, Loading, ErrorState, EmptyState, Select, ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { PageHeader, SearchInput, DataTable, StatCard, StatusBadge } from '@/components/shared';
import { bnDate, money, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Converted'];

export default function Quotations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currency } = useSettings();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [convertTarget, setConvertTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: quotations = [], isLoading, error, refetch } = useQuery({
    queryKey: ['quotations'], queryFn: () => Quotation.list('-created_date', 500),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotations.filter((q) => {
      if (status && q.status !== status) return false;
      if (!term) return true;
      return [q.quote_number, q.customer_name, q.customer_mobile]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [quotations, search, status]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="কোটেশন"
        print
        subtitle={`${filtered.length} টি কোটেশন`}
        actions={
          <Button size="sm" onClick={() => navigate('/quotations/new')}>
            <Plus className="h-4 w-4" /> নতুন কোটেশন
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট কোটেশন" value={filtered.length} currency={false} tone="primary" icon={FileText} />
        <StatCard label="মোট মূল্য" value={sum(filtered, 'total')} currency={currency} tone="info" />
        <StatCard
          label="গৃহীত"
          value={filtered.filter((q) => q.status === 'Accepted').length}
          currency={false} tone="success"
        />
        <StatCard
          label="অর্ডার হয়েছে"
          value={filtered.filter((q) => q.status === 'Converted').length}
          currency={false} tone="accent"
        />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="কোটেশন নং বা কাস্টমার…" className="flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48">
          <option value="">সব অবস্থা</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      <DataTable
        columns={[
          { key: 'quote_number', label: 'নং', render: (q) => (
            <span className="font-medium">{q.quote_number}</span>
          ) },
          { key: 'customer_name', label: 'কাস্টমার', render: (q) => q.customer_name || '—' },
          { key: 'date', label: 'তারিখ', render: (q) => bnDate(q.date) },
          { key: 'valid_until', label: 'মেয়াদ', render: (q) => q.valid_until ? bnDate(q.valid_until) : '—' },
          { key: 'total', label: 'মোট', align: 'right', render: (q) => (
            <span className="num font-medium">{money(q.total, currency)}</span>
          ) },
          { key: 'status', label: 'অবস্থা', render: (q) => <StatusBadge status={q.status} /> },
          { key: 'actions', label: '', align: 'right', render: (q) => (
            <span className="flex justify-end gap-1">
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${q.id}/invoice`); }}
                aria-label="প্রিন্ট"
              >
                <Printer className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); navigate(`/quotations/${q.id}/edit`); }}
                aria-label="সম্পাদনা"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {q.status !== 'Converted' && (
                <Button
                  variant="ghost" size="icon"
                  onClick={(e) => { e.stopPropagation(); setConvertTarget(q); }}
                  aria-label="অর্ডারে রূপান্তর"
                >
                  <ArrowRightLeft className="h-4 w-4 text-primary" />
                </Button>
              )}
              <Button
                variant="ghost" size="icon"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(q); }}
                aria-label="মুছুন"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </span>
          ) },
        ]}
        rows={filtered}
        onRowClick={(q) => navigate(`/quotations/${q.id}/invoice`)}
        empty={
          <EmptyState
            icon={FileText}
            title="কোনো কোটেশন নেই"
            description="কাস্টমারকে দর জানাতে কোটেশন তৈরি করুন।"
            action={<Button size="sm" onClick={() => navigate('/quotations/new')}><Plus className="h-4 w-4" /> নতুন কোটেশন</Button>}
          />
        }
      />

      <ConfirmDialog
        open={Boolean(convertTarget)}
        onClose={() => setConvertTarget(null)}
        title="অর্ডারে রূপান্তর করবেন?"
        confirmLabel="রূপান্তর করুন"
        message={`${convertTarget?.quote_number} থেকে নতুন অর্ডার তৈরি হবে।`}
        onConfirm={async () => {
          const order = await QuotationsApi.convert(convertTarget.id);
          queryClient.invalidateQueries({ queryKey: ['quotations'] });
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          toast({ title: `অর্ডার তৈরি হয়েছে: ${order.order_number}` });
          navigate(`/orders/${order.id}`);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="কোটেশন মুছবেন?"
        message={deleteTarget?.quote_number}
        onConfirm={async () => {
          await Quotation.delete(deleteTarget.id);
          queryClient.invalidateQueries({ queryKey: ['quotations'] });
          toast({ title: 'মুছে ফেলা হয়েছে' });
        }}
      />
    </div>
  );
}
