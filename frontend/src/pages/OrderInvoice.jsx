import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Orders } from '@/api/entities';
import { Button, Loading, ErrorState } from '@/components/ui';
import { PageHeader, PrintDoc, PrintTable, PrintTotals } from '@/components/shared';
import { bnDate, lineAmount, money, num, qty } from '@/lib/utils';

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
  const gross = items.reduce((a, it) => a + lineAmount(it), 0);
  // Anything the customer already owed from earlier orders, so this memo shows
  // the whole picture: এই বিলের বাকি + পূর্বের বাকি = সর্বমোট বাকি।
  const previousDue = num(data.previous_due);

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

      <PrintDoc
        title="ক্যাশ মেমো / ইনভয়েস"
        copyLabel="অফিস কপি"
        meta={[
          ['নং', order.order_number],
          ['তারিখ', bnDate(order.order_date)],
          order.expected_delivery && ['ডেলিভারি', bnDate(order.expected_delivery)],
        ]}
      >
        {/* ---- customer ---- */}
        <section className="print-parties">
          <div>
            <p className="print-party-label">কাস্টমারের তথ্য</p>
            <p className="print-party-name">{order.customer_name}</p>
            <p>মোবাইল: {order.customer_mobile || '—'}</p>
            <p>ঠিকানা: {customer?.address || customer?.village || '—'}</p>
          </div>
          <div>
            <p className="print-party-label">কাজের বিবরণ</p>
            <p>ধরন: {order.order_type}</p>
            {order.description && <p>{order.description}</p>}
            {customer?.customer_id && <p>কোড: {customer.customer_id}</p>}
          </div>
        </section>

        {/* ---- items ---- */}
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

        {/* ---- totals ---- */}
        <PrintTotals
          rows={[
            { label: 'মোট', value: money(gross, currency) },
            num(order.discount) > 0
              && { label: 'ছাড়', value: `− ${money(gross - num(order.total_selling), currency)}` },
            num(order.transport_cost) > 0
              && { label: 'গাড়ি ভাড়া', value: money(order.transport_cost, currency) },
            { label: 'সর্বমোট বিল', value: money(order.total_selling, currency), strong: true },
            { label: 'জমা', value: money(order.total_paid, currency) },
            { label: 'এই বিলের বাকি', value: money(order.due, currency) },
            previousDue > 0 && { label: 'পূর্বের বাকি', value: money(previousDue, currency) },
            {
              label: previousDue > 0 ? 'সর্বমোট বাকি' : 'বাকি',
              value: money(num(order.due) + Math.max(previousDue, 0), currency),
              danger: true,
            },
          ]}
        />

        {/* ---- payment history ---- */}
        {payments.length > 0 && (
          <div className="print-subsection">
            <p className="print-party-label">পেমেন্ট হিস্ট্রি</p>
            <ul>
              {payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-4">
                  <span>{bnDate(p.date)} · {p.method}{p.notes ? ` · ${p.notes}` : ''}</span>
                  <span className="num font-semibold">{money(p.amount, currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PrintDoc>
    </div>
  );
}
