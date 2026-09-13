import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, ChevronRight } from 'lucide-react';
import { Reports } from '@/api/entities';
import {
  Card, CardContent, CardHeader, CardTitle, Loading, ErrorState, Select, Field,
} from '@/components/ui';
import { PageHeader, StatCard, DataTable } from '@/components/shared';
import { BN_MONTH_NAMES, bnDate, money, toBnDigits } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

/**
 * বিক্রয় — মাসভিত্তিক মোট বিক্রি (মেমো/অর্ডার + স্টক থেকে নগদ বিক্রি), আদায় ও
 * নগদ আদায়। একটি মাসে ক্লিক করলে দিনভিত্তিক হিসাব।
 */
export default function Sales() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['sales-report', year, month],
    queryFn: () => Reports.sales({ year, month }),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const current = data.months[month - 1];
  // Show months up to today in the current year; the whole year otherwise.
  const lastMonth = year === now.getFullYear() ? now.getMonth() + 1 : 12;
  const months = data.months.slice(0, lastMonth).reverse();
  const chart = data.months.slice(0, lastMonth).map((m) => ({
    name: BN_MONTH_NAMES[m.month - 1],
    'মেমো বিক্রি': m.order_sales,
    'স্টক বিক্রি': m.stock_sales,
  }));

  return (
    <div>
      <PageHeader
        title="বিক্রয়"
        subtitle="মাসভিত্তিক মোট বিক্রির হিসাব"
        print
        actions={
          <div className="w-32">
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>{toBnDigits(y)}</option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`${toBnDigits(year)} সালের মোট বিক্রি`} value={data.totals.total_sales} currency={currency} tone="primary" icon={TrendingUp} />
        <StatCard label={`${BN_MONTH_NAMES[month - 1]} মাসের বিক্রি`} value={current.total_sales} currency={currency} tone="success" hint={`${current.orders} টি মেমো`} />
        <StatCard label={`${BN_MONTH_NAMES[month - 1]} মাসে আদায়`} value={current.collected} currency={currency} tone="info" hint={`নগদ ${money(current.cash, currency)}`} />
        <StatCard label={`${BN_MONTH_NAMES[month - 1]} মাসের মেমোতে বাকি`} value={current.due} currency={currency} tone="danger" />
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>মাসভিত্তিক বিক্রি</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => money(v, currency)} />
                <Legend />
                <Bar dataKey="মেমো বিক্রি" stackId="a" fill="hsl(var(--chart-1))" />
                <Bar dataKey="স্টক বিক্রি" stackId="a" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>প্রতি মাসের হিসাব</CardTitle>
          <p className="text-sm text-muted-foreground">মাসের সারিতে ক্লিক করলে নিচে দিনভিত্তিক হিসাব দেখাবে</p>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'month', label: 'মাস', render: (m) => (
                <span className={`inline-flex items-center gap-1 font-semibold ${m.month === month ? 'text-primary' : ''}`}>
                  {BN_MONTH_NAMES[m.month - 1]} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              ) },
              { key: 'orders', label: 'মেমো', align: 'right' },
              { key: 'order_sales', label: 'মেমো বিক্রি', align: 'right', render: (m) => money(m.order_sales, currency) },
              { key: 'stock_sales', label: 'স্টক থেকে নগদ বিক্রি', align: 'right', render: (m) => money(m.stock_sales, currency) },
              { key: 'total_sales', label: 'মোট বিক্রি', align: 'right', render: (m) => (
                <span className="num font-bold text-primary">{money(m.total_sales, currency)}</span>
              ) },
              { key: 'collected', label: 'আদায়', align: 'right', render: (m) => (
                <span className="num text-emerald-700">{money(m.collected, currency)}</span>
              ) },
              { key: 'due', label: 'বাকি', align: 'right', render: (m) => (
                <span className="num text-destructive">{money(m.due, currency)}</span>
              ) },
            ]}
            rows={months}
            onRowClick={(m) => setMonth(m.month)}
            footer={(
              <tr>
                <td className="px-3 py-2.5">সর্বমোট</td>
                <td className="px-3 py-2.5 text-right">{data.totals.orders}</td>
                <td className="num px-3 py-2.5 text-right">{money(data.totals.order_sales, currency)}</td>
                <td className="num px-3 py-2.5 text-right">{money(data.totals.stock_sales, currency)}</td>
                <td className="num px-3 py-2.5 text-right">{money(data.totals.total_sales, currency)}</td>
                <td className="num px-3 py-2.5 text-right">{money(data.totals.collected, currency)}</td>
                <td className="num px-3 py-2.5 text-right">{money(data.totals.due, currency)}</td>
              </tr>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>{BN_MONTH_NAMES[month - 1]} {toBnDigits(year)} — দিনভিত্তিক বিক্রি</CardTitle>
          <Field className="no-print w-40">
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {BN_MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </Field>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={[
              { key: 'date', label: 'তারিখ', render: (d) => <span className="font-medium">{bnDate(d.date)}</span> },
              { key: 'orders', label: 'মেমো', align: 'right' },
              { key: 'order_sales', label: 'মেমো বিক্রি', align: 'right', render: (d) => money(d.order_sales, currency) },
              { key: 'stock_sales', label: 'নগদ স্টক বিক্রি', align: 'right', render: (d) => money(d.stock_sales, currency) },
              { key: 'total_sales', label: 'মোট বিক্রি', align: 'right', render: (d) => (
                <span className="num font-bold">{money(d.total_sales, currency)}</span>
              ) },
              { key: 'cash', label: 'নগদ আদায়', align: 'right', render: (d) => (
                <span className="num text-emerald-700">{money(d.cash, currency)}</span>
              ) },
              { key: 'due', label: 'বাকি', align: 'right', render: (d) => (
                <span className="num text-destructive">{money(d.due, currency)}</span>
              ) },
            ]}
            rows={data.days}
            onRowClick={() => navigate('/accounts')}
            empty={<p className="py-4 text-sm text-muted-foreground">এই মাসে কোনো বিক্রি নেই</p>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
