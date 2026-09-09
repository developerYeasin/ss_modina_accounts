import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users, Download, Phone } from 'lucide-react';
import { Customer, Order } from '@/api/entities';
import { Button, Loading, ErrorState, EmptyState, Select } from '@/components/ui';
import { PageHeader, SearchInput, DataTable, StatCard } from '@/components/shared';
import { money, downloadCsv, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function Customers() {
  const navigate = useNavigate();
  const { currency, branches } = useSettings();
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('');

  const { data: customers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['customers'], queryFn: () => Customer.list('name', 1000),
  });
  const { data: orders = [] } = useQuery({
    queryKey: ['orders'], queryFn: () => Order.filter({ archived: false }, '-created_date', 1000),
  });

  /** Due and order count per customer, derived from the order rows. */
  const stats = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const cur = map.get(o.customer_id) || { orders: 0, billed: 0, due: 0 };
      cur.orders += 1;
      cur.billed += num(o.total_selling);
      cur.due += num(o.due);
      map.set(o.customer_id, cur);
    });
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (branch && c.branch_id !== branch) return false;
      if (!term) return true;
      return [c.name, c.mobile, c.alt_mobile, c.customer_id, c.village, c.area, c.address]
        .some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [customers, search, branch]);

  const totalDue = filtered.reduce((a, c) => a + (stats.get(c.id)?.due || 0), 0);

  const columns = [
    { key: 'customer_id', label: 'আইডি', render: (c) => (
      <span className="text-xs text-muted-foreground">{c.customer_id || '—'}</span>
    ) },
    { key: 'name', label: 'নাম', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'mobile', label: 'মোবাইল', render: (c) => c.mobile || '—' },
    { key: 'village', label: 'গ্রাম/এলাকা', render: (c) => c.village || c.area || '—' },
    { key: 'branch_name', label: 'শাখা', render: (c) => c.branch_name || '—' },
    { key: 'orders', label: 'অর্ডার', align: 'right', render: (c) => stats.get(c.id)?.orders || 0 },
    { key: 'due', label: 'বাকি', align: 'right', render: (c) => {
      const due = stats.get(c.id)?.due || 0;
      return (
        <span className={due > 0 ? 'num font-semibold text-destructive' : 'num text-muted-foreground'}>
          {money(due, currency)}
        </span>
      );
    } },
  ];

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="কাস্টমার"
        subtitle={`${filtered.length} জন`}
        actions={
          <>
            <Button
              variant="outline" size="sm"
              onClick={() => downloadCsv('customers', filtered, [
                { key: 'customer_id', label: 'ID' },
                { key: 'name', label: 'Name' },
                { key: 'mobile', label: 'Mobile' },
                { key: 'village', label: 'Village' },
                { key: 'branch_name', label: 'Branch' },
                { key: 'due', label: 'Due', format: (c) => stats.get(c.id)?.due || 0 },
              ])}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => navigate('/customers/new')}>
              <Plus className="h-4 w-4" /> নতুন কাস্টমার
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="মোট কাস্টমার" value={filtered.length} currency={false} tone="primary" icon={Users} />
        <StatCard label="মোট বাকি" value={totalDue} currency={currency} tone="danger" />
        <StatCard
          label="বাকিদার"
          value={filtered.filter((c) => (stats.get(c.id)?.due || 0) > 0).length}
          currency={false}
          tone="accent"
        />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          value={search} onChange={setSearch}
          placeholder="নাম, মোবাইল, আইডি বা গ্রাম…" className="flex-1"
        />
        {branches.length > 1 && (
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="sm:w-56">
            <option value="">সব শাখা</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        onRowClick={(c) => navigate(`/customers/${c.id}`)}
        empty={
          <EmptyState
            icon={Users}
            title="কোনো কাস্টমার নেই"
            description="নতুন কাস্টমার যোগ করে শুরু করুন।"
            action={<Link to="/customers/new"><Button size="sm"><Plus className="h-4 w-4" /> নতুন কাস্টমার</Button></Link>}
          />
        }
        mobileCard={(c) => {
          const due = stats.get(c.id)?.due || 0;
          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                {due > 0 && (
                  <span className="num text-sm font-semibold text-destructive">{money(due, currency)}</span>
                )}
              </div>
              {c.mobile && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {c.mobile}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {[c.customer_id, c.village || c.area, c.branch_name].filter(Boolean).join(' · ')}
              </p>
            </div>
          );
        }}
      />
    </div>
  );
}
