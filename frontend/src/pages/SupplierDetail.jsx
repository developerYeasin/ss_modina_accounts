import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, Download } from 'lucide-react';
import { Suppliers } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Loading, ErrorState,
} from '@/components/ui';
import { PageHeader, InfoRow, DataTable, StatCard } from '@/components/shared';
import { bnDate, downloadCsv, money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function SupplierDetail() {
  const { id } = useParams();
  const { currency } = useSettings();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['supplier-detail', id],
    queryFn: () => Suppliers.detail(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { supplier, purchases, summary } = data;

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle={supplier.business || undefined}
        back="/suppliers"
        actions={
          <Button
            variant="outline" size="sm"
            onClick={() => downloadCsv(`purchases-${supplier.name}`, purchases, [
              { key: 'date', label: 'Date' },
              { key: 'material', label: 'Material' },
              { key: 'quantity', label: 'Qty' },
              { key: 'unit_cost', label: 'Unit cost' },
              { key: 'total_cost', label: 'Total' },
              { key: 'paid', label: 'Paid' },
              { key: 'due', label: 'Due' },
            ])}
          >
            <Download className="h-4 w-4" /> CSV
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট ক্রয়" value={summary.purchases} currency={false} tone="info" />
        <StatCard label="মোট টাকা" value={summary.total} currency={currency} tone="primary" />
        <StatCard label="পরিশোধ" value={summary.paid} currency={currency} tone="success" />
        <StatCard label="বাকি" value={summary.due} currency={currency} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>তথ্য</CardTitle></CardHeader>
          <CardContent className="divide-y">
            <InfoRow
              label="মোবাইল"
              value={supplier.mobile ? (
                <a href={`tel:${supplier.mobile}`} className="flex items-center gap-1.5 text-primary">
                  <Phone className="h-3.5 w-3.5" /> {supplier.mobile}
                </a>
              ) : '—'}
            />
            <InfoRow label="ব্যবসা" value={supplier.business || '—'} />
            <InfoRow label="ঠিকানা" value={supplier.address || '—'} />
            <InfoRow label="ম্যাটেরিয়াল" value={supplier.materials_supplied || '—'} />
            {supplier.notes && <InfoRow label="নোট" value={supplier.notes} />}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>ক্রয়ের তালিকা ({purchases.length})</CardTitle></CardHeader>
          <CardContent>
            <DataTable
              columns={[
                { key: 'date', label: 'তারিখ', render: (p) => bnDate(p.date) },
                { key: 'material', label: 'ম্যাটেরিয়াল', render: (p) => (
                  <span className="font-medium">{p.material || '—'}</span>
                ) },
                { key: 'quantity', label: 'পরিমাণ', align: 'right', render: (p) => `${p.quantity} ${p.unit}` },
                { key: 'total_cost', label: 'মোট', align: 'right', render: (p) => (
                  <span className="num">{money(p.total_cost, currency)}</span>
                ) },
                { key: 'paid', label: 'পরিশোধ', align: 'right', render: (p) => (
                  <span className="num text-emerald-700">{money(p.paid, currency)}</span>
                ) },
                { key: 'due', label: 'বাকি', align: 'right', render: (p) => (
                  <span className={p.due > 0 ? 'num text-destructive' : 'num'}>
                    {money(p.due, currency)}
                  </span>
                ) },
              ]}
              rows={purchases}
              empty={<p className="py-4 text-sm text-muted-foreground">কোনো ক্রয় নেই</p>}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
