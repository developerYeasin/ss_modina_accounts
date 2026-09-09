import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Download, Printer } from 'lucide-react';
import { Reports as ReportsApi } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Input, Select, Loading, ErrorState, Tabs,
} from '@/components/ui';
import { PageHeader, StatCard, DataTable } from '@/components/shared';
import { bnDate, downloadCsv, isoDate, money, monthStart } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const TABS = [
  { value: 'summary', label: 'সারসংক্ষেপ' },
  { value: 'sales', label: 'বিক্রি' },
  { value: 'expenses', label: 'খরচ' },
  { value: 'due', label: 'বাকি' },
  { value: 'customers', label: 'কাস্টমার' },
];

export default function Reports() {
  const navigate = useNavigate();
  const { currency, branches } = useSettings();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'summary';
  const setTab = (value) => {
    const next = new URLSearchParams(params);
    next.set('tab', value);
    setParams(next, { replace: true });
  };

  const [range, setRange] = useState({ from: monthStart(), to: isoDate(), branch_id: '' });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['report-range', range],
    queryFn: () => ReportsApi.range(range),
  });

  const dueQuery = useQuery({
    queryKey: ['report-due'],
    queryFn: () => ReportsApi.due(),
    enabled: tab === 'due',
  });

  const chartTooltip = {
    formatter: (v) => money(v, currency),
    contentStyle: { borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 13 },
  };

  return (
    <div>
      <PageHeader
        title="রিপোর্ট"
        subtitle={`${bnDate(range.from)} — ${bnDate(range.to)}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print">
            <Printer className="h-4 w-4" /> প্রিন্ট
          </Button>
        }
      />

      <Card className="mb-4 no-print">
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">শুরুর তারিখ</label>
            <Input
              type="date" value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">শেষ তারিখ</label>
            <Input
              type="date" value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">শাখা</label>
            <Select
              value={range.branch_id}
              onChange={(e) => setRange({ ...range, branch_id: e.target.value })}
            >
              <option value="">সব শাখা</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-4 no-print" />

      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="মোট বিক্রি" value={data.summary.sales} currency={currency} tone="primary" />
            <StatCard label="আদায়" value={data.summary.collected} currency={currency} tone="success" />
            <StatCard label="খরচ" value={data.summary.expenses} currency={currency} tone="danger" />
            <StatCard label="লাভ" value={data.summary.profit} currency={currency} tone="accent" />
          </div>

          {tab === 'summary' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>দিনভিত্তিক বিক্রি</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.by_day}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip {...chartTooltip} />
                      <Line
                        type="monotone" dataKey="sales" name="বিক্রি"
                        stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>ধরনভিত্তিক বিক্রি</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.by_type} dataKey="total" nameKey="order_type"
                        cx="50%" cy="50%" outerRadius={90} label
                      >
                        {data.by_type.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip {...chartTooltip} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>হিসাবের বিবরণ</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                    <Row label="মোট অর্ডার" value={`${data.summary.orders} টি`} />
                    <Row label="মোট বিক্রয়" value={money(data.summary.sales, currency)} />
                    <Row label="মোট ক্রয়মূল্য" value={money(data.summary.cost, currency)} />
                    <Row label="আনুমানিক লাভ" value={money(data.summary.profit, currency)} />
                    <Row label="আদায়কৃত" value={money(data.summary.collected, currency)} />
                    <Row label="মোট খরচ" value={money(data.summary.expenses, currency)} />
                    <Row label="বাকি" value={money(data.summary.due, currency)} />
                    <Row label="নিট নগদ" value={money(data.summary.net, currency)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {tab === 'sales' && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>দিনভিত্তিক বিক্রি</CardTitle>
                <Button
                  variant="outline" size="sm"
                  onClick={() => downloadCsv('sales-by-day', data.by_day)}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.by_day}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip {...chartTooltip} />
                      <Bar dataKey="sales" name="বিক্রি" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <DataTable
                  columns={[
                    { key: 'date', label: 'তারিখ', render: (r) => bnDate(r.date) },
                    { key: 'orders', label: 'অর্ডার', align: 'right' },
                    { key: 'sales', label: 'বিক্রি', align: 'right', render: (r) => (
                      <span className="num">{money(r.sales, currency)}</span>
                    ) },
                  ]}
                  rows={data.by_day}
                  empty={<p className="py-4 text-sm text-muted-foreground">এই সময়ে কোনো বিক্রি নেই</p>}
                />
              </CardContent>
            </Card>
          )}

          {tab === 'expenses' && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>খাতভিত্তিক খরচ</CardTitle>
                <Button
                  variant="outline" size="sm"
                  onClick={() => downloadCsv('expenses-by-category', data.expense_breakdown)}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.expense_breakdown} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip {...chartTooltip} />
                      <Bar dataKey="total" name="খরচ" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <DataTable
                  columns={[
                    { key: 'category', label: 'খাত' },
                    { key: 'total', label: 'পরিমাণ', align: 'right', render: (r) => (
                      <span className="num font-medium">{money(r.total, currency)}</span>
                    ) },
                  ]}
                  rows={data.expense_breakdown}
                  empty={<p className="py-4 text-sm text-muted-foreground">এই সময়ে কোনো খরচ নেই</p>}
                />
              </CardContent>
            </Card>
          )}

          {tab === 'due' && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>বাকির তালিকা</CardTitle>
                {dueQuery.data && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => downloadCsv('due-list', dueQuery.data)}
                  >
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {dueQuery.isLoading ? <Loading /> : (
                  <DataTable
                    columns={[
                      { key: 'customer_name', label: 'কাস্টমার', render: (r) => (
                        <span className="font-medium">{r.customer_name}</span>
                      ) },
                      { key: 'mobile', label: 'মোবাইল', render: (r) => r.mobile || '—' },
                      { key: 'village', label: 'গ্রাম', render: (r) => r.village || '—' },
                      { key: 'orders', label: 'অর্ডার', align: 'right' },
                      { key: 'last_order', label: 'শেষ অর্ডার', render: (r) => bnDate(r.last_order) },
                      { key: 'due', label: 'বাকি', align: 'right', render: (r) => (
                        <span className="num font-semibold text-destructive">{money(r.due, currency)}</span>
                      ) },
                    ]}
                    rows={dueQuery.data || []}
                    onRowClick={(r) => navigate(`/customers/${r.customer_id}`)}
                    empty={<p className="py-4 text-sm text-muted-foreground">কোনো বাকি নেই 🎉</p>}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'customers' && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>শীর্ষ কাস্টমার</CardTitle>
                <Button
                  variant="outline" size="sm"
                  onClick={() => downloadCsv('top-customers', data.top_customers)}
                >
                  <Download className="h-4 w-4" /> CSV
                </Button>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={[
                    { key: 'customer_name', label: 'কাস্টমার', render: (r) => (
                      <span className="font-medium">{r.customer_name}</span>
                    ) },
                    { key: 'orders', label: 'অর্ডার', align: 'right' },
                    { key: 'total', label: 'মোট', align: 'right', render: (r) => (
                      <span className="num">{money(r.total, currency)}</span>
                    ) },
                    { key: 'due', label: 'বাকি', align: 'right', render: (r) => (
                      <span className={r.due > 0 ? 'num text-destructive' : 'num'}>
                        {money(r.due, currency)}
                      </span>
                    ) },
                  ]}
                  rows={data.top_customers}
                  onRowClick={(r) => navigate(`/customers/${r.customer_id}`)}
                  empty={<p className="py-4 text-sm text-muted-foreground">তথ্য নেই</p>}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const Row = ({ label, value }) => (
  <div className="flex justify-between border-b py-1.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="num font-medium">{value}</span>
  </div>
);
