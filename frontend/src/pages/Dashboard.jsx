import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, Wallet, Receipt, AlertCircle, ShoppingBag, Users, Coins,
  UserPlus, FilePlus2, CalendarDays, ClipboardList, HandCoins, BarChart3,
} from 'lucide-react';
import { Reports } from '@/api/entities';
import { Card, Loading, ErrorState } from '@/components/ui';
import { StatCard, SectionTitle } from '@/components/shared';
import { bnDateWithDay, money } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const QUICK_ACTIONS = [
  { to: '/customers/new', label: 'নতুন কাস্টমার', icon: UserPlus },
  { to: '/orders/new', label: 'নতুন অর্ডার', icon: FilePlus2 },
  { to: '/accounts', label: 'দৈনিক হিসাব', icon: CalendarDays },
  { to: '/orders', label: 'অর্ডার দেখুন', icon: ClipboardList },
  { to: '/reports?tab=due', label: 'বাকি দেখুন', icon: HandCoins },
  { to: '/reports', label: 'রিপোর্ট', icon: BarChart3 },
];

const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Dashboard() {
  const { currency } = useSettings();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => Reports.dashboard(),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { today, month, totals, branch_sales: branchSales } = data;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold">ড্যাশবোর্ড</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{bnDateWithDay(data.date)}</p>
      </div>

      <SectionTitle>আজকের হিসাব</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="আজকের বিক্রি" value={today.sales} icon={TrendingUp} tone="primary" currency={currency} />
        <StatCard label="আজকের পেমেন্ট" value={today.payments} icon={Wallet} tone="success" currency={currency} />
        <StatCard label="আজকের খরচ" value={today.expenses} icon={Receipt} tone="danger" currency={currency} />
        <StatCard label="মোট বাকি" value={totals.due} icon={AlertCircle} tone="accent" currency={currency} to="/reports?tab=due" />
      </div>

      <SectionTitle>এই মাসের সারসংক্ষেপ</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="মাসিক বিক্রি" value={month.sales} icon={TrendingUp} tone="primary" currency={currency} />
        <StatCard label="মাসিক খরচ" value={month.expenses} icon={Receipt} tone="danger" currency={currency} />
        <StatCard label="মাসিক আদায়" value={month.payments} icon={Wallet} tone="success" currency={currency} />
      </div>

      <SectionTitle>সারসংক্ষেপ</SectionTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট অর্ডার" value={totals.orders} icon={ShoppingBag} tone="info" currency={false} to="/orders" />
        <StatCard label="মোট কাস্টমার" value={totals.customers} icon={Users} tone="primary" currency={false} to="/customers" />
        <StatCard label="ক্রয় বাকি" value={totals.purchase_due} icon={AlertCircle} tone="accent" currency={currency} to="/purchases" />
        <StatCard label="আজকের নগদ" value={today.cash} icon={Coins} tone="success" currency={currency} />
      </div>

      {branchSales.length > 0 && (
        <>
          <SectionTitle>শাখাভিত্তিক বিক্রি</SectionTitle>
          <Card className="p-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchSales} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="branch" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(v) => money(v, currency)}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      fontSize: 13,
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {branchSales.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      <SectionTitle>কুইক অ্যাকশন</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
          <Link key={to + label} to={to}>
            <Card className="flex flex-col items-center gap-2 p-4 text-center transition-shadow hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium leading-tight">{label}</span>
            </Card>
          </Link>
        ))}
      </div>

      {data.status_breakdown?.length > 0 && (
        <>
          <SectionTitle
            action={<Link to="/orders" className="text-sm font-medium text-primary hover:underline">সব দেখুন</Link>}
          >
            অর্ডারের অবস্থা
          </SectionTitle>
          <Card className="divide-y">
            {data.status_breakdown.map((s) => (
              <Link
                key={s.status}
                to={`/orders?status=${encodeURIComponent(s.status)}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
              >
                <span className="font-medium">{s.status}</span>
                <span className="flex items-center gap-4">
                  <span className="text-muted-foreground">{s.count} টি</span>
                  <span className="num font-semibold">{money(s.total, currency)}</span>
                </span>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
