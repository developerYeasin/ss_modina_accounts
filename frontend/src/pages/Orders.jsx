import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, ClipboardList, Download } from 'lucide-react';
import { Order } from '@/api/entities';
import { Button, Loading, ErrorState, EmptyState, Select, Tabs } from '@/components/ui';
import {
  PageHeader, SearchInput, DataTable, StatusBadge, ORDER_STATUSES, StatCard,
} from '@/components/shared';
import { bnDate, money, downloadCsv, sum } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function Orders() {
  const navigate = useNavigate();
  const { currency, branches } = useSettings();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');

  const status = params.get('status') || 'all';
  const setStatus = (value) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('status');
    else next.set('status', value);
    setParams(next, { replace: true });
  };

  const { data: orders = [], isLoading, error, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => Order.filter({ archived: false }, '-created_date', 1000),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== 'all' && o.status !== status) return false;
      if (branch && o.branch_id !== branch) return false;
      if (!term) return true;
      return [o.order_number, o.customer_name, o.customer_mobile, o.description]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [orders, search, status, branch]);

  const tabs = useMemo(() => [
    { value: 'all', label: 'সব', count: orders.length },
    ...ORDER_STATUSES.map((s) => ({
      value: s, label: s, count: orders.filter((o) => o.status === s).length,
    })),
  ], [orders]);

  const columns = [
    { key: 'order_number', label: 'অর্ডার নং', render: (o) => (
      <span className="font-medium">{o.order_number}</span>
    ) },
    { key: 'customer_name', label: 'কাস্টমার', render: (o) => (
      <div>
        <p className="font-medium">{o.customer_name}</p>
        <p className="text-xs text-muted-foreground">{o.customer_mobile}</p>
      </div>
    ) },
    { key: 'order_date', label: 'তারিখ', render: (o) => bnDate(o.order_date) },
    { key: 'order_type', label: 'ধরন' },
    { key: 'total_selling', label: 'মোট', align: 'right', render: (o) => (
      <span className="num">{money(o.total_selling, currency)}</span>
    ) },
    { key: 'due', label: 'বাকি', align: 'right', render: (o) => (
      <span className={o.due > 0 ? 'num font-semibold text-destructive' : 'num'}>
        {money(o.due, currency)}
      </span>
    ) },
    { key: 'status', label: 'অবস্থা', render: (o) => <StatusBadge status={o.status} /> },
  ];

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="অর্ডার"
        print
        subtitle={`${filtered.length} টি অর্ডার`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv('orders', filtered, [
                { key: 'order_number', label: 'Order' },
                { key: 'customer_name', label: 'Customer' },
                { key: 'customer_mobile', label: 'Mobile' },
                { key: 'order_date', label: 'Date' },
                { key: 'order_type', label: 'Type' },
                { key: 'total_selling', label: 'Total' },
                { key: 'total_paid', label: 'Paid' },
                { key: 'due', label: 'Due' },
                { key: 'status', label: 'Status' },
              ])}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => navigate('/orders/new')}>
              <Plus className="h-4 w-4" /> নতুন অর্ডার
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট বিক্রি" value={sum(filtered, 'total_selling')} currency={currency} tone="primary" />
        <StatCard label="আদায়" value={sum(filtered, 'total_paid')} currency={currency} tone="success" />
        <StatCard label="বাকি" value={sum(filtered, 'due')} currency={currency} tone="danger" />
        <StatCard label="অর্ডার সংখ্যা" value={filtered.length} currency={false} tone="accent" />
      </div>

      <div className="mb-3 space-y-3">
        <Tabs tabs={tabs} value={status} onChange={setStatus} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="অর্ডার নং, কাস্টমার বা মোবাইল…"
            className="flex-1"
          />
          {branches.length > 1 && (
            <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="sm:w-56">
              <option value="">সব শাখা</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        onRowClick={(o) => navigate(`/orders/${o.id}`)}
        empty={
          <EmptyState
            icon={ClipboardList}
            title="কোনো অর্ডার নেই"
            description="নতুন অর্ডার যোগ করে শুরু করুন।"
            action={<Link to="/orders/new"><Button size="sm"><Plus className="h-4 w-4" /> নতুন অর্ডার</Button></Link>}
          />
        }
        mobileCard={(o) => (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{o.order_number}</span>
              <StatusBadge status={o.status} />
            </div>
            <p className="text-sm">{o.customer_name}</p>
            <p className="text-xs text-muted-foreground">
              {bnDate(o.order_date)} · {o.order_type}
            </p>
            <div className="flex justify-between border-t pt-1.5 text-sm">
              <span className="num">{money(o.total_selling, currency)}</span>
              {o.due > 0 && (
                <span className="num font-semibold text-destructive">বাকি {money(o.due, currency)}</span>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
}
