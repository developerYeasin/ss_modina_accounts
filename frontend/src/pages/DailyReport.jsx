import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Printer, FileText } from 'lucide-react';
import { Reports } from '@/api/entities';
import {
  Button, Card, CardContent, CardHeader, CardTitle, Input, Loading, ErrorState,
} from '@/components/ui';
import {
  PageHeader, StatCard, DataTable, PrintDoc, PrintTable, PrintTotals,
} from '@/components/shared';
import { bnDateWithDay, isoDate, money, num } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

/**
 * Every cash movement of the day as one line, split the way the shop's খাতা is:
 * left page জমা (টাকা এলো), right page খরচ (টাকা গেল).
 */
function cashLines(data) {
  const income = [
    ...data.payments.map((p) => ({
      id: `p-${p.id}`, head: 'আদায়', label: p.customer_name || 'জমা',
      detail: [p.order_number, p.method !== 'Cash' && p.method].filter(Boolean).join(' · '),
      amount: num(p.amount), to: p.order_id ? `/orders/${p.order_id}` : null,
    })),
    ...data.owner_txns.filter((t) => t.flow === 'invest').map((t) => ({
      id: `o-${t.id}`, head: 'মালিকের বিনিয়োগ', label: t.owner_name || 'মালিক দিলেন',
      detail: t.notes, amount: num(t.amount), to: '/owner',
    })),
    ...data.bank_txns.filter((t) => t.flow === 'withdraw').map((t) => ({
      id: `b-${t.id}`, head: 'ব্যাংক থেকে উত্তোলন', label: t.account_name,
      detail: t.notes, amount: num(t.amount), to: '/bank',
    })),
    ...data.loan_txns.filter((t) => (t.loan_type === 'Borrowed') === (t.flow === 'increase')).map((t) => ({
      id: `l-${t.id}`, head: t.loan_type === 'Borrowed' ? 'ধার নেওয়া' : 'ধার ফেরত পেলাম',
      label: t.person_name, detail: t.notes, amount: num(t.amount), to: `/loans/${t.loan_id}`,
    })),
  ];

  const expense = [
    ...data.expenses.map((x) => ({
      id: `e-${x.id}`, head: x.category, label: x.description || x.category,
      detail: x.person, amount: num(x.amount), to: `/expenses/${x.id}/edit`,
    })),
    ...data.purchases.filter((p) => num(p.paid) > 0).map((p) => ({
      id: `pu-${p.id}`, head: 'ক্রয়ে পরিশোধ', label: p.supplier_name || p.material,
      detail: p.material, amount: num(p.paid), to: p.supplier_id ? `/suppliers/${p.supplier_id}` : '/purchases',
    })),
    ...data.supplier_payments.map((p) => ({
      id: `sp-${p.id}`, head: 'সরবরাহকারীকে পরিশোধ', label: p.supplier_name,
      detail: p.notes, amount: num(p.amount), to: `/suppliers/${p.supplier_id}`,
    })),
    ...data.owner_txns.filter((t) => t.flow === 'withdraw').map((t) => ({
      id: `o-${t.id}`, head: 'মালিক নিলেন', label: t.owner_name || 'মালিক',
      detail: t.notes, amount: num(t.amount), to: '/owner',
    })),
    ...data.bank_txns.filter((t) => t.flow === 'deposit').map((t) => ({
      id: `b-${t.id}`, head: 'ব্যাংকে জমা', label: t.account_name,
      detail: t.notes, amount: num(t.amount), to: '/bank',
    })),
    ...data.loan_txns.filter((t) => (t.loan_type === 'Lent') === (t.flow === 'increase')).map((t) => ({
      id: `l-${t.id}`, head: t.loan_type === 'Lent' ? 'ধার দেওয়া' : 'ধার পরিশোধ',
      label: t.person_name, detail: t.notes, amount: num(t.amount), to: `/loans/${t.loan_id}`,
    })),
  ];
  return { income, expense };
}

export default function DailyReport() {
  const navigate = useNavigate();
  const { currency } = useSettings();
  const [date, setDate] = useState(isoDate());
  const [sheet, setSheet] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daily', date],
    queryFn: () => Reports.daily(date),
  });

  const shift = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(isoDate(d));
  };

  const lines = data ? cashLines(data) : { income: [], expense: [] };
  const s = data?.summary;

  const lineColumns = (tone) => [
    { key: 'head', label: 'খাত', render: (l) => <span className="text-xs text-muted-foreground">{l.head}</span> },
    { key: 'label', label: 'বিবরণ', render: (l) => (
      <span>
        <span className="font-medium">{l.label}</span>
        {l.detail && <span className="block text-xs text-muted-foreground">{l.detail}</span>}
      </span>
    ) },
    { key: 'amount', label: 'টাকা', align: 'right', render: (l) => (
      <span className={`num font-semibold ${tone}`}>{money(l.amount, currency)}</span>
    ) },
  ];

  return (
    <div>
      <div className="no-print">
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
              <Button variant="outline" size="sm" onClick={() => setSheet((v) => !v)}>
                <FileText className="h-4 w-4" /> {sheet ? 'তালিকা' : 'রিপোর্ট শিট'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> প্রিন্ট
              </Button>
            </>
          }
        />
      </div>

      {isLoading ? <Loading /> : error ? <ErrorState error={error} onRetry={refetch} /> : (
        <>
          <div className={`${sheet ? 'hidden' : ''} no-print`}>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="গতকালের জের" value={s.opening_cash} currency={currency} tone="info" />
              <StatCard label="আজকের মোট জমা (+)" value={s.cash_in} currency={currency} tone="success" />
              <StatCard label="আজকের মোট খরচ (−)" value={s.cash_out} currency={currency} tone="danger" />
              <StatCard
                label="হাতে নগদ রইল" value={s.closing_cash} currency={currency}
                tone={s.closing_cash < 0 ? 'danger' : 'primary'}
                hint={`${money(s.opening_cash, currency)} + ${money(s.cash_in, currency)} − ${money(s.cash_out, currency)}`}
              />
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard label="আজকের বিক্রি (বিল)" value={s.sales} currency={currency} tone="primary" hint={`${data.orders.length} টি অর্ডার`} />
              <StatCard label="আজকের নতুন বাকি" value={s.new_due} currency={currency} tone="accent" />
              <StatCard label="আজকের ক্রয় (বিল)" value={s.purchases} currency={currency} tone="info" hint={`নগদ পরিশোধ ${money(s.purchase_paid, currency)}`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>জমা — টাকা এলো ({lines.income.length})</CardTitle>
                  <span className="num font-bold text-emerald-700">{money(s.cash_in, currency)}</span>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={lineColumns('text-emerald-700')}
                    rows={lines.income}
                    onRowClick={(l) => l.to && navigate(l.to)}
                    empty={<p className="py-4 text-sm text-muted-foreground">এই দিনে কোনো জমা নেই</p>}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>খরচ — টাকা গেল ({lines.expense.length})</CardTitle>
                  <span className="num font-bold text-destructive">{money(s.cash_out, currency)}</span>
                </CardHeader>
                <CardContent>
                  <DataTable
                    columns={lineColumns('text-destructive')}
                    rows={lines.expense}
                    onRowClick={(l) => l.to && navigate(l.to)}
                    empty={<p className="py-4 text-sm text-muted-foreground">এই দিনে কোনো খরচ নেই</p>}
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>আজকের অর্ডার ({data.orders.length})</CardTitle></CardHeader>
                <CardContent>
                  <DataTable
                    columns={[
                      { key: 'order_number', label: 'নং' },
                      { key: 'customer_name', label: 'কাস্টমার' },
                      { key: 'total_selling', label: 'মোট', align: 'right', render: (o) => (
                        <span className="num">{money(o.total_selling, currency)}</span>
                      ) },
                      { key: 'due', label: 'বাকি', align: 'right', render: (o) => (
                        <span className="num text-destructive">{money(o.due, currency)}</span>
                      ) },
                    ]}
                    rows={data.orders}
                    onRowClick={(o) => navigate(`/orders/${o.id}`)}
                    empty={<p className="py-4 text-sm text-muted-foreground">এই দিনে কোনো অর্ডার নেই</p>}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* The paper the manager sends the owner at the end of the day. */}
          <div className={sheet ? 'mt-2' : 'print-only mt-6'}>
            <DailySheet data={data} lines={lines} date={date} currency={currency} />
          </div>
        </>
      )}
    </div>
  );
}

function LineTable({ title, rows, total, currency }) {
  return (
    <div>
      <p className="print-party-label">{title}</p>
      <PrintTable
        head={[
          { label: 'বিবরণ' },
          { label: 'টাকা', align: 'right', width: '96px' },
        ]}
        foot={(
          <tfoot>
            <tr>
              <td>মোট</td>
              <td className="num" style={{ textAlign: 'right' }}>{money(total, currency)}</td>
            </tr>
          </tfoot>
        )}
      >
        {rows.length === 0 && (
          <tr><td colSpan={2} style={{ textAlign: 'center' }}>—</td></tr>
        )}
        {rows.map((l) => (
          <tr key={l.id}>
            <td>
              {l.label}
              <span style={{ display: 'block', fontSize: '10.5px', color: '#6b7280' }}>
                {[l.head !== l.label && l.head, l.detail].filter(Boolean).join(' · ')}
              </span>
            </td>
            <td className="num" style={{ textAlign: 'right' }}>{money(l.amount, currency)}</td>
          </tr>
        ))}
      </PrintTable>
    </div>
  );
}

/** দৈনিক হিসাব — জমা | খরচ side by side, then the balance, like the খাতা. */
function DailySheet({ data, lines, date, currency }) {
  const { summary: s } = data;

  return (
    <PrintDoc
      title="দৈনিক হিসাব"
      copyLabel="মালিক কপি"
      meta={[['তারিখ', bnDateWithDay(date)]]}
      signatures={['ম্যানেজারের স্বাক্ষর', 'মালিকের স্বাক্ষর']}
      footerNote=""
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
        <LineTable title="জমা (টাকা এলো)" rows={lines.income} total={s.cash_in} currency={currency} />
        <LineTable title="খরচ (টাকা গেল)" rows={lines.expense} total={s.cash_out} currency={currency} />
      </div>

      <PrintTotals
        rows={[
          { label: 'গতকালের জের (হাতে ছিল)', value: money(s.opening_cash, currency) },
          { label: '+ আজকের মোট জমা', value: money(s.cash_in, currency) },
          { label: '− আজকের মোট খরচ', value: money(s.cash_out, currency) },
          {
            label: 'হাতে নগদ রইল', value: money(s.closing_cash, currency),
            strong: s.closing_cash >= 0, danger: s.closing_cash < 0,
          },
        ]}
      />

      <div className="print-subsection">
        <p className="print-party-label">আজকের বিক্রি ও বাকি (নগদ হিসাবের বাইরে)</p>
        <PrintTable
          head={[
            { label: 'নং', width: '110px' },
            { label: 'কাস্টমার' },
            { label: 'মোট বিল', align: 'right', width: '110px' },
            { label: 'বাকি', align: 'right', width: '110px' },
          ]}
          foot={(
            <tfoot>
              <tr>
                <td colSpan={2}>আজকের মোট বিক্রি / নতুন বাকি</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(s.sales, currency)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(s.new_due, currency)}</td>
              </tr>
            </tfoot>
          )}
        >
          {data.orders.map((o) => (
            <tr key={o.id}>
              <td className="num">{o.order_number}</td>
              <td>{o.customer_name}</td>
              <td className="num" style={{ textAlign: 'right' }}>{money(o.total_selling, currency)}</td>
              <td className="num" style={{ textAlign: 'right' }}>{money(num(o.due), currency)}</td>
            </tr>
          ))}
        </PrintTable>
      </div>
    </PrintDoc>
  );
}
