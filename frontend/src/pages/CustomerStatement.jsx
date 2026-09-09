import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, Download } from 'lucide-react';
import { Customers } from '@/api/entities';
import { Button, Loading, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { bnDate, money, downloadCsv } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function CustomerStatement() {
  const { id } = useParams();
  const { setting, currency } = useSettings();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-statement', id],
    queryFn: () => Customers.statement(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { customer, ledger, totals, opening_due: openingDue } = data;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="স্টেটমেন্ট"
          subtitle={customer.name}
          back={`/customers/${id}`}
          actions={
            <>
              <Button
                variant="outline" size="sm"
                onClick={() => downloadCsv(`statement-${customer.name}`, ledger, [
                  { key: 'date', label: 'Date' },
                  { key: 'ref', label: 'Ref' },
                  { key: 'description', label: 'Description' },
                  { key: 'debit', label: 'Debit' },
                  { key: 'credit', label: 'Credit' },
                  { key: 'balance', label: 'Balance' },
                ])}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> প্রিন্ট
              </Button>
            </>
          }
        />
      </div>

      <div className="print-area mx-auto max-w-4xl rounded-lg border bg-white p-6 shadow-sm">
        <div className="border-b pb-4 text-center">
          <h2 className="font-display text-xl font-bold">{setting?.business_name}</h2>
          <p className="text-sm text-muted-foreground">{setting?.address}</p>
          <p className="mt-2 font-heading text-lg font-semibold">গ্রাহক স্টেটমেন্ট</p>
        </div>

        <div className="grid gap-2 border-b py-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">নাম</p>
            <p className="font-medium">{customer.name}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-muted-foreground">মোবাইল</p>
            <p className="font-medium">{customer.mobile || '—'}</p>
          </div>
        </div>

        <div className="overflow-x-auto py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-2 py-2 text-left">তারিখ</th>
                <th className="px-2 py-2 text-left">রেফ</th>
                <th className="px-2 py-2 text-left">বিবরণ</th>
                <th className="px-2 py-2 text-right">বিল</th>
                <th className="px-2 py-2 text-right">জমা</th>
                <th className="px-2 py-2 text-right">ব্যালান্স</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/20">
                <td className="px-2 py-2" colSpan={5}>পূর্বের বাকি</td>
                <td className="num px-2 py-2 text-right font-medium">{money(openingDue, currency)}</td>
              </tr>
              {ledger.map((row, i) => (
                <tr key={i} className="border-b">
                  <td className="px-2 py-2 whitespace-nowrap">{bnDate(row.date)}</td>
                  <td className="px-2 py-2">{row.ref || '—'}</td>
                  <td className="px-2 py-2">{row.description || '—'}</td>
                  <td className="num px-2 py-2 text-right">
                    {row.debit ? money(row.debit, currency) : '—'}
                  </td>
                  <td className="num px-2 py-2 text-right text-emerald-700">
                    {row.credit ? money(row.credit, currency) : '—'}
                  </td>
                  <td className="num px-2 py-2 text-right font-medium">{money(row.balance, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="px-2 py-2" colSpan={3}>সর্বমোট</td>
                <td className="num px-2 py-2 text-right">{money(totals.billed, currency)}</td>
                <td className="num px-2 py-2 text-right">{money(totals.paid, currency)}</td>
                <td className="num px-2 py-2 text-right text-destructive">
                  {money(totals.balance, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {setting?.invoice_footer && (
          <p className="mt-4 text-center text-xs text-muted-foreground">{setting.invoice_footer}</p>
        )}
      </div>
    </div>
  );
}
