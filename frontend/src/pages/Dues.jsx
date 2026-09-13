import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, Phone } from 'lucide-react';
import { Reports } from '@/api/entities';
import { Button, Input, Loading, ErrorState, EmptyState } from '@/components/ui';
import {
  PageHeader, SearchInput, DataTable, StatCard, PrintDoc, PrintTable,
} from '@/components/shared';
import { bnDate, downloadCsv, isoDate, money, monthStart } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

/**
 * বাকি খাতা — কাস্টমারভিত্তিক বাকির তালিকা।
 * বাকি = পূর্বের বাকি + সব বিল − সব জমা। উপরে সর্বমোট বাকি ও এই মাসের হিসাব।
 */
export default function Dues() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [range, setRange] = useState({ from: monthStart(), to: isoDate() });
  const [search, setSearch] = useState('');
  const [onlyOwing, setOnlyOwing] = useState(true);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['due-ledger', range],
    queryFn: () => Reports.dueLedger(range),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.rows.filter((r) => (!onlyOwing || r.due > 0)
      && (!term || [r.name, r.mobile, r.village, r.code].some((v) => String(v || '').toLowerCase().includes(term))));
  }, [data, search, onlyOwing]);

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { totals } = data;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="বাকি খাতা"
          subtitle={`${totals.customers_owing} জন কাস্টমারের কাছে বাকি`}
          print
          actions={
            <Button
              variant="outline" size="sm"
              onClick={() => downloadCsv('due-ledger', rows, [
                { key: 'name', label: 'Customer' },
                { key: 'mobile', label: 'Mobile' },
                { key: 'opening_due', label: 'Opening due' },
                { key: 'billed', label: 'Billed' },
                { key: 'paid', label: 'Paid' },
                { key: 'due', label: 'Due' },
                { key: 'period_billed', label: 'Period billed' },
                { key: 'period_paid', label: 'Period paid' },
              ])}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
          }
        />

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="সর্বমোট বাকি" value={totals.due} currency={currency} tone="danger" icon={AlertCircle} />
          <StatCard label="এই সময়ে নতুন বিল" value={totals.period_billed} currency={currency} tone="primary" />
          <StatCard label="এই সময়ে জমা" value={totals.period_paid} currency={currency} tone="success" />
          <StatCard
            label="এই সময়ের মেমোতে বাকি হয়েছে" value={totals.period_order_due} currency={currency} tone="accent"
            hint={totals.advance > 0 ? `অগ্রিম জমা আছে ${money(totals.advance, currency)}` : undefined}
          />
        </div>

        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput value={search} onChange={setSearch} placeholder="নাম, মোবাইল বা গ্রাম…" />
          <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          <Button variant={onlyOwing ? 'default' : 'outline'} onClick={() => setOnlyOwing((v) => !v)}>
            {onlyOwing ? 'শুধু যাদের বাকি আছে' : 'সব কাস্টমার দেখাচ্ছে'}
          </Button>
        </div>

        <DataTable
          columns={[
            { key: 'name', label: 'কাস্টমার', render: (r) => (
              <span>
                <span className="font-semibold text-primary">{r.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {[r.code, r.village, r.branch_name].filter(Boolean).join(' · ')}
                </span>
              </span>
            ) },
            { key: 'mobile', label: 'মোবাইল', render: (r) => (r.mobile ? (
              <a href={`tel:${r.mobile}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                <Phone className="h-3.5 w-3.5" /> {r.mobile}
              </a>
            ) : '—') },
            { key: 'billed', label: 'মোট বিল', align: 'right', render: (r) => money(r.billed + r.opening_due, currency) },
            { key: 'paid', label: 'মোট জমা', align: 'right', render: (r) => (
              <span className="num text-emerald-700">{money(r.paid, currency)}</span>
            ) },
            { key: 'period', label: 'এই সময়ে বিল / জমা', align: 'right', render: (r) => (
              <span className="num text-xs">{money(r.period_billed, currency)} / {money(r.period_paid, currency)}</span>
            ) },
            { key: 'last_payment', label: 'শেষ জমা', render: (r) => (r.last_payment ? bnDate(r.last_payment) : '—') },
            { key: 'due', label: 'বাকি', align: 'right', render: (r) => (
              <span className={`num font-bold ${r.due > 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                {r.due < 0 ? `অগ্রিম ${money(-r.due, currency)}` : money(r.due, currency)}
              </span>
            ) },
          ]}
          rows={rows}
          onRowClick={(r) => navigate(`/customers/${r.id}`)}
          footer={rows.length > 0 && (
            <tr>
              <td className="px-3 py-2.5" colSpan={6}>সর্বমোট ({rows.length} জন)</td>
              <td className="num px-3 py-2.5 text-right text-destructive">
                {money(rows.reduce((a, r) => a + Math.max(r.due, 0), 0), currency)}
              </td>
            </tr>
          )}
          empty={<EmptyState icon={AlertCircle} title="কোনো বাকি নেই" />}
          mobileCard={(r) => (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-primary">{r.name}</p>
                <p className="text-xs text-muted-foreground">{[r.mobile, r.village].filter(Boolean).join(' · ')}</p>
              </div>
              <span className="num font-bold text-destructive">{money(r.due, currency)}</span>
            </div>
          )}
        />
      </div>

      {/* Printed বাকি তালিকা. */}
      <div className="print-only">
        <PrintDoc
          title="কাস্টমার বাকি তালিকা"
          copyLabel="অফিস কপি"
          meta={[['তারিখ', bnDate(isoDate())], ['মোট বাকি', money(totals.due, currency)]]}
          signatures={['হিসাবরক্ষক', 'মালিকের স্বাক্ষর']}
          footerNote=""
        >
          <PrintTable
            head={[
              { label: 'ক্র.', width: '36px', align: 'center' },
              { label: 'কাস্টমার' },
              { label: 'মোবাইল', width: '110px' },
              { label: 'মোট বিল', align: 'right', width: '100px' },
              { label: 'জমা', align: 'right', width: '100px' },
              { label: 'বাকি', align: 'right', width: '100px' },
            ]}
          >
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="num" style={{ textAlign: 'center' }}>{i + 1}</td>
                <td>{r.name}{r.village ? ` (${r.village})` : ''}</td>
                <td>{r.mobile || '—'}</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(r.billed + r.opening_due, currency)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(r.paid, currency)}</td>
                <td className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{money(r.due, currency)}</td>
              </tr>
            ))}
          </PrintTable>
        </PrintDoc>
      </div>
    </div>
  );
}
