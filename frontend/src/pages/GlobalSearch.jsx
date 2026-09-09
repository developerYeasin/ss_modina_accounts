import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, Users, ClipboardList, Truck } from 'lucide-react';
import { Search } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle, Loading, EmptyState } from '@/components/ui';
import { PageHeader, SearchInput, DataTable, StatusBadge } from '@/components/shared';
import { bnDate, money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');
  const [debounced, setDebounced] = useState(term);

  // Debounce so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term);
      const next = new URLSearchParams();
      if (term) next.set('q', term);
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [term, setParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => Search.global(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const empty = data
    && !data.customers.length && !data.orders.length && !data.suppliers.length;

  return (
    <div>
      <PageHeader title="খুঁজুন" subtitle="কাস্টমার, অর্ডার ও সরবরাহকারী" />

      <SearchInput
        value={term}
        onChange={setTerm}
        placeholder="নাম, মোবাইল, অর্ডার নং…"
        className="mb-4"
      />

      {debounced.trim().length < 2 ? (
        <EmptyState
          icon={SearchIcon}
          title="খুঁজতে শুরু করুন"
          description="অন্তত ২ অক্ষর লিখুন।"
        />
      ) : isLoading ? <Loading /> : empty ? (
        <EmptyState icon={SearchIcon} title="কিছু পাওয়া যায়নি" description={`"${debounced}" এর জন্য কোনো ফল নেই।`} />
      ) : (
        <div className="space-y-4">
          {data.customers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> কাস্টমার ({data.customers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'name', label: 'নাম', render: (c) => <span className="font-medium">{c.name}</span> },
                    { key: 'mobile', label: 'মোবাইল', render: (c) => c.mobile || '—' },
                    { key: 'village', label: 'গ্রাম', render: (c) => c.village || c.area || '—' },
                    { key: 'customer_id', label: 'আইডি', render: (c) => c.customer_id || '—' },
                  ]}
                  rows={data.customers}
                  onRowClick={(c) => navigate(`/customers/${c.id}`)}
                />
              </CardContent>
            </Card>
          )}

          {data.orders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> অর্ডার ({data.orders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'order_number', label: 'নং', render: (o) => (
                      <span className="font-medium">{o.order_number}</span>
                    ) },
                    { key: 'customer_name', label: 'কাস্টমার' },
                    { key: 'order_date', label: 'তারিখ', render: (o) => bnDate(o.order_date) },
                    { key: 'total_selling', label: 'মোট', align: 'right', render: (o) => (
                      <span className="num">{money(o.total_selling, currency)}</span>
                    ) },
                    { key: 'status', label: '', render: (o) => <StatusBadge status={o.status} /> },
                  ]}
                  rows={data.orders}
                  onRowClick={(o) => navigate(`/orders/${o.id}`)}
                />
              </CardContent>
            </Card>
          )}

          {data.suppliers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-4 w-4" /> সরবরাহকারী ({data.suppliers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'name', label: 'নাম', render: (s) => <span className="font-medium">{s.name}</span> },
                    { key: 'mobile', label: 'মোবাইল', render: (s) => s.mobile || '—' },
                    { key: 'business', label: 'ব্যবসা', render: (s) => s.business || '—' },
                  ]}
                  rows={data.suppliers}
                  onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
