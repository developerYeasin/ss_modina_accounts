import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Quotation } from '@/api/entities';
import { Button, Loading, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { bnDate, money, num, parseJson } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

export default function QuotationInvoice() {
  const { id } = useParams();
  const { setting, currency } = useSettings();
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

      <div className="print-area mx-auto max-w-3xl rounded-lg border bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="flex items-start gap-3">
            {setting?.logo_url && (
              <img src={setting.logo_url} alt="logo" className="h-16 w-16 object-contain" />
            )}
            <div>
              <h2 className="font-display text-xl font-bold">{setting?.business_name}</h2>
              <p className="text-sm text-muted-foreground">{setting?.address}</p>
              <p className="text-sm text-muted-foreground">{setting?.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-heading text-lg font-bold">কোটেশন</p>
            <p className="text-sm">নং: <span className="font-medium">{quote.quote_number}</span></p>
            <p className="text-sm">তারিখ: {bnDate(quote.date)}</p>
            {quote.valid_until && <p className="text-sm">মেয়াদ: {bnDate(quote.valid_until)}</p>}
          </div>
        </div>

        <div className="grid gap-2 border-b py-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">গ্রাহকের নাম</p>
            <p className="font-medium">{quote.customer_name || '—'}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-muted-foreground">মোবাইল</p>
            <p className="font-medium">{quote.customer_mobile || '—'}</p>
          </div>
        </div>

        <div className="overflow-x-auto py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">বিবরণ</th>
                <th className="px-2 py-2 text-left">মাপ</th>
                <th className="px-2 py-2 text-right">পরিমাণ</th>
                <th className="px-2 py-2 text-right">দর</th>
                <th className="px-2 py-2 text-right">টাকা</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b">
                  <td className="px-2 py-2">{i + 1}</td>
                  <td className="px-2 py-2">
                    <p className="font-medium">{it.item_name || it.category}</p>
                    {it.material && <p className="text-xs text-muted-foreground">{it.material}</p>}
                  </td>
                  <td className="px-2 py-2">
                    {num(it.width) && num(it.height) ? `${it.width}′ × ${it.height}′` : '—'}
                  </td>
                  <td className="num px-2 py-2 text-right">{it.quantity} {it.unit}</td>
                  <td className="num px-2 py-2 text-right">{money(it.selling_price, currency)}</td>
                  <td className="num px-2 py-2 text-right font-medium">
                    {money(num(it.selling_price) * num(it.quantity), currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end border-t pt-4">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>সাব-টোটাল</dt><dd className="num">{money(quote.subtotal, currency)}</dd>
            </div>
            {num(quote.discount) > 0 && (
              <div className="flex justify-between">
                <dt>ছাড়</dt><dd className="num">− {money(quote.discount, currency)}</dd>
              </div>
            )}
            {num(quote.other_cost) > 0 && (
              <div className="flex justify-between">
                <dt>অন্যান্য</dt><dd className="num">{money(quote.other_cost, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-1.5 text-base font-bold">
              <dt>সর্বমোট</dt><dd className="num">{money(quote.total, currency)}</dd>
            </div>
          </dl>
        </div>

        {quote.notes && (
          <div className="mt-4 border-t pt-3 text-sm">
            <p className="font-semibold">নোট</p>
            <p className="text-muted-foreground">{quote.notes}</p>
          </div>
        )}

        {setting?.invoice_footer && (
          <p className="mt-6 text-center text-xs text-muted-foreground">{setting.invoice_footer}</p>
        )}
      </div>
    </div>
  );
}
