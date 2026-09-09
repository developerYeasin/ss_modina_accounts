import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Orders } from '@/api/entities';
import { Button, Loading, ErrorState } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { bnDate, money, num } from '@/lib/utils';

export default function OrderInvoice() {
  const { id } = useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => Orders.detail(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { order, payments, customer, setting, items } = data;
  const currency = setting?.currency || '৳';
  const gross = items.reduce((a, it) => a + num(it.selling_price) * num(it.quantity), 0);

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="ইনভয়েস"
          subtitle={order.order_number}
          back={`/orders/${id}`}
          actions={
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> প্রিন্ট
            </Button>
          }
        />
      </div>

      <div className="print-area mx-auto max-w-3xl rounded-lg border bg-white p-6 shadow-sm sm:p-8">
        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="flex items-start gap-3">
            {setting?.logo_url && (
              <img src={setting.logo_url} alt="logo" className="h-16 w-16 object-contain" />
            )}
            <div>
              <h2 className="font-display text-xl font-bold">{setting?.business_name}</h2>
              <p className="text-sm text-muted-foreground">{setting?.address}</p>
              <p className="text-sm text-muted-foreground">
                {setting?.proprietor && `${setting.proprietor} · `}{setting?.phone}
              </p>
              {setting?.manager && (
                <p className="text-sm text-muted-foreground">
                  {setting.manager} · {setting.manager_phone}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="font-heading text-lg font-bold">ক্যাশ মেমো</p>
            <p className="text-sm">নং: <span className="font-medium">{order.order_number}</span></p>
            <p className="text-sm">তারিখ: {bnDate(order.order_date)}</p>
            {order.expected_delivery && (
              <p className="text-sm">ডেলিভারি: {bnDate(order.expected_delivery)}</p>
            )}
          </div>
        </div>

        {/* customer */}
        <div className="grid gap-2 border-b py-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">গ্রাহকের নাম</p>
            <p className="font-medium">{order.customer_name}</p>
            {customer?.customer_id && (
              <p className="text-xs text-muted-foreground">{customer.customer_id}</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-muted-foreground">মোবাইল</p>
            <p className="font-medium">{order.customer_mobile || '—'}</p>
            {(customer?.village || customer?.address) && (
              <p className="text-xs text-muted-foreground">{customer.village || customer.address}</p>
            )}
          </div>
        </div>

        {/* items */}
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

        {/* totals */}
        <div className="flex justify-end border-t pt-4">
          <dl className="w-full max-w-xs space-y-1.5 text-sm">
            <Row label="মোট" value={money(gross, currency)} />
            {num(order.discount) > 0 && (
              <Row label="ছাড়" value={`− ${money(gross - order.total_selling, currency)}`} />
            )}
            {num(order.transport_cost) > 0 && (
              <Row label="গাড়ি ভাড়া" value={money(order.transport_cost, currency)} />
            )}
            <Row
              label="সর্বমোট"
              value={money(order.total_selling, currency)}
              className="border-t pt-1.5 text-base font-bold"
            />
            <Row label="জমা" value={money(order.total_paid, currency)} />
            <Row
              label="বাকি"
              value={money(order.due, currency)}
              className="border-t pt-1.5 text-base font-bold text-destructive"
            />
          </dl>
        </div>

        {/* payment history */}
        {payments.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="mb-2 text-sm font-semibold">জমার বিবরণ</p>
            <ul className="space-y-1 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {bnDate(p.date)} · {p.method}{p.notes ? ` · ${p.notes}` : ''}
                  </span>
                  <span className="num font-medium">{money(p.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* footer */}
        <div className="mt-8 flex items-end justify-between gap-6 border-t pt-6 text-sm">
          <div className="text-center">
            <div className="mb-1 w-36 border-t border-dashed" />
            <p className="text-xs text-muted-foreground">গ্রাহকের স্বাক্ষর</p>
          </div>
          <div className="text-center">
            <div className="mb-1 w-36 border-t border-dashed" />
            <p className="text-xs text-muted-foreground">বিক্রেতার স্বাক্ষর</p>
          </div>
        </div>

        {setting?.invoice_footer && (
          <p className="mt-4 text-center text-xs text-muted-foreground">{setting.invoice_footer}</p>
        )}
      </div>
    </div>
  );
}

const Row = ({ label, value, className = '' }) => (
  <div className={`flex justify-between gap-4 ${className}`}>
    <dt>{label}</dt>
    <dd className="num">{value}</dd>
  </div>
);
