import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer, Plus } from 'lucide-react';
import { Reports } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Input, Loading, ErrorState,
} from '@/components/ui';
import { PageHeader, StatCard, DataTable, StatusBadge } from '@/components/shared';
import { bnDateWithDay, isoDate, money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function DailyReport() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [date, setDate] = useState(isoDate());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daily', date],
    queryFn: () => Reports.daily(date),
  });

  const shift = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(isoDate(d));
  };

  return (
    <div>
      <PageHeader
        title="দৈনিক রিপোর্ট"
        subtitle={bnDateWithDay(date)}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="আগের দিন">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="h-9 w-40"
            />
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="পরের দিন">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
              <Printer className="h-4 w-4" /> প্রিন্ট
            </Button>
          </>
        }
      />

      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="বিক্রি" value={data.summary.sales} currency={currency} tone="primary" />
            <StatCard label="আদায়" value={data.summary.collected} currency={currency} tone="success" />
            <StatCard label="খরচ" value={data.summary.expenses} currency={currency} tone="danger" />
            <StatCard label="ক্রয়" value={data.summary.purchases} currency={currency} tone="info" />
            <StatCard label="নতুন বাকি" value={data.summary.new_due} currency={currency} tone="accent" />
            <StatCard label="নিট নগদ" value={data.summary.net_cash} currency={currency} tone="success" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>অর্ডার ({data.orders.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate('/orders/new')}>
                  <Plus className="h-4 w-4" /> যোগ
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'order_number', label: 'নং' },
                    { key: 'customer_name', label: 'কাস্টমার' },
                    { key: 'total_selling', label: 'মোট', align: 'right', render: (o) => (
                      <span className="num">{money(o.total_selling, currency)}</span>
                    ) },
                    { key: 'status', label: '', render: (o) => <StatusBadge status={o.status} /> },
                  ]}
                  rows={data.orders}
                  onRowClick={(o) => navigate(`/orders/${o.id}`)}
                  empty={<p className="py-4 text-sm text-muted-foreground">এই দিনে কোনো অর্ডার নেই</p>}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>পেমেন্ট ({data.payments.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate('/payments/new')}>
                  <Plus className="h-4 w-4" /> যোগ
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'customer_name', label: 'কাস্টমার' },
                    { key: 'order_number', label: 'অর্ডার', render: (p) => p.order_number || '—' },
                    { key: 'method', label: 'মাধ্যম' },
                    { key: 'amount', label: 'পরিমাণ', align: 'right', render: (p) => (
                      <span className="num font-medium">{money(p.amount, currency)}</span>
                    ) },
                  ]}
                  rows={data.payments}
                  empty={<p className="py-4 text-sm text-muted-foreground">এই দিনে কোনো পেমেন্ট নেই</p>}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>খরচ ({data.expenses.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate('/expenses/new')}>
                  <Plus className="h-4 w-4" /> যোগ
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'category', label: 'খাত' },
                    { key: 'description', label: 'বিবরণ', render: (x) => x.description || '—' },
                    { key: 'person', label: 'ব্যক্তি', render: (x) => x.person || '—' },
                    { key: 'amount', label: 'পরিমাণ', align: 'right', render: (x) => (
                      <span className="num font-medium text-destructive">{money(x.amount, currency)}</span>
                    ) },
                  ]}
                  rows={data.expenses}
                  onRowClick={(x) => navigate(`/expenses/${x.id}/edit`)}
                  empty={<p className="py-4 text-sm text-muted-foreground">এই দিনে কোনো খরচ নেই</p>}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>ক্রয় ({data.purchases.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate('/purchases')}>
                  <Plus className="h-4 w-4" /> যোগ
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'material', label: 'ম্যাটেরিয়াল' },
                    { key: 'supplier_name', label: 'সরবরাহকারী', render: (p) => p.supplier_name || '—' },
                    { key: 'quantity', label: 'পরিমাণ', align: 'right', render: (p) => `${p.quantity} ${p.unit}` },
                    { key: 'total_cost', label: 'মোট', align: 'right', render: (p) => (
                      <span className="num font-medium">{money(p.total_cost, currency)}</span>
                    ) },
                  ]}
                  rows={data.purchases}
                  empty={<p className="py-4 text-sm text-muted-foreground">এই দিনে কোনো ক্রয় নেই</p>}
                />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
