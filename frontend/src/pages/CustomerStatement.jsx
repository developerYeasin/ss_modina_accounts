import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, Download } from 'lucide-react';
import { Customers } from '@/api/entities';
import { Button, Loading, ErrorState } from '@/components/ui';
import { PageHeader, PrintDoc, PrintTable, PrintTotals } from '@/components/shared';
import { bnDate, money, downloadCsv } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function CustomerStatement() {
  const { id } = useParams();
  const { currency } = useSettings();
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

      <PrintDoc
        title="গ্রাহক স্টেটমেন্ট"
        copyLabel="কাস্টমার কপি"
        meta={[
          ['কাস্টমার', customer.name],
          ['মোবাইল', customer.mobile || '—'],
        ]}
        signatures={['কাস্টমারের স্বাক্ষর', 'অনুমোদিত স্বাক্ষর']}
        footerNote=""
      >
        <section className="print-parties">
          <div>
            <p className="print-party-label">কাস্টমারের তথ্য</p>
            <p className="print-party-name">{customer.name}</p>
            <p>মোবাইল: {customer.mobile || '—'}</p>
            <p>ঠিকানা: {customer.address || customer.village || '—'}</p>
          </div>
          <div>
            <p className="print-party-label">সারসংক্ষেপ</p>
            <p>মোট বিল: <span className="num">{money(totals.billed, currency)}</span></p>
            <p>মোট জমা: <span className="num">{money(totals.paid, currency)}</span></p>
            <p>বর্তমান বাকি: <span className="num font-bold">{money(totals.balance, currency)}</span></p>
          </div>
        </section>

        <PrintTable
          head={[
            { label: 'তারিখ', width: '110px' },
            { label: 'রেফ', width: '110px' },
            { label: 'বিবরণ' },
            { label: 'বিল', align: 'right', width: '100px' },
            { label: 'জমা', align: 'right', width: '100px' },
            { label: 'ব্যালান্স', align: 'right', width: '110px' },
          ]}
          foot={(
            <tfoot>
              <tr>
                <td colSpan={3}>সর্বমোট</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(totals.billed, currency)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(totals.paid, currency)}</td>
                <td className="num" style={{ textAlign: 'right' }}>{money(totals.balance, currency)}</td>
              </tr>
            </tfoot>
          )}
        >
          <tr>
            <td colSpan={5}>পূর্বের বাকি</td>
            <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>
              {money(openingDue, currency)}
            </td>
          </tr>
          {ledger.map((row, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap' }}>{bnDate(row.date)}</td>
              <td className="num">{row.ref || '—'}</td>
              <td>{row.description || '—'}</td>
              <td className="num" style={{ textAlign: 'right' }}>
                {row.debit ? money(row.debit, currency) : '—'}
              </td>
              <td className="num" style={{ textAlign: 'right' }}>
                {row.credit ? money(row.credit, currency) : '—'}
              </td>
              <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>
                {money(row.balance, currency)}
              </td>
            </tr>
          ))}
        </PrintTable>

        <PrintTotals
          rows={[
            { label: 'মোট বিল', value: money(totals.billed, currency) },
            { label: 'মোট জমা', value: money(totals.paid, currency) },
            { label: 'সর্বমোট বাকি', value: money(totals.balance, currency), danger: true },
          ]}
        />
      </PrintDoc>
    </div>
  );
}
