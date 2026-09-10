import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Quotation } from '@/api/entities';
import { Button, Loading, ErrorState } from '@/components/ui';
import { PageHeader, PrintDoc, PrintTable, PrintTotals } from '@/components/shared';
import { bnDate, lineAmount, money, num, parseJson, qty } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function QuotationInvoice() {
  const { id } = useParams();
  const { currency } = useSettings();
  const { data: quote, isLoading, error, refetch } = useQuery({
    queryKey: ['quotation', id], queryFn: () => Quotation.get(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const items = parseJson(quote.items_json, []);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="কোটেশন"
          subtitle={quote.quote_number}
          back="/quotations"
          actions={
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> প্রিন্ট
            </Button>
          }
        />
      </div>

      <PrintDoc
        title="কোটেশন / দর প্রস্তাব"
        copyLabel="কাস্টমার কপি"
        meta={[
          ['নং', quote.quote_number],
          ['তারিখ', bnDate(quote.date || quote.created_date)],
          quote.valid_until && ['মেয়াদ', bnDate(quote.valid_until)],
        ]}
        signatures={['কাস্টমারের স্বাক্ষর', 'অনুমোদিত স্বাক্ষর']}
      >
        <section className="print-parties">
          <div>
            <p className="print-party-label">কাস্টমারের তথ্য</p>
            <p className="print-party-name">{quote.customer_name || '—'}</p>
            <p>মোবাইল: {quote.customer_mobile || '—'}</p>
          </div>
          <div>
            <p className="print-party-label">কাজের বিবরণ</p>
            <p>{quote.description || quote.order_type || '—'}</p>
          </div>
        </section>

        <PrintTable
          head={[
            { label: 'ক্র.', width: '36px', align: 'center' },
            { label: 'বিবরণ' },
            { label: 'পিস', align: 'right', width: '64px' },
            { label: 'বর্গফুট', align: 'right', width: '78px' },
            { label: 'দর', align: 'right', width: '90px' },
            { label: 'টাকা', align: 'right', width: '110px' },
          ]}
        >
          {items.map((it, i) => (
            <tr key={i}>
              <td className="num" style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{it.item_name || it.category}</td>
              <td className="num" style={{ textAlign: 'right' }}>{qty(it.quantity)}</td>
              <td className="num" style={{ textAlign: 'right' }}>
                {num(it.sqft ?? it.area) > 0 ? qty(it.sqft ?? it.area) : '—'}
              </td>
              <td className="num" style={{ textAlign: 'right' }}>{money(it.selling_price, currency)}</td>
              <td className="num" style={{ textAlign: 'right', fontWeight: 600 }}>
                {money(lineAmount(it), currency)}
              </td>
            </tr>
          ))}
        </PrintTable>

        <PrintTotals
          rows={[
            { label: 'সাব-টোটাল', value: money(quote.subtotal, currency) },
            num(quote.discount) > 0 && { label: 'ছাড়', value: `− ${money(quote.discount, currency)}` },
            num(quote.other_cost) > 0 && { label: 'অন্যান্য', value: money(quote.other_cost, currency) },
            { label: 'সর্বমোট', value: money(quote.total, currency), strong: true },
          ]}
        />

        {quote.notes && (
          <div className="print-subsection">
            <p className="print-party-label">নোট</p>
            <p>{quote.notes}</p>
          </div>
        )}
      </PrintDoc>
    </div>
  );
}
